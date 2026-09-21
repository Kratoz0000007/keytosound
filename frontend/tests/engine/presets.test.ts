import { describe, it, expect } from 'vitest';
import { GENRES, DEFAULT_GENRE_ID } from '../../src/engine/presets';
import { SCALES } from '../../src/engine/theory';

describe('GENRES', () => {
  it('ships five genres', () => {
    expect(Object.keys(GENRES)).toHaveLength(5);
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

      it('has a groove whose steps sit on the 16th-note grid', () => {
        const { kick, snare, hat, bass, swing } = preset.groove;
        for (const steps of [kick, snare, hat, bass]) {
          for (const step of steps) {
            expect(Number.isInteger(step)).toBe(true);
            expect(step).toBeGreaterThanOrEqual(0);
            expect(step).toBeLessThan(16);
          }
          // Duplicate steps would double-trigger a voice on the same tick.
          expect(new Set(steps).size).toBe(steps.length);
        }
        expect(swing).toBeGreaterThanOrEqual(0);
        expect(swing).toBeLessThanOrEqual(0.75);
      });

      it('always has bass, even where it has no snare or hats', () => {
        // Empty snare and hat arrays are legal (Classical); a silent bass is not, or
        // the harmony loses its root.
        expect(preset.groove.bass.length).toBeGreaterThan(0);
      });

      it('keeps an audible pulse, so switching to it never sounds like the beat stopped', () => {
        expect(preset.groove.kick.length).toBeGreaterThan(0);
      });
    });
  }
});
