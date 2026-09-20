import { describe, it, expect } from 'vitest';
import {
  scoreInterval,
  scoreChordTone,
  scoreRegister,
  scoreContour,
  scoreRepetition,
  scoreTension,
} from '../../src/engine/scoring';
import type { ContourContext } from '../../src/engine/scoring';

const cMajor = { root: 0, intervals: [0, 4, 7] };

describe('scoreInterval', () => {
  it('prefers stepwise motion over leaps', () => {
    expect(scoreInterval(62, 60, 5)).toBeGreaterThan(scoreInterval(72, 60, 5));
  });

  it('decays monotonically with distance', () => {
    const scores = [61, 63, 65, 67, 69].map((p) => scoreInterval(p, 60, 5));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThan(scores[i - 1]);
    }
  });

  it('a larger leap allowance makes big intervals more acceptable', () => {
    expect(scoreInterval(70, 60, 10)).toBeGreaterThan(scoreInterval(70, 60, 3));
  });

  it('penalises repeating the same pitch', () => {
    expect(scoreInterval(60, 60, 5)).toBeLessThan(scoreInterval(62, 60, 5));
  });

  it('always returns a positive score', () => {
    expect(scoreInterval(100, 60, 2)).toBeGreaterThan(0);
  });
});

/** maxScaleStep for the pentatonic scales the first three genres use. */
const PENTATONIC_STEP = 3;
/** maxScaleStep for the seven-note modes Jazz and Classical use. */
const DIATONIC_STEP = 2;

describe('scoreChordTone', () => {
  it('prefers chord tones, especially on strong beats', () => {
    const strong = scoreChordTone(64, 62, cMajor, true, PENTATONIC_STEP);
    const weak = scoreChordTone(64, 62, cMajor, false, PENTATONIC_STEP);
    expect(strong).toBeGreaterThan(weak);
  });

  it('scores a chord tone above a non-chord tone', () => {
    expect(scoreChordTone(64, 62, cMajor, true, PENTATONIC_STEP)).toBeGreaterThan(
      scoreChordTone(62, 60, cMajor, true, PENTATONIC_STEP),
    );
  });

  it('allows a non-chord tone approached by step', () => {
    const byStep = scoreChordTone(62, 60, cMajor, false, PENTATONIC_STEP);
    const byLeap = scoreChordTone(62, 55, cMajor, false, PENTATONIC_STEP);
    expect(byStep).toBeGreaterThan(byLeap);
  });

  it('heavily penalises a non-chord tone reached by leap', () => {
    expect(scoreChordTone(62, 50, cMajor, true, PENTATONIC_STEP)).toBeLessThan(0.1);
  });

  it('treats a minor third as a step on pentatonic but not on a diatonic scale', () => {
    // 63 is 3 semitones above 60 and not in C major. On pentatonic that is one
    // scale step so it passes as a passing note; on a diatonic scale it is a
    // leap to a dissonance and must be blocked. Hardcoding the step size would
    // wave it through for Jazz and Classical.
    expect(scoreChordTone(63, 60, cMajor, false, PENTATONIC_STEP)).toBeGreaterThan(0.1);
    expect(scoreChordTone(63, 60, cMajor, false, DIATONIC_STEP)).toBeLessThan(0.1);
  });
});

describe('scoreRegister', () => {
  it('peaks at the centre pitch', () => {
    expect(scoreRegister(69, 69, 9)).toBeGreaterThan(scoreRegister(60, 69, 9));
    expect(scoreRegister(69, 69, 9)).toBeGreaterThan(scoreRegister(80, 69, 9));
  });

  it('is symmetric about the centre', () => {
    expect(scoreRegister(64, 69, 9)).toBeCloseTo(scoreRegister(74, 69, 9), 10);
  });

  it('a wider spread tolerates more distance', () => {
    expect(scoreRegister(84, 69, 15)).toBeGreaterThan(scoreRegister(84, 69, 6));
  });

  it('always returns a positive score', () => {
    expect(scoreRegister(20, 69, 5)).toBeGreaterThan(0);
  });
});

function ctx(overrides: Partial<ContourContext> = {}): ContourContext {
  return {
    previousPitch: 69,
    direction: 0,
    momentum: 0,
    lastIntervalSize: 0,
    shape: 'flat',
    phrasePosition: 0.5,
    ...overrides,
  };
}

describe('scoreContour', () => {
  it('after a large upward leap, strongly prefers a downward step', () => {
    const afterLeapUp = ctx({ previousPitch: 76, direction: 1, lastIntervalSize: 7 });
    const stepDown = scoreContour(74, afterLeapUp);
    const leapFurtherUp = scoreContour(83, afterLeapUp);
    expect(stepDown).toBeGreaterThan(leapFurtherUp);
    expect(stepDown).toBeGreaterThan(0.9);
  });

  it('after a large downward leap, strongly prefers an upward step', () => {
    const afterLeapDown = ctx({ previousPitch: 62, direction: -1, lastIntervalSize: 7 });
    expect(scoreContour(64, afterLeapDown)).toBeGreaterThan(scoreContour(55, afterLeapDown));
  });

  it('mildly favours continuing an established direction', () => {
    const rising = ctx({ direction: 1, momentum: 3, lastIntervalSize: 2 });
    expect(scoreContour(71, rising)).toBeGreaterThan(scoreContour(67, rising));
  });

  it('biases upward for a rise gesture and downward for a fall gesture', () => {
    expect(scoreContour(71, ctx({ shape: 'rise' }))).toBeGreaterThan(
      scoreContour(67, ctx({ shape: 'rise' })),
    );
    expect(scoreContour(67, ctx({ shape: 'fall' }))).toBeGreaterThan(
      scoreContour(71, ctx({ shape: 'fall' })),
    );
  });

  it('an arch rises in the first half of a phrase and falls in the second', () => {
    const early = ctx({ shape: 'arch', phrasePosition: 0.2 });
    const late = ctx({ shape: 'arch', phrasePosition: 0.8 });
    expect(scoreContour(71, early)).toBeGreaterThan(scoreContour(67, early));
    expect(scoreContour(67, late)).toBeGreaterThan(scoreContour(71, late));
  });

  it('always returns a positive score', () => {
    expect(scoreContour(40, ctx({ shape: 'rise' }))).toBeGreaterThan(0);
  });
});

describe('scoreRepetition', () => {
  it('gives an unused pitch the full score', () => {
    expect(scoreRepetition(64, [60, 62, 67])).toBe(1);
  });

  it('penalises the most recent pitch hardest', () => {
    const recent = [60, 62, 67];
    expect(scoreRepetition(67, recent)).toBeLessThan(scoreRepetition(60, recent));
  });

  it('forgives a pitch as it recedes', () => {
    const recent = [64, 60, 62, 67, 69];
    expect(scoreRepetition(64, recent)).toBeGreaterThan(scoreRepetition(69, recent));
  });

  it('always returns a positive score', () => {
    expect(scoreRepetition(60, [60])).toBeGreaterThan(0);
  });
});

describe('scoreTension', () => {
  const cMajorTonic = { root: 0, intervals: [0, 4, 7] };
  const fMajor = { root: 5, intervals: [0, 4, 7] };

  it('under forced resolution, only tonic chord tones score well', () => {
    expect(scoreTension(60, fMajor, cMajorTonic, 0, true)).toBe(1);
    expect(scoreTension(62, fMajor, cMajorTonic, 0, true)).toBeLessThan(0.1);
  });

  it('at low target tension, prefers current chord tones', () => {
    expect(scoreTension(65, fMajor, cMajorTonic, 0, false)).toBeGreaterThan(
      scoreTension(62, fMajor, cMajorTonic, 0, false),
    );
  });

  it('at high target tension, prefers non-chord tones', () => {
    expect(scoreTension(62, fMajor, cMajorTonic, 1, false)).toBeGreaterThan(
      scoreTension(65, fMajor, cMajorTonic, 1, false),
    );
  });

  it('always returns a positive score', () => {
    expect(scoreTension(62, fMajor, cMajorTonic, 0, false)).toBeGreaterThan(0);
  });
});
