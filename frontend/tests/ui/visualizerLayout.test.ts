import { describe, it, expect } from 'vitest';
import {
  layoutNotes,
  matrixLevels,
  scopeWave,
  type LayoutOptions,
  type MatrixOptions,
  type ScopeOptions,
  type VisualNote,
} from '../../src/ui/visualizerLayout';

const opts: LayoutOptions = {
  width: 800,
  height: 200,
  windowMs: 4000,
  now: 10000,
  minPitch: 48,
  maxPitch: 84,
};

const note = (o: Partial<VisualNote> = {}): VisualNote => ({
  pitch: 66,
  at: 10000,
  durationBeats: 1,
  velocity: 0.8,
  ...o,
});

describe('layoutNotes', () => {
  it('places the newest note at the right edge', () => {
    const [bar] = layoutNotes([note({ at: 10000 })], opts);
    expect(bar.x + bar.w).toBeCloseTo(800, 0);
  });

  it('places an older note further left', () => {
    const [recent] = layoutNotes([note({ at: 10000 })], opts);
    const [older] = layoutNotes([note({ at: 8000 })], opts);
    expect(older.x).toBeLessThan(recent.x);
  });

  it('drops notes older than the window', () => {
    expect(layoutNotes([note({ at: 5000 })], opts)).toHaveLength(0);
  });

  it('puts higher pitches higher on the canvas', () => {
    const [high] = layoutNotes([note({ pitch: 80 })], opts);
    const [low] = layoutNotes([note({ pitch: 52 })], opts);
    expect(high.y).toBeLessThan(low.y);
  });

  it('keeps every bar inside the canvas', () => {
    const notes = [48, 60, 72, 84].map((pitch) => note({ pitch }));
    for (const bar of layoutNotes(notes, opts)) {
      expect(bar.y).toBeGreaterThanOrEqual(0);
      expect(bar.y + bar.h).toBeLessThanOrEqual(200);
    }
  });

  it('clamps pitches outside the declared range instead of drawing off-canvas', () => {
    const [above] = layoutNotes([note({ pitch: 120 })], opts);
    expect(above.y).toBeGreaterThanOrEqual(0);
    const [below] = layoutNotes([note({ pitch: 12 })], opts);
    expect(below.y + below.h).toBeLessThanOrEqual(200);
  });

  it('makes louder notes more opaque', () => {
    const [loud] = layoutNotes([note({ velocity: 1 })], opts);
    const [quiet] = layoutNotes([note({ velocity: 0.2 })], opts);
    expect(loud.alpha).toBeGreaterThan(quiet.alpha);
  });

  it('makes longer notes wider', () => {
    const [long] = layoutNotes([note({ durationBeats: 2 })], opts);
    const [short] = layoutNotes([note({ durationBeats: 0.25 })], opts);
    expect(long.w).toBeGreaterThan(short.w);
  });

  it('gives every bar a visible width', () => {
    const [tiny] = layoutNotes([note({ durationBeats: 0.01 })], opts);
    expect(tiny.w).toBeGreaterThanOrEqual(2);
  });
});

describe('matrixLevels', () => {
  const matrix: MatrixOptions = {
    columns: 11,
    rows: 10,
    now: 10000,
    minPitch: 50,
    maxPitch: 60,
    decayMs: 600,
  };

  it('is dark when nothing has played', () => {
    expect(matrixLevels([], matrix)).toEqual(new Array(11).fill(0));
  });

  it("lights a fresh note's column to its velocity, and its neighbours half as high", () => {
    const levels = matrixLevels([note({ pitch: 55, velocity: 1 })], matrix);
    expect(levels[5]).toBe(10);
    expect(levels[4]).toBe(5);
    expect(levels[6]).toBe(5);
    expect(levels[0]).toBe(0);
  });

  it('lets a column fall as its note ages', () => {
    const fresh = matrixLevels([note({ pitch: 55, velocity: 1, at: 10000 })], matrix);
    const older = matrixLevels([note({ pitch: 55, velocity: 1, at: 9700 })], matrix);
    expect(older[5]).toBeLessThan(fresh[5]);
    expect(older[5]).toBeGreaterThan(0);
  });

  it('goes dark once a note is older than the decay', () => {
    expect(matrixLevels([note({ pitch: 55, velocity: 1, at: 9400 })], matrix)[5]).toBe(0);
  });

  it('keeps the louder note when two share a column', () => {
    const levels = matrixLevels(
      [note({ pitch: 55, velocity: 0.3 }), note({ pitch: 55, velocity: 0.9 })],
      matrix,
    );
    expect(levels[5]).toBe(9);
  });

  it('clamps pitches outside the range to the edge columns', () => {
    const levels = matrixLevels([note({ pitch: 20 }), note({ pitch: 99 })], matrix);
    expect(levels[0]).toBeGreaterThan(0);
    expect(levels[10]).toBeGreaterThan(0);
  });
});

describe('scopeWave', () => {
  const scope: ScopeOptions = {
    samples: 101,
    now: 10000,
    minPitch: 48,
    maxPitch: 88,
    decayMs: 1200,
  };
  const peak = (wave: number[]) => Math.max(...wave.map(Math.abs));

  it('is a flat line when nothing is ringing', () => {
    expect(peak(scopeWave([], scope))).toBe(0);
  });

  it('swings when a note has just played', () => {
    expect(peak(scopeWave([note({ velocity: 1 })], scope))).toBeGreaterThan(0.3);
  });

  it('settles as the note decays, and is flat once it has', () => {
    const fresh = peak(scopeWave([note({ velocity: 1, at: 10000 })], scope));
    const older = peak(scopeWave([note({ velocity: 1, at: 9400 })], scope));
    expect(older).toBeLessThan(fresh);
    expect(peak(scopeWave([note({ velocity: 1, at: 8700 })], scope))).toBe(0);
  });

  it('tapers to zero at both edges', () => {
    const wave = scopeWave([note({ velocity: 1 })], scope);
    expect(Math.abs(wave[0])).toBeLessThan(1e-9);
    expect(Math.abs(wave[100])).toBeLessThan(1e-9);
  });

  it('stays inside (-1, 1) however many notes stack up', () => {
    const chord = [50, 55, 60, 64, 67, 72].map((pitch) => note({ pitch, velocity: 1 }));
    expect(peak(scopeWave(chord, scope))).toBeLessThan(1);
  });
});
