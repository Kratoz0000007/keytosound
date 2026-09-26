/** 340 → "340ms"; from a second up, one decimal: 1234 → "1.2s". */
export function formatMs(ms: number): string {
  return Math.round(ms) < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

/** A bar's width as a percentage of the largest value; 0 when there is none. */
export function barPercent(value: number, max: number): number {
  return max > 0 ? Math.round((value / max) * 100) : 0;
}

/** 0.72 → "72%". */
export function asPercent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/** The space bar's key is " ", which would render as nothing. */
export function keyLabel(key: string): string {
  return key === ' ' ? 'space' : key;
}
