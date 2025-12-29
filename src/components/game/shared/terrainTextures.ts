/**
 * Procedural terrain textures (fast, cached).
 *
 * Goal: noticeably higher visual fidelity for terrain without shipping huge assets.
 * - Uses small offscreen canvases as repeating patterns
 * - Caches CanvasPattern per rendering context (patterns are context-bound)
 */
 
type RNG = () => number;

function mulberry32(seed: number): RNG {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2D(x: number, y: number, seed = 0): number {
  // Fast integer hash (stable across sessions)
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 2147483647;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const s = hex.replace('#', '').trim();
  const v = parseInt(s.length === 3 ? s.split('').map(c => c + c).join('') : s, 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const rr = Math.max(0, Math.min(255, r | 0));
  const gg = Math.max(0, Math.min(255, g | 0));
  const bb = Math.max(0, Math.min(255, b | 0));
  return `#${((1 << 24) + (rr << 16) + (gg << 8) + bb).toString(16).slice(1)}`;
}

export function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const tt = clamp01(t);
  return rgbToHex(lerp(A.r, B.r, tt), lerp(A.g, B.g, tt), lerp(A.b, B.b, tt));
}

function makeCanvas(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

// Offscreen sources (shared across contexts)
let _grassSource: HTMLCanvasElement | null = null;
let _dirtSource: HTMLCanvasElement | null = null;
let _sandSource: HTMLCanvasElement | null = null;
let _ripplesSource: HTMLCanvasElement | null = null;
let _grainSource: HTMLCanvasElement | null = null;

function buildGrassSource(): HTMLCanvasElement {
  const size = 128;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d')!;
  const rng = mulberry32(0x3a8f1c);

  ctx.fillStyle = '#3f7f35';
  ctx.fillRect(0, 0, size, size);

  // Soft mottling
  for (let i = 0; i < 900; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 0.8 + rng() * 1.8;
    const a = 0.06 + rng() * 0.06;
    ctx.fillStyle = `rgba(20, 60, 18, ${a})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tiny blade strokes (diagonal)
  ctx.strokeStyle = 'rgba(120, 190, 90, 0.12)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 260; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const len = 3 + rng() * 7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len * 0.35, y - len);
    ctx.stroke();
  }

  return c;
}

function buildDirtSource(): HTMLCanvasElement {
  const size = 128;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d')!;
  const rng = mulberry32(0x9b6a34);

  ctx.fillStyle = '#8f6b3e';
  ctx.fillRect(0, 0, size, size);

  // Pebbles / clumps
  for (let i = 0; i < 750; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 0.8 + rng() * 2.2;
    const a = 0.05 + rng() * 0.08;
    ctx.fillStyle = `rgba(50, 30, 15, ${a})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Lighter dry patches
  for (let i = 0; i < 120; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const w = 8 + rng() * 20;
    const h = 6 + rng() * 16;
    const a = 0.03 + rng() * 0.05;
    ctx.fillStyle = `rgba(210, 170, 120, ${a})`;
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  return c;
}

function buildSandSource(): HTMLCanvasElement {
  const size = 128;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d')!;
  const rng = mulberry32(0xd4a574);

  ctx.fillStyle = '#d4a574';
  ctx.fillRect(0, 0, size, size);

  // Grain
  for (let i = 0; i < 1200; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const a = 0.05 + rng() * 0.08;
    const shade = 210 + (rng() * 30 - 15);
    ctx.fillStyle = `rgba(${shade}, ${shade - 12}, ${shade - 35}, ${a})`;
    ctx.fillRect(x, y, 1, 1);
  }

  // Subtle ripples
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let y = 0; y < size; y += 10) {
    ctx.beginPath();
    ctx.moveTo(0, y + (rng() - 0.5) * 2);
    for (let x = 0; x <= size; x += 16) {
      ctx.lineTo(x, y + Math.sin((x / size) * Math.PI * 2) * 1.5);
    }
    ctx.stroke();
  }

  return c;
}

function buildRipplesSource(): HTMLCanvasElement {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d')!;
  const rng = mulberry32(0x1d4ed8);

  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;

  // Curvy ripple streaks
  for (let i = 0; i < 55; i++) {
    const baseY = rng() * size;
    const amp = 2 + rng() * 6;
    const freq = 0.8 + rng() * 2.2;
    const phase = rng() * Math.PI * 2;
    ctx.beginPath();
    for (let x = -10; x <= size + 10; x += 12) {
      const y = baseY + Math.sin((x / size) * Math.PI * 2 * freq + phase) * amp;
      if (x < 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Sparkle dots
  for (let i = 0; i < 350; i++) {
    const x = rng() * size;
    const y = rng() * size;
    ctx.fillStyle = `rgba(255,255,255,${0.02 + rng() * 0.06})`;
    ctx.fillRect(x, y, 1, 1);
  }

  return c;
}

function buildGrainSource(): HTMLCanvasElement {
  const size = 128;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d')!;
  const rng = mulberry32(0x1234567);

  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (rng() * 255) | 0;
    img.data[i + 0] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 20; // low alpha
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function getSource(kind: 'grass' | 'dirt' | 'sand' | 'ripples' | 'grain'): HTMLCanvasElement {
  if (kind === 'grass') return (_grassSource ??= buildGrassSource());
  if (kind === 'dirt') return (_dirtSource ??= buildDirtSource());
  if (kind === 'sand') return (_sandSource ??= buildSandSource());
  if (kind === 'ripples') return (_ripplesSource ??= buildRipplesSource());
  return (_grainSource ??= buildGrainSource());
}

const patternCache = new WeakMap<CanvasRenderingContext2D, Map<string, CanvasPattern>>();

export function getPattern(
  ctx: CanvasRenderingContext2D,
  kind: 'grass' | 'dirt' | 'sand' | 'ripples' | 'grain'
): CanvasPattern {
  let map = patternCache.get(ctx);
  if (!map) {
    map = new Map();
    patternCache.set(ctx, map);
  }
  const key = `pattern:${kind}`;
  const existing = map.get(key);
  if (existing) return existing;

  const pattern = ctx.createPattern(getSource(kind), 'repeat');
  if (!pattern) {
    // Should never happen, but keep a stable fallback
    throw new Error(`Failed to create pattern for ${kind}`);
  }
  map.set(key, pattern);
  return pattern;
}

