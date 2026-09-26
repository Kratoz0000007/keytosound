import { between, type Rand } from '../stage/motion';

/**
 * The Cyber-Terminal binary rain as plain numbers: columns of 0s and 1s
 * falling at their own speeds, the whole storm speeding up exponentially
 * as the typing gets faster. TerminalBackgroundCanvas draws from these;
 * nothing here touches the DOM.
 */

export const RAIN = {
  /** One glyph cell, px, both ways. */
  cell: 16,
  /** Rows per second a column falls at rest. */
  minSpeed: 6,
  maxSpeed: 28,
  /** Rows in a column's trail. */
  minLength: 10,
  maxLength: 44,
  /** How bright a column burns: dim ones read as further away. */
  minDepth: 0.35,
  /** How far above the top a recycled column may wait, as a fraction of the rows. */
  maxDelay: 0.25,
  /** The typing speed that doubles the rain's speed, and the most it can be boosted. */
  doublingWpm: 35,
  maxBoost: 8,
  /** Chance per second that any lit glyph flips between 0 and 1. */
  flipRate: 1.2,
} as const;

/** The trail's shades, head first: white, then phosphor green fading to nothing. */
export const SHADES = 8;

/**
 * How much faster than at rest the rain falls at this typing speed: it
 * doubles every 35 wpm, so the storm runs away as the typing speeds up,
 * capped at 8x.
 */
export function rainBoost(wpm: number): number {
  return Math.min(RAIN.maxBoost, Math.pow(2, Math.max(0, wpm) / RAIN.doublingWpm));
}

/**
 * One falling column. Its glyphs live in a fixed array, one per row of the
 * screen, written as the head reaches each row; the column is recycled in
 * place when its tail clears the bottom, so the rain never allocates.
 */
export interface Column {
  x: number;
  /** The head's row, fractional; negative while it waits above the screen. */
  head: number;
  speed: number;
  length: number;
  depth: number;
  glyphs: Uint8Array;
}

/** Gives a column a fresh fall: new speed, length and brightness, waiting above the top. */
export function recycle(column: Column, rows: number, rand: Rand, anywhere: boolean): void {
  column.speed = between(rand, RAIN.minSpeed, RAIN.maxSpeed);
  column.length = Math.round(between(rand, RAIN.minLength, RAIN.maxLength));
  column.depth = between(rand, RAIN.minDepth, 1);
  column.head = anywhere ? between(rand, -rows * RAIN.maxDelay, rows) : -between(rand, 0, rows * RAIN.maxDelay);
  if (anywhere) {
    for (let r = 0; r < column.glyphs.length; r++) column.glyphs[r] = rand() < 0.5 ? 1 : 0;
  }
}

export function makeColumn(x: number, rows: number, rand: Rand): Column {
  const column: Column = { x, head: 0, speed: 0, length: 0, depth: 0, glyphs: new Uint8Array(rows) };
  recycle(column, rows, rand, true);
  return column;
}

/**
 * Moves a column on by dt seconds at `boost` times its own speed, writing a
 * new random glyph into every row the head enters, and recycles it once
 * its tail has fallen past the bottom.
 */
export function stepColumn(column: Column, dt: number, boost: number, rows: number, rand: Rand): void {
  const from = Math.floor(column.head);
  column.head += column.speed * boost * dt;
  const to = Math.min(Math.floor(column.head), rows - 1);
  for (let r = Math.max(0, from + 1); r <= to; r++) column.glyphs[r] = rand() < 0.5 ? 1 : 0;
  if (column.head - column.length > rows) recycle(column, rows, rand, false);
}

/**
 * Which shade the glyph k rows behind the head takes, in a trail this long:
 * 0 is the white-hot head, then the green fades toward SHADES - 1.
 */
export function shadeOf(k: number, length: number): number {
  if (k <= 0) return 0;
  return Math.min(SHADES - 1, 1 + Math.floor((k / length) * (SHADES - 1)));
}
