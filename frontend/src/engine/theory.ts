import type { Chord, ScaleName } from './types';

/** Semitone offsets from the key root. Pentatonic only — see Global Constraints. */
export const SCALES: Record<ScaleName, number[]> = {
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
};

export function pitchClass(pitch: number): number {
  return ((pitch % 12) + 12) % 12;
}

/** Every MIDI pitch in [low, high] that belongs to the given key and scale. */
export function scalePitchesInRange(
  keyRoot: number,
  scale: ScaleName,
  low: number,
  high: number,
): number[] {
  const degrees = SCALES[scale];
  const out: number[] = [];
  for (let p = low; p <= high; p++) {
    if (degrees.includes(pitchClass(p - keyRoot))) out.push(p);
  }
  return out;
}

export function isChordTone(pitch: number, chord: Chord): boolean {
  const pc = pitchClass(pitch);
  return chord.intervals.some((i) => pitchClass(chord.root + i) === pc);
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Scientific pitch notation, e.g. 60 -> "C4". For display only. */
export function noteName(pitch: number): string {
  return `${NOTE_NAMES[pitchClass(pitch)]}${Math.floor(pitch / 12) - 1}`;
}
