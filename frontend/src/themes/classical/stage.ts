import { between, rippleEnvelope, type Cone, type Rand, type Ripple } from '../stage/motion';

/**
 * The Classical hall as plain numbers: one stave ruled faintly across the
 * whole room, ripples of sound running along it from the caret, gold dust
 * on the air, and the ceiling light that comes up when the playing gets
 * quick. ClassicalBackgroundCanvas draws from these.
 */

export const STAVE = {
  /** Where the stave's middle line sits, as a fraction of the window's height. */
  centre: 0.42,
  gap: 14,
  /** rgba(197, 160, 89, 0.05): ruled so faint it is felt more than seen. */
  alpha: 0.05,
  /** Extra alpha a line gains while a ripple crosses it. */
  rippleAlpha: 0.22,
  /** The ripple's carrier: sin(x * k - t * w), t in ms. */
  k: 0.02,
  w: 0.002,
  amplitude: 7,
  /** px/s the ripple front runs outward from the caret. */
  speed: 520,
  lifeS: 1.8,
  /** Half-width of the band of stave that moves at once, px. */
  band: 160,
  /** How far above or below the caret a ripple still reaches the stave, px. */
  reach: 520,
  /** Ripples kept at once; typing faster than they fade drops the oldest. */
  maxRipples: 24,
} as const;

export const DUST = {
  count: 32,
  minRadius: 3,
  maxRadius: 8,
  /** Upward drift on the hall's warm air, px/s. */
  minRise: 6,
  maxRise: 16,
  /** Sideways sway of the convection currents, px/s. */
  current: 9,
  /** A mote's glow at its heart: rgba(212, 175, 55, 0.15) fading to nothing. */
  alpha: 0.15,
  /** How much brighter a mote burns in the middle of the ceiling light. */
  litBoost: 4,
} as const;

export const CEILING = {
  /** rgba(197, 160, 89, 0.06) at full heat, nothing at rest. */
  alpha: 0.06,
  halfAngle: 0.3,
  /** A slow drift either side of straight down, radians. */
  sway: 0.03,
} as const;

/** The y of stave line i (0 top, 4 bottom) in a window this tall. */
export function staveLineY(i: number, height: number): number {
  return height * STAVE.centre + (i - 2) * STAVE.gap;
}

/**
 * How strongly the ripples move a stave line at x, 0..1. Overlapping
 * ripples add, up to a full swing.
 */
export function staveEnergy(ripples: readonly Ripple[], x: number, lineY: number, nowMs: number): number {
  let energy = 0;
  for (const r of ripples) {
    energy += rippleEnvelope(r, x, lineY, nowMs, STAVE.speed, STAVE.lifeS, STAVE.band, STAVE.reach);
  }
  return Math.min(1, energy);
}

/** How far the stave line at lineY is pushed off true at x, in px. */
export function staveOffset(ripples: readonly Ripple[], x: number, lineY: number, nowMs: number): number {
  const energy = staveEnergy(ripples, x, lineY, nowMs);
  return energy === 0 ? 0 : STAVE.amplitude * energy * Math.sin(x * STAVE.k - nowMs * STAVE.w);
}

/** Drops ripples that have died away, and the oldest past the cap. */
export function liveRipples(ripples: Ripple[], nowMs: number): Ripple[] {
  const alive = ripples.filter((r) => nowMs - r.bornMs < STAVE.lifeS * 1000);
  return alive.slice(-STAVE.maxRipples);
}

/** The ceiling light: straight down from the top centre, swaying a little. */
export function ceilingLight(timeMs: number, heat: number, width: number, height: number): Cone {
  return {
    x: width / 2,
    y: -0.06 * height,
    angle: Math.sin(timeMs * 0.0003) * CEILING.sway,
    halfAngle: CEILING.halfAngle,
    length: height * 1.3,
    alpha: CEILING.alpha * heat,
  };
}

export interface Mote {
  x: number;
  y: number;
  r: number;
  rise: number;
  phase: number;
}

export function spawnMote(width: number, height: number, rand: Rand, anywhere: boolean): Mote {
  const r = between(rand, DUST.minRadius, DUST.maxRadius);
  return {
    x: rand() * width,
    y: anywhere ? rand() * height : height + r,
    r,
    rise: between(rand, DUST.minRise, DUST.maxRise),
    phase: rand() * Math.PI * 2,
  };
}

/** Carries a mote up on the warm air, swaying with the currents; it re-enters at the bottom. */
export function stepMote(mote: Mote, dt: number, timeMs: number, width: number, height: number, rand: Rand) {
  mote.x += Math.sin(timeMs * 0.0004 + mote.phase) * DUST.current * dt;
  mote.y -= mote.rise * dt;
  if (mote.y + mote.r < 0) Object.assign(mote, spawnMote(width, height, rand, false));
  if (mote.x > width + mote.r) mote.x = -mote.r;
  else if (mote.x < -mote.r) mote.x = width + mote.r;
}
