import { between, lerp, type Cone, type Rand } from '../stage/motion';

/**
 * The Jazz stage as plain numbers: where each spotlight points and how hot
 * it burns, and how the smoke and dust drift through the room.
 * JazzBackgroundCanvas draws from these; nothing here touches the DOM.
 */

export const SPOT = {
  idleAlpha: 0.08,
  hotAlpha: 0.15,
  /** Half the cone's spread, in radians: about 11.5 degrees idle, 7 when hot. */
  idleHalfAngle: 0.2,
  hotHalfAngle: 0.12,
  /** How far each beam leans in from straight down, toward the middle of the room. */
  aim: 0.42,
  /** How far either side of its aim a beam swings. */
  sway: 0.1,
  /** Radians of sway phase per millisecond. */
  swayRate: 0.0005,
} as const;

export const SMOKE = {
  count: 42,
  minRadius: 60,
  maxRadius: 170,
  /** Upward drift, px/s. */
  minRise: 5,
  maxRise: 14,
  /** Sideways wander at rest, px/s. */
  wobble: 7,
  /** Rightward push at full draft, px/s. */
  draftSpeed: 38,
  /** How much draft one keystroke adds, and the most there can be. */
  gust: 0.35,
  maxDraft: 1,
  /** Seconds for the draft to settle by 63%. */
  draftTau: 0.9,
} as const;

export const DUST = {
  count: 28,
  minRise: 2,
  maxRise: 7,
  /** Alpha of a mote in the dark, and the extra it gains in a beam's centre. */
  darkAlpha: 0.05,
  litAlpha: 0.55,
} as const;

/**
 * The beam hung in the top-left (side -1) or top-right (side 1) corner.
 * The two swing on mirrored sine waves, so they cross and part again.
 */
export function spotlight(
  side: -1 | 1,
  timeMs: number,
  heat: number,
  width: number,
  height: number,
): Cone {
  const swing = Math.sin(timeMs * SPOT.swayRate) * SPOT.sway;
  return {
    x: side < 0 ? -0.02 * width : 1.02 * width,
    y: -0.04 * height,
    angle: -side * SPOT.aim + swing * -side,
    halfAngle: lerp(SPOT.idleHalfAngle, SPOT.hotHalfAngle, heat),
    length: Math.hypot(width, height) * 1.15,
    alpha: lerp(SPOT.idleAlpha, SPOT.hotAlpha, heat),
  };
}

/** A puff of smoke. It keeps its size and rises until it leaves the top. */
export interface Puff {
  x: number;
  y: number;
  r: number;
  rise: number;
  phase: number;
  alpha: number;
}

/** A mote of dust, invisible until a beam catches it. */
export interface Mote {
  x: number;
  y: number;
  size: number;
  rise: number;
  phase: number;
}

/**
 * A new puff. At the start it may be anywhere in the room; a respawn enters
 * from just below the bottom edge.
 */
export function spawnPuff(width: number, height: number, rand: Rand, anywhere: boolean): Puff {
  const r = between(rand, SMOKE.minRadius, SMOKE.maxRadius);
  return {
    x: rand() * width,
    y: anywhere ? rand() * height : height + r,
    r,
    rise: between(rand, SMOKE.minRise, SMOKE.maxRise),
    phase: rand() * Math.PI * 2,
    alpha: between(rand, 0.6, 1),
  };
}

export function spawnMote(width: number, height: number, rand: Rand, anywhere: boolean): Mote {
  return {
    x: rand() * width,
    y: anywhere ? rand() * height : height + 4,
    size: between(rand, 1.2, 2.4),
    rise: between(rand, DUST.minRise, DUST.maxRise),
    phase: rand() * Math.PI * 2,
  };
}

/**
 * Moves a puff on by dt seconds: up, wandering, and pushed right by the
 * draft. A puff that leaves the top comes back in at the bottom; one blown
 * off the right edge comes back in on the left.
 */
export function stepPuff(
  puff: Puff,
  dt: number,
  timeMs: number,
  draft: number,
  width: number,
  height: number,
  rand: Rand,
): void {
  puff.x += (Math.sin(timeMs * 0.0003 + puff.phase) * SMOKE.wobble + draft * SMOKE.draftSpeed) * dt;
  puff.y -= puff.rise * dt;
  if (puff.y + puff.r < 0) Object.assign(puff, spawnPuff(width, height, rand, false));
  if (puff.x - puff.r > width) puff.x = -puff.r;
  else if (puff.x + puff.r < 0) puff.x = width + puff.r;
}

export function stepMote(
  mote: Mote,
  dt: number,
  timeMs: number,
  draft: number,
  width: number,
  height: number,
  rand: Rand,
): void {
  mote.x += (Math.sin(timeMs * 0.0007 + mote.phase) * 4 + draft * SMOKE.draftSpeed * 1.4) * dt;
  mote.y -= mote.rise * dt;
  if (mote.y < -4) Object.assign(mote, spawnMote(width, height, rand, false));
  if (mote.x > width + 4) mote.x = -4;
  else if (mote.x < -4) mote.x = width + 4;
}

/** The draft after `gusts` new keystrokes: each adds a gust, capped. */
export function gust(draft: number, gusts: number): number {
  return Math.min(SMOKE.maxDraft, draft + gusts * SMOKE.gust);
}
