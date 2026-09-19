/**
 * Mulberry32. Small, fast, seedable, and good enough for musical choice.
 * The engine's determinism contract depends on this being the only source
 * of randomness in engine/.
 */
export function createPrng(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
