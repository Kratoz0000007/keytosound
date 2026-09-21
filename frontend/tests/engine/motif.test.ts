import { describe, expect, it } from 'vitest';
import { fnv1a, motifPitch, motifStep, motifSteps, STEP_TABLE } from '../../src/engine/motif';
import { clashesWithChord, scalePitchesInRange } from '../../src/engine/theory';
import type { Chord } from '../../src/engine/types';

const Am7: Chord = { root: 9, intervals: [0, 3, 7, 10] };
const C: Chord = { root: 0, intervals: [0, 4, 7] };

describe('fnv1a', () => {
  it('is stable and distinguishes near-identical strings', () => {
    expect(fnv1a('rain')).toBe(fnv1a('rain'));
    expect(fnv1a('rain')).not.toBe(fnv1a('raim'));
    expect(fnv1a('rain')).toBeGreaterThanOrEqual(0);
  });
});

describe('motifStep', () => {
  it('gives the same step for the same prefix', () => {
    expect(motifStep('ra')).toBe(motifStep('ra'));
  });

  it('only ever returns a step from the table, never 0', () => {
    for (const w of ['a', 'ab', 'hello', 'zzz', 'rainbow', "don't"]) {
      expect(STEP_TABLE).toContain(motifStep(w));
      expect(motifStep(w)).not.toBe(0);
    }
  });

  it('lets words that share a start share their opening shape', () => {
    // Steps exist from the 2nd letter on: "rai" shares steps for "ra" and "rai".
    expect(motifSteps('rain').slice(0, 2)).toEqual(motifSteps('rail').slice(0, 2));
    expect(motifSteps('rainbow').slice(0, 3)).toEqual(motifSteps('rain'));
  });
});

describe('motifPitch', () => {
  const base = { keyRoot: 9, scale: 'minorPentatonic' as const, floor: 48, ceiling: 84 };

  it('moves by the requested number of scale degrees', () => {
    // A minor pentatonic: ... A4(69) C5(72) D5(74) E5(76) ...
    expect(motifPitch({ ...base, chord: Am7, previousPitch: 69, step: 1 })).toBe(72);
    expect(motifPitch({ ...base, chord: Am7, previousPitch: 69, step: 2 })).toBe(74);
    expect(motifPitch({ ...base, chord: Am7, previousPitch: 72, step: -1 })).toBe(69);
  });

  it('reflects off the register ceiling instead of leaving it', () => {
    const top = motifPitch({ ...base, chord: Am7, previousPitch: 84, step: 3 });
    expect(top).toBeLessThanOrEqual(84);
    expect(top).toBeLessThan(84);
  });

  it('snaps a previous pitch that is out of the scale (after a modulation)', () => {
    const p = motifPitch({ ...base, chord: Am7, previousPitch: 70, step: 1 });
    expect(scalePitchesInRange(9, 'minorPentatonic', 48, 84)).toContain(p);
  });

  it('nudges a note that would clash with the chord by a semitone', () => {
    // C major scale over a C chord: F (65) clashes with E. Stepping from E4 up
    // one degree lands on F and must be nudged off it.
    const p = motifPitch({
      keyRoot: 0,
      scale: 'major',
      floor: 48,
      ceiling: 84,
      chord: C,
      previousPitch: 64,
      step: 1,
    });
    expect(clashesWithChord(p, C)).toBe(false);
  });
});
