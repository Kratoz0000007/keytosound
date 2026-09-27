import { BeatPattern, type BeatEdit, type Voice } from './beat';
import { Harmony, type BarHarmony, type CadenceKind } from './harmony';
import { mapFeatures } from './mapper';
import { fnv1a, motifPitch, motifSteps } from './motif';
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
 * The chord tones a word can start on: root, third, fifth. Three for every
 * chord, triad or seventh, so a letter's choice does not shift between them.
 */
const START_ROLES = 3;

/**
 * Turns typing into music. Each key has one job:
 *
 * - the first letter of a word: the word starts on a chord tone its letter
 *   picks (root, third or fifth of whatever chord is playing), near the
 *   middle of the register, or on the cadence target after punctuation;
 * - later letters: the word's own motif, a shape hashed from its letters and
 *   measured from the word's first note, so the same word always plays the
 *   same tune over the same chord, and the same shape over any other;
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
  /** The current word's first note: every later letter is placed from it. */
  private wordStart: number | null = null;

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
    this.wordStart = null;
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
    if (letters === 1) {
      this.wordStart = this.wordStartPitch(f.wordPrefix, params);
      return this.wordStart;
    }
    if (letters >= 2) {
      const [floor, ceiling] = registerWindow(this.preset);
      // The whole shape so far, from the word's first note. Stepping from the
      // previous note instead let one chord-clash nudge shift every later
      // letter, so a repeated word came out as a different tune.
      const steps = motifSteps(f.wordPrefix).reduce((sum, step) => sum + step, 0);
      return motifPitch({
        previousPitch: this.wordStart ?? this.state.previousPitch,
        step: steps,
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

  /**
   * Where a word begins. Its first letter picks a chord tone by role, not a
   * note: 't' might start on the third of every chord, which is a different
   * pitch in each. The octave is the one nearest the middle of the register,
   * so a word comes back where it was rather than wherever the last one left
   * off. Punctuation's cadence target wins, so a sentence still resolves.
   */
  private wordStartPitch(letter: string, params: MappedParams): number | null {
    const target = this.targetPitchClass();
    this.pendingTarget = null;

    const chord = this.state.currentChord;
    const first = fnv1a(letter) % START_ROLES;
    const roles = [0, 1, 2].map((r) => pitchClass(chord.root + chord.intervals[(first + r) % START_ROLES]));
    const wanted = target !== null ? [target, ...roles] : roles;

    const [floor, ceiling] = registerWindow(this.preset);
    const inScale = scalePitchesInRange(this.state.keyRoot, this.state.scale, floor, ceiling);
    const centre = this.preset.centerPitch;
    // A chord tone outside a pentatonic scale is skipped for the next role.
    for (const pc of wanted) {
      const options = inScale.filter((p) => pitchClass(p) === pc);
      if (options.length === 0) continue;
      return options.reduce((best, p) => (Math.abs(p - centre) < Math.abs(best - centre) ? p : best));
    }
    return selectNextPitch(this.state, params, this.preset, this.rng);
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
