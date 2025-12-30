import { createNoise4D } from 'simplex-noise';
import { clamp01, hexToRgb, mixRgb } from './color';
import { mulberry32 } from './prng';

import type { RoNGraphicsQuality } from '../../types/graphics';
export type { RoNGraphicsQuality } from '../../types/graphics';

export type RoNMaterialCanvases = {
  size: number;
  grass: HTMLCanvasElement;
  soil: HTMLCanvasElement;
  sand: HTMLCanvasElement;
  rock: HTMLCanvasElement;
  water: HTMLCanvasElement;
  waterDetail: HTMLCanvasElement;
  foam: HTMLCanvasElement;
};

type Cached = {
  canvases: RoNMaterialCanvases;
};

const cache = new Map<string, Cached>();
const patternCache = new WeakMap<
  CanvasRenderingContext2D,
  Map<string, Record<keyof Omit<RoNMaterialCanvases, 'size'>, CanvasPattern>>
>();

function makeCanvas(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function getQualitySize(quality: RoNGraphicsQuality): number {
  switch (quality) {
    case 'ultra':
      return 768;
    case 'high':
      return 512;
    case 'balanced':
      return 384;
    case 'low':
      return 256;
  }
}

function tileableNoiseFactory(seed: number) {
  const rand = mulberry32(seed);
  const noise4D = createNoise4D(rand);
  return (x01: number, y01: number): number => {
    // Map 2D -> 4D torus for seamless tiling.
    const ax = Math.PI * 2 * x01;
    const ay = Math.PI * 2 * y01;
    const nx = Math.cos(ax);
    const ny = Math.sin(ax);
    const nz = Math.cos(ay);
    const nw = Math.sin(ay);
    return noise4D(nx, ny, nz, nw); // [-1, 1]
  };
}

function fbm(
  noise: (x01: number, y01: number) => number,
  x01: number,
  y01: number,
  octaves: number,
  lacunarity: number,
  gain: number
): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = noise((x01 * freq) % 1, (y01 * freq) % 1);
    sum += (n * 0.5 + 0.5) * amp;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return norm > 0 ? sum / norm : 0;
}

function generateMaterial(
  canvas: HTMLCanvasElement,
  seed: number,
  opts: {
    baseA: string;
    baseB: string;
    detailA?: string;
    detailB?: string;
    octaves: number;
    speckleChance?: number;
    speckleColor?: string;
    contrast?: number; // 0..1
  }
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width: size } = canvas;

  const baseA = hexToRgb(opts.baseA);
  const baseB = hexToRgb(opts.baseB);
  const detailA = opts.detailA ? hexToRgb(opts.detailA) : null;
  const detailB = opts.detailB ? hexToRgb(opts.detailB) : null;
  const speckle = opts.speckleColor ? hexToRgb(opts.speckleColor) : { r: 0, g: 0, b: 0 };

  const noise = tileableNoiseFactory(seed);
  const id = ctx.createImageData(size, size);
  const d = id.data;

  const contrast = opts.contrast ?? 0.25;
  const speckleChance = opts.speckleChance ?? 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const x01 = x / size;
      const y01 = y / size;

      // Primary albedo noise.
      let n = fbm(noise, x01, y01, opts.octaves, 2.1, 0.55);
      // Slight contrast curve.
      n = clamp01(0.5 + (n - 0.5) * (1 + contrast * 1.6));

      let col = mixRgb(baseA, baseB, n);

      // Optional micro-detail (pebbles / fibers).
      if (detailA && detailB) {
        const micro = fbm(noise, x01 + 0.37, y01 - 0.21, Math.max(1, opts.octaves - 2), 3.2, 0.45);
        const m = clamp01(0.5 + (micro - 0.5) * 1.6);
        const microCol = mixRgb(detailA, detailB, m);
        // Soft overlay-ish blend.
        col = mixRgb(col, microCol, 0.25);
      }

      // Sparse speckles (sand grains, rocks).
      if (speckleChance > 0) {
        // Deterministic-ish speckle using hashed coordinate in noise domain.
        const s = fbm(noise, (x01 + 0.123) % 1, (y01 + 0.456) % 1, 1, 2, 0.5);
        if (s > 1 - speckleChance) {
          col = mixRgb(col, speckle, 0.85);
        }
      }

      const i = (y * size + x) * 4;
      d[i] = Math.round(col.r);
      d[i + 1] = Math.round(col.g);
      d[i + 2] = Math.round(col.b);
      d[i + 3] = 255;
    }
  }

  ctx.putImageData(id, 0, 0);
}

function generateFoam(canvas: HTMLCanvasElement, seed: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width: size } = canvas;

  const noise = tileableNoiseFactory(seed);
  const id = ctx.createImageData(size, size);
  const d = id.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const x01 = x / size;
      const y01 = y / size;
      const n = fbm(noise, x01, y01, 4, 2.2, 0.55);
      // Thresholded foam blobs with soft edges.
      const t = clamp01((n - 0.62) / 0.12);
      const a = Math.pow(t, 1.4);
      const i = (y * size + x) * 4;
      d[i] = 255;
      d[i + 1] = 255;
      d[i + 2] = 255;
      d[i + 3] = Math.round(a * 255);
    }
  }

  ctx.putImageData(id, 0, 0);
}

export function getRoNMaterialCanvases(quality: RoNGraphicsQuality, seed: number = 1337): RoNMaterialCanvases | null {
  if (typeof document === 'undefined') return null;

  const key = `${quality}:${seed}`;
  const existing = cache.get(key);
  if (existing) return existing.canvases;

  const size = getQualitySize(quality);

  const grass = makeCanvas(size);
  const soil = makeCanvas(size);
  const sand = makeCanvas(size);
  const rock = makeCanvas(size);
  const water = makeCanvas(size);
  const waterDetail = makeCanvas(size);
  const foam = makeCanvas(size);

  // Realistic, muted palettes (no neon greens).
  generateMaterial(grass, seed + 1, {
    baseA: '#2f4b2b', // deep grass
    baseB: '#586b3a', // sun grass
    detailA: '#3b3a24', // soil tint
    detailB: '#6b6a48', // dry grass
    octaves: quality === 'low' ? 4 : quality === 'balanced' ? 5 : 6,
    contrast: 0.22,
    speckleChance: 0.02,
    speckleColor: '#1f2a1c',
  });

  generateMaterial(soil, seed + 2, {
    baseA: '#3a2a1d',
    baseB: '#6b4a2c',
    detailA: '#2a2018',
    detailB: '#8b6a42',
    octaves: quality === 'low' ? 3 : 5,
    contrast: 0.25,
    speckleChance: 0.03,
    speckleColor: '#12100d',
  });

  generateMaterial(sand, seed + 3, {
    baseA: '#bfa377',
    baseB: '#d6c29a',
    detailA: '#a58b62',
    detailB: '#e6d7b6',
    octaves: quality === 'low' ? 3 : 4,
    contrast: 0.18,
    speckleChance: 0.05,
    speckleColor: '#7c6a4c',
  });

  generateMaterial(rock, seed + 4, {
    baseA: '#4b4f56',
    baseB: '#8a8f97',
    detailA: '#3a3f46',
    detailB: '#a1a7b0',
    octaves: quality === 'low' ? 4 : 6,
    contrast: 0.35,
    speckleChance: 0.02,
    speckleColor: '#1c1f25',
  });

  // Water: albedo and detail (ripples/caustics).
  generateMaterial(water, seed + 5, {
    baseA: '#072130', // deep
    baseB: '#14546d', // shallow
    detailA: '#0a2d3f',
    detailB: '#1b6f8c',
    octaves: quality === 'low' ? 3 : 5,
    contrast: 0.2,
  });

  generateMaterial(waterDetail, seed + 6, {
    baseA: '#0a0f14',
    baseB: '#ffffff',
    octaves: quality === 'low' ? 2 : 4,
    contrast: 0.55,
  });

  generateFoam(foam, seed + 7);

  const canvases: RoNMaterialCanvases = {
    size,
    grass,
    soil,
    sand,
    rock,
    water,
    waterDetail,
    foam,
  };

  cache.set(key, { canvases });
  return canvases;
}

export function getRoNMaterialPatterns(
  ctx: CanvasRenderingContext2D,
  quality: RoNGraphicsQuality,
  seed: number = 1337
): Record<keyof Omit<RoNMaterialCanvases, 'size'>, CanvasPattern> | null {
  const key = `${quality}:${seed}`;

  let byCtx = patternCache.get(ctx);
  if (!byCtx) {
    byCtx = new Map();
    patternCache.set(ctx, byCtx);
  }

  const cached = byCtx.get(key);
  if (cached) return cached;

  const canvases = getRoNMaterialCanvases(quality, seed);
  if (!canvases) return null;

  const make = (c: HTMLCanvasElement) => {
    const p = ctx.createPattern(c, 'repeat');
    if (!p) throw new Error('Failed to create canvas pattern');
    return p;
  };

  const patterns = {
    grass: make(canvases.grass),
    soil: make(canvases.soil),
    sand: make(canvases.sand),
    rock: make(canvases.rock),
    water: make(canvases.water),
    waterDetail: make(canvases.waterDetail),
    foam: make(canvases.foam),
  } satisfies Record<keyof Omit<RoNMaterialCanvases, 'size'>, CanvasPattern>;

  byCtx.set(key, patterns);
  return patterns;
}

