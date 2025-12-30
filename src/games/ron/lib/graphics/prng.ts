/**
 * Deterministic, fast PRNG helpers for procedural graphics.
 */
 
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    // https://stackoverflow.com/a/47593316
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Cheap, deterministic hash for 2D integer coordinates.
 * Useful for per-tile variation without allocating RNGs.
 */
export function hash2i(x: number, y: number, seed: number = 0): number {
  // Mix 32-bit ints (x/y are expected to be small-ish but can be any int).
  let h = (seed ^ 0x9E3779B9) >>> 0;
  h = Math.imul(h ^ (x | 0), 0x85EBCA6B) >>> 0;
  h = Math.imul(h ^ (y | 0), 0xC2B2AE35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

