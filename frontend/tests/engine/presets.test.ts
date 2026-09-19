import { describe, it, expect } from 'vitest';
import { GENRES, DEFAULT_GENRE_ID } from '../../src/engine/presets';
import { SCALES } from '../../src/engine/theory';

describe('GENRES', () => {
  it('ships exactly three genres', () => {
    expect(Object.keys(GENRES)).toHaveLength(3);
  });

  it('has a valid default', () => {
    expect(GENRES[DEFAULT_GENRE_ID]).toBeDefined();
  });

  for (const [id, preset] of Object.entries(GENRES)) {
    describe(id, () => {
      it('uses a pentatonic scale', () => {
        expect(SCALES[preset.scale]).toBeDefined();
      });

      it('has a non-empty chord progression', () => {
        expect(preset.progression.length).toBeGreaterThan(0);
        for (const chord of preset.progression) {
          expect(chord.intervals.length).toBeGreaterThanOrEqual(3);
        }
      });

      it('has a plausible tempo', () => {
        expect(preset.bpm).toBeGreaterThanOrEqual(60);
        expect(preset.bpm).toBeLessThanOrEqual(180);
      });

      it('has a positive weight for every scoring term', () => {
        for (const value of Object.values(preset.weights)) {
          expect(value).toBeGreaterThan(0);
        }
      });

      it('has a positive temperature', () => {
        expect(preset.temperature).toBeGreaterThan(0);
      });

      it('has its id matching its key', () => {
        expect(preset.id).toBe(id);
      });
    });
  }
});
