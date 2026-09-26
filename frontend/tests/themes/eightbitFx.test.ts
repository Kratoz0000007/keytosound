import { describe, it, expect } from 'vitest';
import {
  makeColumn,
  RAIN,
  rainBoost,
  recycle,
  SHADES,
  shadeOf,
  stepColumn,
} from '../../src/themes/eightbit/stage';
import { eightbitEffects, hexFragment } from '../../src/themes/fx/eightbit';

describe('eightbitEffects', () => {
  it('throws hex fragments on letters only; digits are drums', () => {
    expect(eightbitEffects('a')).toEqual({ fragments: true, glitch: false });
    expect(eightbitEffects('Q')).toEqual({ fragments: true, glitch: false });
    expect(eightbitEffects('7')).toEqual({ fragments: false, glitch: false });
  });

  it('glitches the interface on space and Enter', () => {
    expect(eightbitEffects(' ')).toEqual({ fragments: false, glitch: true });
    expect(eightbitEffects('Enter')).toEqual({ fragments: false, glitch: true });
  });

  it('ignores punctuation and other named keys', () => {
    expect(eightbitEffects(',')).toEqual({ fragments: false, glitch: false });
    expect(eightbitEffects('Backspace')).toEqual({ fragments: false, glitch: false });
  });
});

describe('hexFragment', () => {
  it('reads 0x, or two hex digits', () => {
    expect(hexFragment(() => 0.1)).toBe('0x');
    expect(hexFragment(() => 0.99)).toBe('FF');
    for (let i = 0; i < 50; i++) expect(hexFragment()).toMatch(/^(0x|[0-9A-F]{2})$/);
  });
});

describe('rainBoost', () => {
  it('falls at its own pace at rest', () => {
    expect(rainBoost(0)).toBe(1);
  });

  it('speeds up exponentially: each 35 wpm doubles it', () => {
    expect(rainBoost(35)).toBeCloseTo(2);
    expect(rainBoost(70)).toBeCloseTo(4);
  });

  it('is capped, so the storm stays readable', () => {
    expect(rainBoost(500)).toBe(RAIN.maxBoost);
  });
});

describe('rain columns', () => {
  const ROWS = 40;

  it('writes a fresh glyph into every row the head enters', () => {
    const column = makeColumn(0, ROWS, () => 0.5);
    column.head = 3.5;
    column.speed = 10;
    column.glyphs.fill(9);
    stepColumn(column, 0.5, 1, ROWS, () => 0.1);
    // The head moved from 3.5 to 8.5: rows 4 to 8 are new.
    expect(Array.from(column.glyphs.slice(3, 10))).toEqual([9, 1, 1, 1, 1, 1, 9]);
  });

  it('recycles in place once its tail clears the bottom, waiting above the top', () => {
    const column = makeColumn(0, ROWS, () => 0.5);
    const glyphs = column.glyphs;
    column.length = 10;
    column.head = ROWS + 9.9;
    stepColumn(column, 0.1, 1, ROWS, () => 0.5);
    expect(column.head).toBeLessThanOrEqual(0);
    expect(column.glyphs).toBe(glyphs);
  });

  it('gives each fall its own speed and length', () => {
    const column = makeColumn(0, ROWS, () => 0);
    recycle(column, ROWS, () => 0.99, false);
    expect(column.speed).toBeGreaterThan(RAIN.maxSpeed * 0.9);
    expect(column.length).toBeGreaterThan(RAIN.maxLength * 0.9);
  });
});

describe('shadeOf', () => {
  it('whites out the head and fades the trail toward the last shade', () => {
    expect(shadeOf(0, 20)).toBe(0);
    expect(shadeOf(1, 20)).toBe(1);
    expect(shadeOf(19, 20)).toBe(SHADES - 1);
    for (let k = 1; k < 20; k++) expect(shadeOf(k, 20)).toBeGreaterThanOrEqual(shadeOf(k - 1, 20));
  });
});
