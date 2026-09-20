import { describe, it, expect } from 'vitest';
import { layoutNotes, type LayoutOptions, type VisualNote } from '../../src/ui/visualizerLayout';

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
