import type { Groove } from './types';

/** Digit n (1-9) edits VOICES[n - 1]. The only fixed key assignments in the app. */
export const VOICES = [
  'kick',
  'snare',
  'hat',
  'openHat',
  'clap',
  'perc',
  'bass',
  'stab',
  'fx',
] as const;

export type Voice = (typeof VOICES)[number];

const STEPS_PER_BAR = 16;

export interface BeatEdit {
  /** null for 0, which resets the loop. */
  voice: Voice | null;
  step: number;
  added: boolean;
  /** Session time of the step the hit landed on. */
  stepTimeMs: number;
}

/** Nearest 16th to a session time. The last half-step of a bar rounds onto the next downbeat. */
export function stepAt(timeMs: number, bpm: number): { bar: number; step: number } {
  const sixteenth = 60000 / bpm / 4;
  const absolute = Math.round(Math.max(0, timeMs) / sixteenth);
  return { bar: Math.floor(absolute / STEPS_PER_BAR), step: absolute % STEPS_PER_BAR };
}

/**
 * The band's drum loop, as the user has edited it. Starts from the genre's
 * groove; digits toggle hits on the nearest 16th. Built only from keystrokes
 * and their timestamps, so replay rebuilds the same beat.
 */
export class BeatPattern {
  private steps: Record<Voice, Set<number>>;

  constructor(
    private readonly preset: Groove,
    private readonly bpm: number,
  ) {
    this.steps = BeatPattern.fromGroove(preset);
  }

  private static fromGroove(groove: Groove): Record<Voice, Set<number>> {
    const out = {} as Record<Voice, Set<number>>;
    for (const voice of VOICES) out[voice] = new Set(groove[voice]);
    return out;
  }

  has(voice: Voice, step: number): boolean {
    return this.steps[voice].has(step);
  }

  get swing(): number {
    return this.preset.swing;
  }

  press(digit: number, timeMs: number): BeatEdit | null {
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) return null;
    const sixteenth = 60000 / this.bpm / 4;
    const { bar, step } = stepAt(timeMs, this.bpm);
    const stepTimeMs = (bar * STEPS_PER_BAR + step) * sixteenth;

    if (digit === 0) {
      this.steps = BeatPattern.fromGroove(this.preset);
      return { voice: null, step, added: false, stepTimeMs };
    }

    const voice = VOICES[digit - 1];
    const set = this.steps[voice];
    const added = !set.has(step);
    if (added) set.add(step);
    else set.delete(step);
    return { voice, step, added, stepTimeMs };
  }
}
