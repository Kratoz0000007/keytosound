import type { Chord, ScaleName } from './types';

/** Semitone offsets from the key root, ascending. */
export const SCALES: Record<ScaleName, number[]> = {
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
};

/**
 * The largest gap between adjacent degrees, i.e. what counts as "one step" in
 * this scale. Pentatonic gives 3 (degrees sit 2-3 apart); the seven-note modes
 * give 2. This must be derived rather than hardcoded: a fixed 3 would let a
 * minor third pass as a step on a diatonic scale, waving through exactly the
 * dissonances the approached-by-step rule exists to block.
 */
export function maxScaleStep(scale: ScaleName): number {
  const degrees = SCALES[scale];
  let largest = 1;
  for (let i = 0; i < degrees.length; i++) {
    const next = i + 1 < degrees.length ? degrees[i + 1] : degrees[0] + 12;
    largest = Math.max(largest, next - degrees[i]);
  }
  return largest;
}

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

/**
 * True when the pitch sits a semitone from any tone of the chord. This is the
 * harshest available dissonance, and on a seven-note scale it is common:
 * adjacent diatonic degrees are 1-2 semitones apart, so most non-chord tones
 * are a semitone from something in the chord.
 */
export function clashesWithChord(pitch: number, chord: Chord): boolean {
  const pc = pitchClass(pitch);
  return chord.intervals.some((interval) => {
    const tone = pitchClass(chord.root + interval);
    const distance = Math.abs(pc - tone);
    return Math.min(distance, 12 - distance) === 1;
  });
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Scientific pitch notation, e.g. 60 -> "C4". For display only. */
export function noteName(pitch: number): string {
  return `${NOTE_NAMES[pitchClass(pitch)]}${Math.floor(pitch / 12) - 1}`;
}
