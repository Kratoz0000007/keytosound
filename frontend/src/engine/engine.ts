import { mapFeatures } from './mapper';
import { createPrng } from './prng';
import { selectNextPitch } from './transition';
import type { ContourDirection, GenrePreset, MusicalEvent, MusicalState } from './types';
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

function initialState(preset: GenrePreset): MusicalState {
  return {
    keyRoot: preset.keyRoot,
    scale: preset.scale,
    progression: preset.progression,
    chordIndex: 0,
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

export class MusicEngine {
  private state: MusicalState;
  private rng: () => number;
  private eventCount = 0;

  constructor(
    private readonly preset: GenrePreset,
    private readonly seed: number,
  ) {
    this.state = initialState(preset);
    this.rng = createPrng(seed);
  }

  reset(): void {
    this.state = initialState(this.preset);
    this.rng = createPrng(this.seed);
    this.eventCount = 0;
  }

  getState(): Readonly<MusicalState> {
    return this.state;
  }

  step(features: TypingFeatures): MusicalEvent | null {
    const params = mapFeatures(features, this.state, this.preset);

    if (params.advanceChord) {
      this.state.chordIndex = (this.state.chordIndex + 1) % this.state.progression.length;
    }

    if (params.isRest) {
      this.advancePhrase();
      return null;
    }

    const pitch = params.echoPrevious
      ? this.state.previousPitch
      : selectNextPitch(this.state, params, this.preset, this.rng);

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

    return {
      pitch,
      velocity: params.velocity,
      durationBeats: params.durationBeats,
      subdivision: params.subdivision,
    };
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

/**
 * Render a whole session headlessly. This is the function the ear-evaluation
 * harness and the future replay feature both call.
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
