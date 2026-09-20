import { describe, it, expect } from 'vitest';
import { mapFeatures } from '../../src/engine/mapper';
import { GENRES } from '../../src/engine/presets';
import type { MusicalState } from '../../src/engine/types';
import type { TypingFeatures } from '../../src/typing/types';

const preset = GENRES.lofi;

function baseState(overrides: Partial<MusicalState> = {}): MusicalState {
  return {
    keyRoot: preset.keyRoot,
    scale: preset.scale,
    progression: preset.progression,
    chordIndex: 0,
    previousPitch: 69,
    contourDirection: 0,
    contourMomentum: 0,
    lastIntervalSize: 0,
    phrasePosition: 0.5,
    energy: 0.5,
    tension: 0.5,
    recentPitches: [],
    beatPosition: 0,
    ...overrides,
  };
}

function baseFeatures(overrides: Partial<TypingFeatures> = {}): TypingFeatures {
  return {
    interval: 200,
    speed: 40,
    wordLength: 0,
    sentencePos: 0,
    pauseDuration: 0,
    punctuation: 'none',
    isCapital: false,
    isBackspace: false,
    ...overrides,
  };
}

describe('mapFeatures', () => {
  it('gives fast typing shorter notes than slow typing', () => {
    const fast = mapFeatures(baseFeatures({ interval: 90 }), baseState(), preset);
    const slow = mapFeatures(baseFeatures({ interval: 700 }), baseState(), preset);
    expect(fast.durationBeats).toBeLessThan(slow.durationBeats);
  });

  it('uses a 16th grid at high energy and an 8th grid at low energy', () => {
    const fast = mapFeatures(baseFeatures({ speed: 90 }), baseState(), preset);
    const slow = mapFeatures(baseFeatures({ speed: 10 }), baseState(), preset);
    expect(fast.subdivision).toBe(16);
    expect(slow.subdivision).toBe(8);
  });

  it('raises velocity with typing speed', () => {
    const fast = mapFeatures(baseFeatures({ speed: 90 }), baseState(), preset);
    const slow = mapFeatures(baseFeatures({ speed: 10 }), baseState(), preset);
    expect(fast.velocity).toBeGreaterThan(slow.velocity);
  });

  it('accents capitals and exclamation marks', () => {
    const plain = mapFeatures(baseFeatures(), baseState(), preset);
    const capital = mapFeatures(baseFeatures({ isCapital: true }), baseState(), preset);
    const bang = mapFeatures(baseFeatures({ punctuation: 'exclamation' }), baseState(), preset);
    expect(capital.velocity).toBeGreaterThan(plain.velocity);
    expect(bang.velocity).toBeGreaterThan(plain.velocity);
  });

  it('keeps velocity within 0..1', () => {
    const loud = mapFeatures(
      baseFeatures({ speed: 200, isCapital: true, punctuation: 'exclamation' }),
      baseState(),
      preset,
    );
    expect(loud.velocity).toBeLessThanOrEqual(1);
    expect(loud.velocity).toBeGreaterThan(0);
  });

  it('gives long words a larger leap allowance than short words', () => {
    const short = mapFeatures(baseFeatures({ wordLength: 2 }), baseState(), preset);
    const long = mapFeatures(baseFeatures({ wordLength: 11 }), baseState(), preset);
    expect(long.leapAllowance).toBeGreaterThan(short.leapAllowance);
  });

  it('never drops the leap allowance below one pentatonic step', () => {
    // Pentatonic degrees sit 2-3 semitones apart. An allowance below that
    // makes ordinary stepwise motion score as badly as a leap, which pushes
    // the transition engine into wild jumps instead of smooth lines.
    const midWord = mapFeatures(baseFeatures({ wordLength: 0 }), baseState(), preset);
    expect(midWord.leapAllowance).toBeGreaterThanOrEqual(4);
  });

  it('gives long words an arch gesture and short words a small rise', () => {
    const short = mapFeatures(baseFeatures({ wordLength: 2 }), baseState(), preset);
    const long = mapFeatures(baseFeatures({ wordLength: 9 }), baseState(), preset);
    expect(short.gestureShape).toBe('rise');
    expect(long.gestureShape).toBe('arch');
  });

  it('forces resolution on a period', () => {
    const p = mapFeatures(baseFeatures({ punctuation: 'period' }), baseState(), preset);
    expect(p.forceResolution).toBe(true);
    expect(p.targetTension).toBe(0);
    expect(p.gestureShape).toBe('fall');
  });

  it('rests on a comma', () => {
    const p = mapFeatures(baseFeatures({ punctuation: 'comma' }), baseState(), preset);
    expect(p.isRest).toBe(true);
  });

  it('leaves a question unresolved and rising', () => {
    const p = mapFeatures(baseFeatures({ punctuation: 'question' }), baseState(), preset);
    expect(p.targetTension).toBeGreaterThan(0.8);
    expect(p.gestureShape).toBe('rise');
    expect(p.forceResolution).toBe(false);
  });

  it('advances the chord on a completed word', () => {
    const mid = mapFeatures(baseFeatures({ wordLength: 0 }), baseState(), preset);
    const boundary = mapFeatures(baseFeatures({ wordLength: 4 }), baseState(), preset);
    expect(mid.advanceChord).toBe(false);
    expect(boundary.advanceChord).toBe(true);
  });

  it('makes backspace a quiet, brief, descending gesture', () => {
    const typing = mapFeatures(baseFeatures(), baseState(), preset);
    const erasing = mapFeatures(baseFeatures({ isBackspace: true }), baseState(), preset);
    expect(erasing.descendOnly).toBe(true);
    expect(erasing.gestureShape).toBe('fall');
    expect(erasing.velocity).toBeLessThan(typing.velocity);
    expect(erasing.durationBeats).toBeLessThanOrEqual(0.25);
    expect(erasing.leapAllowance).toBeLessThan(typing.leapAllowance);
  });

  it('does not advance the harmony while erasing', () => {
    // Deleting a word must not push the chord progression forward, or holding
    // backspace would race through the changes.
    const erasing = mapFeatures(
      baseFeatures({ isBackspace: true, wordLength: 5 }),
      baseState(),
      preset,
    );
    expect(erasing.advanceChord).toBe(false);
  });

  it('does not force a resolution while erasing', () => {
    const erasing = mapFeatures(
      baseFeatures({ isBackspace: true, punctuation: 'period' }),
      baseState(),
      preset,
    );
    expect(erasing.forceResolution).toBe(false);
  });

  it('lengthens the note after a long pause', () => {
    const normal = mapFeatures(baseFeatures({ interval: 200 }), baseState(), preset);
    const paused = mapFeatures(
      baseFeatures({ interval: 1500, pauseDuration: 1500 }),
      baseState(),
      preset,
    );
    expect(paused.durationBeats).toBeGreaterThan(normal.durationBeats);
  });
});
