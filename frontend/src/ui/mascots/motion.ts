import type { CSSProperties } from 'react';

/** Space and the drum keys 1-8: the strokes that land on the beat. */
export function isBeatKey(key: string): boolean {
  return key === ' ' || /^[1-8]$/.test(key);
}

/**
 * Seconds per loop of a mascot's typing animation, from the live typing
 * speed: 1.5s at a crawl, tightening to 0.3s from about 100 wpm.
 */
export function mascotTempo(wpm: number): number {
  const seconds = 1.5 - Math.max(0, wpm) * 0.012;
  return Math.round(Math.min(1.5, Math.max(0.3, seconds)) * 100) / 100;
}

/** Where a particle flies to, read by the mascot keyframes as --dx and --dy. */
export function drift(dx: number, dy: number): CSSProperties {
  return { '--dx': `${dx}px`, '--dy': `${dy}px` } as CSSProperties;
}
