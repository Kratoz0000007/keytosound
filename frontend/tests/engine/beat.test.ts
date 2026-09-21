import { describe, expect, it } from 'vitest';
import { BeatPattern, VOICES, stepAt } from '../../src/engine/beat';
import { GENRES } from '../../src/engine/presets';

const lofi = GENRES.lofi;
const SIXTEENTH = 60000 / lofi.bpm / 4; // 200ms at 75bpm
const BAR = SIXTEENTH * 16;

describe('stepAt', () => {
  it('rounds to the nearest 16th within the bar', () => {
    expect(stepAt(0, lofi.bpm)).toEqual({ bar: 0, step: 0 });
    expect(stepAt(SIXTEENTH * 3 + 40, lofi.bpm)).toEqual({ bar: 0, step: 3 });
    expect(stepAt(SIXTEENTH * 3 + 120, lofi.bpm)).toEqual({ bar: 0, step: 4 });
  });

  it('wraps the last half-step of a bar onto the next downbeat', () => {
    expect(stepAt(BAR - 10, lofi.bpm)).toEqual({ bar: 1, step: 0 });
  });
});

describe('BeatPattern', () => {
  it('maps digits 1-9 onto the nine voices in order', () => {
    expect(VOICES).toEqual([
      'kick', 'snare', 'hat', 'openHat', 'clap', 'perc', 'bass', 'stab', 'fx',
    ]);
  });

  it('starts from the genre groove', () => {
    const beat = new BeatPattern(lofi.groove, lofi.bpm);
    expect(beat.has('kick', 0)).toBe(true);
    expect(beat.has('clap', 4)).toBe(false);
  });

  it('adds a hit where there was none', () => {
    const beat = new BeatPattern(lofi.groove, lofi.bpm);
    const edit = beat.press(5, SIXTEENTH * 4); // clap on step 4
    expect(edit).toMatchObject({ voice: 'clap', step: 4, added: true });
    expect(beat.has('clap', 4)).toBe(true);
  });

  it('removes a hit that was already there (toggle is its own inverse)', () => {
    const beat = new BeatPattern(lofi.groove, lofi.bpm);
    const edit = beat.press(1, 0); // kick on step 0, present in the preset
    expect(edit).toMatchObject({ voice: 'kick', step: 0, added: false });
    expect(beat.has('kick', 0)).toBe(false);
    beat.press(1, BAR * 3); // step 0 of a later bar
    expect(beat.has('kick', 0)).toBe(true);
  });

  it('resets to the preset on 0', () => {
    const beat = new BeatPattern(lofi.groove, lofi.bpm);
    beat.press(1, 0);
    beat.press(5, SIXTEENTH * 4);
    const edit = beat.press(0, 999);
    expect(edit).toMatchObject({ voice: null });
    expect(beat.has('kick', 0)).toBe(true);
    expect(beat.has('clap', 4)).toBe(false);
  });

  it('reports when the targeted step has already gone by, so audio can play it now', () => {
    const beat = new BeatPattern(lofi.groove, lofi.bpm);
    expect(beat.press(5, SIXTEENTH * 4 + 50)?.stepTimeMs).toBe(SIXTEENTH * 4);
    expect(beat.press(5, SIXTEENTH * 6 - 50)?.stepTimeMs).toBe(SIXTEENTH * 6);
  });

  it('does not share state with the preset it started from', () => {
    const beat = new BeatPattern(lofi.groove, lofi.bpm);
    beat.press(1, 0);
    expect(lofi.groove.kick).toContain(0);
  });
});
