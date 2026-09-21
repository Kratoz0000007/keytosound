import { pitchClass } from './theory';
import type { Chord, GenrePreset, ScaleName } from './types';

export type CadenceKind = 'full' | 'half' | 'open';

/**
 * How far ahead of a bar line a request must arrive to land on it. Larger than
 * Tone's scheduling lookahead (~150ms), so the band never asks for a bar's
 * chord before the request that changes it has been seen. That is what keeps
 * live playback and a headless replay of the same keystrokes in agreement.
 */
export const CADENCE_MARGIN_MS = 250;

/**
 * Keys a paragraph break moves through, as semitones above the home key:
 * home, up a fifth, up a fourth, up a tone, then home again. All closely
 * related, so a modulation sounds like a new section rather than a wrong note.
 */
export const MODULATION_PATH = [0, 7, 5, 2] as const;

/** A question holds the dominant this many bars: the music waits for an answer. */
const OPEN_HOLD_BARS = 2;

/**
 * The seven-note scale each melody scale sits inside. Chords are built from
 * this, since a pentatonic scale is too sparse to stack a triad on every degree.
 */
const PARENT_SCALES: Record<ScaleName, number[]> = {
  minorPentatonic: [0, 2, 3, 5, 7, 8, 10],
  majorPentatonic: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
};

export interface BarHarmony {
  keyRoot: number;
  chord: Chord;
  /** The home chord of this bar's key. */
  tonic: Chord;
  /** Which progression chord is sounding, or -1 for a cadence chord. */
  progressionIndex: number;
  cadence: CadenceKind | null;
}

interface HarmonyEvent {
  bar: number;
  kind: CadenceKind | 'modulate';
}

function transpose(chord: Chord, semitones: number): Chord {
  return { root: pitchClass(chord.root + semitones), intervals: chord.intervals };
}

/** The triad on the fifth degree of the key, built from the parent scale. */
function dominantOf(scale: ScaleName, keyRoot: number): Chord {
  const parent = PARENT_SCALES[scale];
  const degree = (i: number) => parent[i % 7] + 12 * Math.floor(i / 7);
  const root = degree(4);
  return {
    root: pitchClass(keyRoot + root),
    intervals: [0, degree(6) - root, degree(8) - root],
  };
}

/**
 * The single source of truth for key and chord, shared by the melody engine
 * and the backing band. Time is measured in bars of session time, so harmony
 * is a pure function of the keystroke stream: replay reproduces it exactly.
 *
 * Bars are simulated lazily and never rewritten once read. A request that
 * arrives for a bar already heard moves to the next unheard one.
 */
export class Harmony {
  readonly barMs: number;
  private readonly bars: BarHarmony[] = [];
  private readonly pending: HarmonyEvent[] = [];
  private progressionPosition = 0;
  private modulations = 0;
  private holdBars = 0;

  constructor(private readonly preset: GenrePreset) {
    this.barMs = (4 * 60000) / preset.bpm;
  }

  barAt(timeMs: number): number {
    return Math.max(0, Math.floor(timeMs / this.barMs));
  }

  request(kind: CadenceKind, timeMs: number): void {
    this.pending.push({ bar: this.effectiveBar(timeMs), kind });
  }

  modulate(timeMs: number): void {
    this.pending.push({ bar: this.effectiveBar(timeMs), kind: 'modulate' });
  }

  at(bar: number): BarHarmony {
    while (this.bars.length <= bar) this.bars.push(this.simulate(this.bars.length));
    return this.bars[bar];
  }

  private effectiveBar(timeMs: number): number {
    const next = Math.floor((Math.max(0, timeMs) + CADENCE_MARGIN_MS) / this.barMs) + 1;
    return Math.max(next, this.bars.length);
  }

  private simulate(bar: number): BarHarmony {
    let cadence: CadenceKind | null = null;
    for (let i = 0; i < this.pending.length; ) {
      const event = this.pending[i];
      if (event.bar > bar) {
        i++;
        continue;
      }
      this.pending.splice(i, 1);
      if (event.kind === 'modulate') {
        this.modulations += 1;
        this.progressionPosition = 0;
        this.holdBars = 0;
      } else {
        cadence = event.kind;
      }
    }

    const offset = MODULATION_PATH[this.modulations % MODULATION_PATH.length];
    const keyRoot = pitchClass(this.preset.keyRoot + offset);
    const progression = this.preset.progression;
    const tonic = transpose(progression[0], offset);
    const dominant = dominantOf(this.preset.scale, keyRoot);

    if (cadence === 'full') {
      this.holdBars = 0;
      this.progressionPosition = 1;
      return { keyRoot, chord: tonic, tonic, progressionIndex: 0, cadence };
    }
    if (cadence === 'half') {
      this.holdBars = 0;
      return { keyRoot, chord: dominant, tonic, progressionIndex: -1, cadence };
    }
    if (cadence === 'open') {
      this.holdBars = OPEN_HOLD_BARS - 1;
      return { keyRoot, chord: dominant, tonic, progressionIndex: -1, cadence };
    }
    if (this.holdBars > 0) {
      this.holdBars -= 1;
      return { keyRoot, chord: dominant, tonic, progressionIndex: -1, cadence: null };
    }

    const index = this.progressionPosition % progression.length;
    this.progressionPosition += 1;
    return {
      keyRoot,
      chord: transpose(progression[index], offset),
      tonic,
      progressionIndex: index,
      cadence: null,
    };
  }
}
