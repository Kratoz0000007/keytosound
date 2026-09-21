import { BeatPattern, type BeatEdit, type Voice } from './beat';
import { Harmony, type BarHarmony, type CadenceKind } from './harmony';
import { mapFeatures } from './mapper';
import { motifPitch, motifStep } from './motif';
import { createPrng } from './prng';
import { isChordTone, pitchClass, scalePitchesInRange, SCALES } from './theory';
import { registerWindow, selectNextPitch } from './transition';
import type {
  Articulation,
  ContourDirection,
  GenrePreset,
  MappedParams,
  MusicalEvent,
  MusicalState,
} from './types';
import type { TypingFeatures } from '../typing/types';

/**
 * How many pitches the repetition penalty remembers. Deliberately short: a
 * pentatonic scale offers only ~11 candidates within an octave of the previous
 * note, so a long memory penalises nearly every neighbour at once and exiles
 * the melody to whatever distant pitch is still unused. Four is enough to stop
 * the line sticking without driving it away.
 */
const RECENT_PITCH_MEMORY = 4;
/** Keystrokes per phrase, used to advance phrasePosition. */
const PHRASE_LENGTH_EVENTS = 32;
/** How far a word's landing note may travel to find a chord tone. */
const LANDING_RANGE = 5;

function initialState(preset: GenrePreset, bar: BarHarmony): MusicalState {
  return {
    keyRoot: bar.keyRoot,
    scale: preset.scale,
    progression: preset.progression,
    chordIndex: Math.max(0, bar.progressionIndex),
    currentChord: bar.chord,
    tonicChord: bar.tonic,
    targetPitchClass: null,
    previousPitch: preset.centerPitch,
    contourDirection: 0,
    contourMomentum: 0,
    lastIntervalSize: 0,
    phrasePosition: 0,
    energy: 0,
    tension: 0,
    recentPitches: [],
    beatPosition: 0,
  };
}

/**
 * Turns typing into music. Each key has one job:
 *
 * - the first letter of a word: the transition engine chooses where the word
 *   starts, joining it to the last one and steering toward any cadence target;
 * - later letters: the word's own motif, a shape hashed from its letters;
 * - space: the word lands on a nearby chord tone;
 * - punctuation and Enter: harmony (cadences, modulation) via Harmony;
 * - digits: the drum loop via BeatPattern;
 * - backspace: the falling erase gesture.
 */
export class MusicEngine {
  private state: MusicalState;
  private rng: () => number;
  private eventCount = 0;
  private harmony: Harmony;
  private beat: BeatPattern;
  private pendingTarget: CadenceKind | null = null;
  private lastEdit: BeatEdit | null = null;

  constructor(
    private readonly preset: GenrePreset,
    private readonly seed: number,
  ) {
    this.harmony = new Harmony(preset);
    this.beat = new BeatPattern(preset.groove, preset.bpm);
    this.state = initialState(preset, this.harmony.at(0));
    this.rng = createPrng(seed);
  }

  reset(): void {
    this.harmony = new Harmony(this.preset);
    this.beat = new BeatPattern(this.preset.groove, this.preset.bpm);
    this.state = initialState(this.preset, this.harmony.at(0));
    this.rng = createPrng(this.seed);
    this.eventCount = 0;
    this.pendingTarget = null;
    this.lastEdit = null;
  }

  getState(): Readonly<MusicalState> {
    return this.state;
  }

  /** What the band plays in a given bar. Same object the melody reads. */
  harmonyAt(bar: number): BarHarmony {
    return this.harmony.at(bar);
  }

  get barMs(): number {
    return this.harmony.barMs;
  }

  beatHas(voice: Voice, step: number): boolean {
    return this.beat.has(voice, step);
  }

  get swing(): number {
    return this.beat.swing;
  }

  /** The beat edit made by the most recent keystroke, if it was a digit. */
  get lastBeatEdit(): BeatEdit | null {
    return this.lastEdit;
  }

  step(features: TypingFeatures): MusicalEvent | null {
    this.lastEdit = null;
    if (features.digit !== null) {
      this.lastEdit = this.beat.press(features.digit, features.timestamp);
      return null;
    }

    const erasing = features.isBackspace;
    if (!erasing) this.requestHarmony(features);
    this.syncHarmony(features.timestamp);

    const params = mapFeatures(features, this.state, this.preset);

    if (features.isEnter || params.isRest) {
      this.advancePhrase();
      return null;
    }

    const pitch = this.choosePitch(features, params);
    if (pitch === null) {
      this.advancePhrase();
      return null;
    }

    this.updateContour(pitch);
    this.state.previousPitch = pitch;
    this.state.recentPitches = [...this.state.recentPitches, pitch].slice(-RECENT_PITCH_MEMORY);
    this.state.energy = Math.min(1, features.speed / 80);
    this.state.tension = params.targetTension;
    this.state.beatPosition = (this.state.beatPosition + params.durationBeats / 4) % 1;

    if (params.forceResolution) {
      this.state.phrasePosition = 0;
      this.eventCount = 0;
    } else {
      this.advancePhrase();
    }

    const landing = !erasing && features.wordLength > 0 && features.punctuation === 'none';
    return {
      articulation: articulationFor(features),
      pitch,
      // A landing note is the word's exhale: softer, and held.
      velocity: landing ? params.velocity * 0.75 : params.velocity,
      durationBeats: landing ? Math.max(1, params.durationBeats) : params.durationBeats,
      subdivision: params.subdivision,
    };
  }

  private requestHarmony(f: TypingFeatures): void {
    let cadence: CadenceKind | null = null;
    if (f.punctuation === 'period') cadence = 'full';
    else if (f.punctuation === 'comma') cadence = 'half';
    else if (f.punctuation === 'question') cadence = 'open';

    if (cadence) {
      this.harmony.request(cadence, f.timestamp);
      this.pendingTarget = cadence;
    }
    if (f.isEnter) this.harmony.modulate(f.timestamp);
  }

  private syncHarmony(timestamp: number): void {
    const bar = this.harmony.at(this.harmony.barAt(timestamp));
    this.state.keyRoot = bar.keyRoot;
    this.state.currentChord = bar.chord;
    this.state.tonicChord = bar.tonic;
    if (bar.progressionIndex >= 0) this.state.chordIndex = bar.progressionIndex;
  }

  private choosePitch(f: TypingFeatures, params: MappedParams): number | null {
    // Erasing, and the note a punctuation mark itself plays, stay with the
    // transition engine: it owns resolution and the falling gesture.
    if (f.isBackspace || f.punctuation !== 'none') {
      return selectNextPitch(this.state, params, this.preset, this.rng);
    }
    if (f.wordLength > 0) return this.landingPitch();

    const letters = f.wordPrefix.length;
    if (letters === 1) return this.wordStartPitch(params);
    if (letters >= 2) {
      const [floor, ceiling] = registerWindow(this.preset);
      return motifPitch({
        previousPitch: this.state.previousPitch,
        step: motifStep(f.wordPrefix),
        keyRoot: this.state.keyRoot,
        scale: this.state.scale,
        chord: this.state.currentChord,
        floor,
        ceiling,
      });
    }
    // A space with no word before it, or any other key: silence.
    return null;
  }

  /** Where a word begins is the one real decision per word, and the transition engine makes it. */
  private wordStartPitch(params: MappedParams): number | null {
    this.state.targetPitchClass = this.targetPitchClass();
    const pitch = selectNextPitch(this.state, params, this.preset, this.rng);
    this.state.targetPitchClass = null;
    this.pendingTarget = null;
    return pitch;
  }

  private targetPitchClass(): number | null {
    const root = this.state.keyRoot;
    switch (this.pendingTarget) {
      case 'full':
        return root;
      case 'half':
        return pitchClass(root + 7);
      case 'open':
        return pitchClass(root + SCALES[this.state.scale][1]);
      default:
        return null;
    }
  }

  /** The nearest chord tone to the word's last note, so the phrase settles before the next begins. */
  private landingPitch(): number | null {
    const previous = this.state.previousPitch;
    const [floor, ceiling] = registerWindow(this.preset);
    const nearby = scalePitchesInRange(
      this.state.keyRoot,
      this.state.scale,
      Math.max(floor, previous - LANDING_RANGE),
      Math.min(ceiling, previous + LANDING_RANGE),
    ).filter((p) => p !== previous && isChordTone(p, this.state.currentChord));
    if (nearby.length === 0) return null;
    return nearby.reduce((best, p) =>
      Math.abs(p - previous) < Math.abs(best - previous) ? p : best,
    );
  }

  private advancePhrase(): void {
    this.eventCount += 1;
    this.state.phrasePosition = (this.eventCount % PHRASE_LENGTH_EVENTS) / PHRASE_LENGTH_EVENTS;
  }

  private updateContour(pitch: number): void {
    const move = pitch - this.state.previousPitch;
    const direction = Math.sign(move) as ContourDirection;
    this.state.lastIntervalSize = Math.abs(move);
    if (direction === this.state.contourDirection && direction !== 0) {
      this.state.contourMomentum += 1;
    } else {
      this.state.contourMomentum = direction === 0 ? 0 : 1;
    }
    this.state.contourDirection = direction;
  }
}

/** How a note should join the previous one; see Articulation. */
function articulationFor(f: TypingFeatures): Articulation {
  if (f.isBackspace) return 'slur';
  if (f.punctuation !== 'none') return 'strike';
  if (f.wordLength === 0 && f.wordPrefix.length === 1) return 'phrase';
  return 'slur';
}

/**
 * Render a whole session headlessly. This is the function the ear-evaluation
 * harness and the replay feature both call.
 */
export function renderSession(
  features: TypingFeatures[],
  preset: GenrePreset,
  seed: number,
): MusicalEvent[] {
  const engine = new MusicEngine(preset, seed);
  const events: MusicalEvent[] = [];
  for (const f of features) {
    const event = engine.step(f);
    if (event) events.push(event);
  }
  return events;
}
