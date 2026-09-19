import { describe, it, expect } from 'vitest';
import {
  pitchClass,
  scalePitchesInRange,
  isChordTone,
  noteName,
  SCALES,
} from '../../src/engine/theory';

describe('pitchClass', () => {
  it('wraps into 0..11', () => {
    expect(pitchClass(60)).toBe(0);
    expect(pitchClass(61)).toBe(1);
    expect(pitchClass(-1)).toBe(11);
  });
});

describe('scalePitchesInRange', () => {
  it('returns only pitches in the scale', () => {
    // C major pentatonic: C D E G A
    const pitches = scalePitchesInRange(0, 'majorPentatonic', 60, 72);
    expect(pitches).toEqual([60, 62, 64, 67, 69, 72]);
  });

  it('respects a non-zero key root', () => {
    // D major pentatonic starting at D4 (62): D E F# A B
    const pitches = scalePitchesInRange(2, 'majorPentatonic', 62, 74);
    expect(pitches).toEqual([62, 64, 66, 69, 71, 74]);
  });

  it('returns an empty array when the range is inverted', () => {
    expect(scalePitchesInRange(0, 'majorPentatonic', 72, 60)).toEqual([]);
  });
});

describe('isChordTone', () => {
  const cMajor = { root: 0, intervals: [0, 4, 7] };

  it('accepts chord tones in any octave', () => {
    expect(isChordTone(60, cMajor)).toBe(true); // C
    expect(isChordTone(64, cMajor)).toBe(true); // E
    expect(isChordTone(79, cMajor)).toBe(true); // G, octave up
  });

  it('rejects non-chord tones', () => {
    expect(isChordTone(62, cMajor)).toBe(false); // D
  });
});

describe('noteName', () => {
  it('uses scientific pitch notation', () => {
    expect(noteName(60)).toBe('C4');
    expect(noteName(69)).toBe('A4');
    expect(noteName(61)).toBe('C#4');
    expect(noteName(72)).toBe('C5');
  });
});

describe('SCALES', () => {
  it('defines both pentatonic scales with five degrees', () => {
    expect(SCALES.majorPentatonic).toHaveLength(5);
    expect(SCALES.minorPentatonic).toHaveLength(5);
  });
});
