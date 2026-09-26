/**
 * Numbers every theme's stage canvas shares: how hot the room is running,
 * frame-rate independent easing, and spotlight geometry. Nothing here
 * touches the DOM, so all of it is testable in plain Node.
 */

/** Above this typing speed the band is cooking and a stage runs hot. */
export const HOT_WPM = 60;
/** How long a stage stays hot after the last keystroke. */
export const HOT_HOLD_MS = 2000;

/** 1 while the stage is hot, 0 at rest. Smooth it with approach() before drawing. */
export function stageHeat(wpm: number, msSinceKey: number): 0 | 1 {
  return wpm > HOT_WPM && msSinceKey < HOT_HOLD_MS ? 1 : 0;
}

/**
 * Moves value toward target, closing 63% of the gap every tau seconds, the
 * same at any frame rate.
 */
export function approach(value: number, target: number, dt: number, tau: number): number {
  return target + (value - target) * Math.exp(-dt / tau);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** A random draw in [0, 1), injectable so tests can pin it. */
export type Rand = () => number;

export function between(rand: Rand, min: number, max: number): number {
  return min + rand() * (max - min);
}

/**
 * A beam of light. The angle is measured from straight down, positive
 * toward the right, so the beam runs along (sin angle, cos angle).
 */
export interface Cone {
  x: number;
  y: number;
  angle: number;
  halfAngle: number;
  length: number;
  alpha: number;
}

/**
 * How brightly a beam lights the point (px, py): 1 on its centre line,
 * falling to 0 at its edge and beyond its end.
 */
export function litBy(cone: Cone, px: number, py: number): number {
  const dx = px - cone.x;
  const dy = py - cone.y;
  if (dy <= 0 || Math.hypot(dx, dy) > cone.length) return 0;
  const off = Math.abs(Math.atan2(dx, dy) - cone.angle);
  return Math.max(0, 1 - off / cone.halfAngle);
}

/**
 * A ripple of sound let loose from the caret. Its front runs outward along
 * the staves at `speed` px/s and it dies away over `lifeS` seconds.
 */
export interface Ripple {
  x: number;
  y: number;
  bornMs: number;
}

/**
 * How strongly a ripple moves a stave at horizontal position x: a band
 * centred on the ripple's front, fading with age and with the stave's
 * distance from where the ripple started. 0..1.
 */
export function rippleEnvelope(
  ripple: Ripple,
  x: number,
  staveY: number,
  nowMs: number,
  speed: number,
  lifeS: number,
  band: number,
  reach: number,
): number {
  const age = (nowMs - ripple.bornMs) / 1000;
  if (age < 0 || age > lifeS) return 0;
  const front = age * speed;
  const off = (Math.abs(x - ripple.x) - front) / band;
  const fade = 1 - age / lifeS;
  const near = Math.exp(-Math.abs(staveY - ripple.y) / reach);
  return Math.exp(-off * off) * fade * fade * near;
}
