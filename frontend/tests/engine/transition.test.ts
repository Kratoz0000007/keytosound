import { describe, it, expect } from 'vitest';
import { generateCandidates, selectNextPitch } from '../../src/engine/transition';
import { GENRES } from '../../src/engine/presets';
import { createPrng } from '../../src/engine/prng';
import { SCALES, pitchClass } from '../../src/engine/theory';
import type { MappedParams, MusicalState } from '../../src/engine/types';

const preset = GENRES.lofi;

function state(overrides: Partial<MusicalState> = {}): MusicalState {
  return {
    keyRoot: preset.keyRoot,
    scale: preset.scale,
    progression: preset.progression,
    chordIndex: 0,
    previousPitch: preset.centerPitch,
    contourDirection: 0,
    contourMomentum: 0,
    lastIntervalSize: 0,
    phrasePosition: 0.4,
    energy: 0.5,
    tension: 0.4,
    recentPitches: [],
    beatPosition: 0,
    ...overrides,
  };
}

function params(overrides: Partial<MappedParams> = {}): MappedParams {
  return {
    durationBeats: 0.5,
    subdivision: 8,
    velocity: 0.7,
    leapAllowance: 5,
    gestureShape: 'flat',
    forceResolution: false,
    isRest: false,
    targetTension: 0.4,
    advanceChord: false,
    descendOnly: false,
    ...overrides,
  };
}

describe('generateCandidates', () => {
  it('returns only pitches in the active scale', () => {
    const degrees = SCALES[preset.scale];
    for (const pitch of generateCandidates(state(), preset)) {
      expect(degrees).toContain(pitchClass(pitch - preset.keyRoot));
    }
  });

  it('stays within an octave either side of the previous pitch', () => {
    const s = state({ previousPitch: 69 });
    for (const pitch of generateCandidates(s, preset)) {
      expect(Math.abs(pitch - 69)).toBeLessThanOrEqual(12);
    }
  });

  it('never returns an empty candidate set', () => {
    expect(generateCandidates(state({ previousPitch: 20 }), preset).length).toBeGreaterThan(0);
    expect(generateCandidates(state({ previousPitch: 120 }), preset).length).toBeGreaterThan(0);
  });
});

describe('selectNextPitch', () => {
  it('is deterministic for a given seed', () => {
    const a = createPrng(7);
    const b = createPrng(7);
    expect(selectNextPitch(state(), params(), preset, a)).toBe(
      selectNextPitch(state(), params(), preset, b),
    );
  });

  it('always returns a pitch in the active scale', () => {
    const rng = createPrng(3);
    const degrees = SCALES[preset.scale];
    let s = state();
    for (let i = 0; i < 300; i++) {
      const pitch = selectNextPitch(s, params(), preset, rng);
      expect(degrees).toContain(pitchClass(pitch - preset.keyRoot));
      s = { ...s, previousPitch: pitch };
    }
  });

  it('keeps the melody inside sane register bounds over a long run', () => {
    const rng = createPrng(11);
    let s = state();
    for (let i = 0; i < 500; i++) {
      const pitch = selectNextPitch(s, params(), preset, rng);
      expect(pitch).toBeGreaterThan(preset.centerPitch - 30);
      expect(pitch).toBeLessThan(preset.centerPitch + 30);
      s = {
        ...s,
        previousPitch: pitch,
        recentPitches: [...s.recentPitches, pitch].slice(-8),
      };
    }
  });

  it('resolves to a tonic chord tone when resolution is forced', () => {
    const rng = createPrng(5);
    const tonic = preset.progression[0];
    const tonicPcs = tonic.intervals.map((iv) => pitchClass(tonic.root + iv));
    for (let i = 0; i < 40; i++) {
      const pitch = selectNextPitch(
        state({ previousPitch: 71 + (i % 5) }),
        params({ forceResolution: true }),
        preset,
        rng,
      );
      expect(tonicPcs).toContain(pitchClass(pitch));
    }
  });

  it('follows a large leap with motion in the opposite direction', () => {
    const rng = createPrng(13);
    let reversals = 0;
    const trials = 60;
    for (let i = 0; i < trials; i++) {
      const s = state({
        previousPitch: 81,
        contourDirection: 1,
        lastIntervalSize: 9,
      });
      const pitch = selectNextPitch(s, params(), preset, rng);
      if (pitch < 81) reversals += 1;
    }
    expect(reversals / trials).toBeGreaterThan(0.8);
  });

  it('does not repeat one pitch indefinitely', () => {
    const rng = createPrng(17);
    let s = state();
    const emitted: number[] = [];
    for (let i = 0; i < 60; i++) {
      const pitch = selectNextPitch(s, params(), preset, rng);
      emitted.push(pitch);
      s = { ...s, previousPitch: pitch, recentPitches: emitted.slice(-8) };
    }
    expect(new Set(emitted).size).toBeGreaterThan(3);
  });

  it('only ever picks a lower pitch when descendOnly is set', () => {
    const rng = createPrng(29);
    for (let i = 0; i < 60; i++) {
      const pitch = selectNextPitch(
        state({ previousPitch: 72 }),
        params({ descendOnly: true }),
        preset,
        rng,
      );
      expect(pitch).not.toBeNull();
      expect(pitch!).toBeLessThan(72);
    }
  });

  it('returns null when descending has nowhere left to go', () => {
    // At the bottom of the register there is no candidate below, so erasing
    // falls silent rather than inventing a note.
    const floor = preset.centerPitch - preset.registerSpread * 2;
    const pitch = selectNextPitch(
      state({ previousPitch: floor }),
      params({ descendOnly: true }),
      preset,
      createPrng(31),
    );
    expect(pitch).toBeNull();
  });

  it('a lower temperature produces less variety than a higher one', () => {
    const cold = { ...preset, temperature: 0.05 };
    const hot = { ...preset, temperature: 3 };
    const sample = (p: typeof preset) => {
      const rng = createPrng(23);
      const out = new Set<number>();
      for (let i = 0; i < 80; i++) out.add(selectNextPitch(state(), params(), p, rng));
      return out.size;
    };
    expect(sample(cold)).toBeLessThan(sample(hot));
  });
});
