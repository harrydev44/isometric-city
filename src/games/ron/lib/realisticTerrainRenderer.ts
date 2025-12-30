/**
 * Rise of Nations - Realistic Terrain Renderer
 *
 * RoN-only higher fidelity terrain/water/beach rendering for the 2D canvas pipeline.
 * Goal: remove flat/gradient-y green tiles and replace with layered, textured, animated terrain.
 *
 * This is intentionally self-contained so IsoCity visuals are unaffected.
 */
import { createNoise2D } from 'simplex-noise';
import { TILE_HEIGHT, TILE_WIDTH } from '@/components/game/shared';
import type { RoNTile } from '../types/game';

export type ShoreAdjacency = { north: boolean; east: boolean; south: boolean; west: boolean };

type PatternSet = {
  grass: CanvasPattern;
  soil: CanvasPattern;
  rock: CanvasPattern;
  sand: CanvasPattern;
  waterWaves: CanvasPattern;
  foam: CanvasPattern;
};

type CanvasOrOffscreen =
  | HTMLCanvasElement
  // OffscreenCanvas exists in some browsers, but we don't rely on it being present.
  | (typeof OffscreenCanvas extends new (...args: any[]) => any ? OffscreenCanvas : never);

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mixRGB(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
}

function rgbToCss([r, g, b]: [number, number, number], a: number = 1): string {
  if (a >= 1) return `rgb(${r}, ${g}, ${b})`;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function hash2D(x: number, y: number, seed: number): number {
  // Fast deterministic hash -> [0,1)
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = (h * 1274126177) | 0;
  h = (h ^ (h >>> 16)) | 0;
  return ((h >>> 0) % 1000000) / 1000000;
}

function makeSeededRng(seed: number): () => number {
  // Mulberry32
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createCanvas(size: number): CanvasOrOffscreen {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(size, size);
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function get2d(c: CanvasOrOffscreen): CanvasRenderingContext2D {
  const ctx = (c as any).getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) {
    throw new Error('Failed to create 2D context for terrain pattern canvas');
  }
  // OffscreenCanvasRenderingContext2D is compatible enough for our calls.
  return ctx as unknown as CanvasRenderingContext2D;
}

function clipDiamond(ctx: CanvasRenderingContext2D, screenX: number, screenY: number): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  ctx.beginPath();
  ctx.moveTo(screenX + w / 2, screenY);
  ctx.lineTo(screenX + w, screenY + h / 2);
  ctx.lineTo(screenX + w / 2, screenY + h);
  ctx.lineTo(screenX, screenY + h / 2);
  ctx.closePath();
  ctx.clip();
}

function diamondCorners(screenX: number, screenY: number) {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  return {
    top: { x: screenX + w / 2, y: screenY },
    right: { x: screenX + w, y: screenY + h / 2 },
    bottom: { x: screenX + w / 2, y: screenY + h },
    left: { x: screenX, y: screenY + h / 2 },
    center: { x: screenX + w / 2, y: screenY + h / 2 },
  };
}

function drawEdgeOcclusion(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  edges: Partial<ShoreAdjacency>,
  strength: number
): void {
  const c = diamondCorners(screenX, screenY);
  const s = clamp01(strength);
  if (s <= 0) return;

  const drawEdge = (a: { x: number; y: number }, b: { x: number; y: number }, inward: { x: number; y: number }) => {
    const g = ctx.createLinearGradient(a.x, a.y, inward.x, inward.y);
    g.addColorStop(0, `rgba(0,0,0,${0.16 * s})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(inward.x, inward.y);
    ctx.closePath();
    ctx.fill();
  };

  // Inward points roughly toward center.
  if (edges.north) drawEdge(c.left, c.top, { x: c.center.x - TILE_WIDTH * 0.05, y: c.center.y });
  if (edges.east) drawEdge(c.top, c.right, { x: c.center.x + TILE_WIDTH * 0.05, y: c.center.y });
  if (edges.south) drawEdge(c.right, c.bottom, { x: c.center.x + TILE_WIDTH * 0.05, y: c.center.y + TILE_HEIGHT * 0.05 });
  if (edges.west) drawEdge(c.bottom, c.left, { x: c.center.x - TILE_WIDTH * 0.05, y: c.center.y + TILE_HEIGHT * 0.05 });
}

function buildSpecklePattern(
  ctx: CanvasRenderingContext2D,
  size: number,
  seed: number,
  base: [number, number, number],
  speck1: [number, number, number],
  speck2: [number, number, number]
): void {
  const rng = makeSeededRng(seed);
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = rgbToCss(base);
  ctx.fillRect(0, 0, size, size);

  // Macro mottling (soft blobs)
  for (let i = 0; i < 120; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = (0.7 + rng() * 2.8) * (size / 128);
    const t = rng();
    const col = mixRGB(base, t < 0.5 ? speck1 : speck2, 0.35 + rng() * 0.35);
    ctx.fillStyle = rgbToCss(col, 0.12);
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.4, r, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine speckles (sand/grass detail)
  for (let i = 0; i < 2800; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const t = rng();
    const col = t < 0.5 ? speck1 : speck2;
    ctx.fillStyle = rgbToCss(col, 0.08 + rng() * 0.12);
    const s = (0.7 + rng() * 1.3) * (size / 128);
    ctx.fillRect(x, y, s, s);
  }
}

function buildNoisePattern(
  ctx: CanvasRenderingContext2D,
  size: number,
  seed: number,
  valueRange: { min: number; max: number },
  frequency: number,
  octaves: number
): void {
  const noise2D = createNoise2D(makeSeededRng(seed));
  const img = ctx.createImageData(size, size);
  const data = img.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let n = 0;
      let amp = 1;
      let freq = frequency;
      let ampSum = 0;
      for (let o = 0; o < octaves; o++) {
        n += noise2D(x / size * freq, y / size * freq) * amp;
        ampSum += amp;
        amp *= 0.5;
        freq *= 2;
      }
      n /= ampSum;
      const v = lerp(valueRange.min, valueRange.max, (n + 1) / 2);
      const idx = (y * size + x) * 4;
      data[idx + 0] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
}

export type RoNRealisticTerrainRenderer = {
  drawSky: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, timeSeconds: number) => void;
  drawLandTile: (args: {
    ctx: CanvasRenderingContext2D;
    screenX: number;
    screenY: number;
    gridX: number;
    gridY: number;
    tile: RoNTile;
    adjacentWater: ShoreAdjacency;
    timeSeconds: number;
    zoom: number;
  }) => void;
  drawWaterTile: (args: {
    ctx: CanvasRenderingContext2D;
    screenX: number;
    screenY: number;
    gridX: number;
    gridY: number;
    adjacentWater: ShoreAdjacency;
    adjacentLand: ShoreAdjacency;
    timeSeconds: number;
    waterImage: HTMLImageElement | null;
  }) => void;
  drawBeachOnWater: (args: {
    ctx: CanvasRenderingContext2D;
    screenX: number;
    screenY: number;
    gridX: number;
    gridY: number;
    adjacentLand: ShoreAdjacency;
    timeSeconds: number;
  }) => void;
};

let singleton: RoNRealisticTerrainRenderer | null = null;

export function getRoNRealisticTerrainRenderer(): RoNRealisticTerrainRenderer {
  if (singleton) return singleton;

  // Lazily construct patterns on first real call in the browser.
  let patterns: PatternSet | null = null;
  const seedBase = 1337;

  const ensurePatterns = (ctx: CanvasRenderingContext2D) => {
    if (patterns) return patterns;
    if (typeof document === 'undefined') {
      // SSR safety: should never draw on server
      throw new Error('RoN terrain renderer used outside browser environment');
    }

    const size = 256;
    const mk = (fn: (pctx: CanvasRenderingContext2D) => void) => {
      const c = createCanvas(size);
      const pctx = get2d(c);
      pctx.imageSmoothingEnabled = true;
      fn(pctx);
      const pat = ctx.createPattern(c as any, 'repeat');
      if (!pat) throw new Error('Failed to create pattern');
      return pat;
    };

    const grassBase: [number, number, number] = [70, 92, 54];
    const grassSpeck1: [number, number, number] = [92, 112, 60];
    const grassSpeck2: [number, number, number] = [54, 74, 42];

    const soilBase: [number, number, number] = [94, 78, 60];
    const soilSpeck1: [number, number, number] = [120, 104, 84];
    const soilSpeck2: [number, number, number] = [66, 52, 40];

    const rockBase: [number, number, number] = [102, 104, 110];
    const rockSpeck1: [number, number, number] = [148, 150, 156];
    const rockSpeck2: [number, number, number] = [58, 60, 66];

    const sandBase: [number, number, number] = [192, 170, 124];
    const sandSpeck1: [number, number, number] = [220, 200, 150];
    const sandSpeck2: [number, number, number] = [150, 126, 92];

    const grass = mk((pctx) => buildSpecklePattern(pctx, size, seedBase + 1, grassBase, grassSpeck1, grassSpeck2));
    const soil = mk((pctx) => buildSpecklePattern(pctx, size, seedBase + 2, soilBase, soilSpeck1, soilSpeck2));
    const rock = mk((pctx) => buildSpecklePattern(pctx, size, seedBase + 3, rockBase, rockSpeck1, rockSpeck2));
    const sand = mk((pctx) => buildSpecklePattern(pctx, size, seedBase + 4, sandBase, sandSpeck1, sandSpeck2));

    const waterWaves = mk((pctx) => {
      pctx.clearRect(0, 0, size, size);
      buildNoisePattern(pctx, size, seedBase + 5, { min: 40, max: 210 }, 2.2, 4);
    });

    const foam = mk((pctx) => {
      pctx.clearRect(0, 0, size, size);
      // Higher contrast noise for foam breakup
      buildNoisePattern(pctx, size, seedBase + 6, { min: 0, max: 255 }, 3.5, 3);
    });

    patterns = { grass, soil, rock, sand, waterWaves, foam };
    return patterns;
  };

  const drawSky: RoNRealisticTerrainRenderer['drawSky'] = (ctx, canvas, timeSeconds) => {
    // Subtle atmospheric sky: higher contrast at top, hazy near horizon.
    // We keep it "day" for now but animate a tiny amount (cloud drift).
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, '#0b2a4a');  // deep blue
    g.addColorStop(0.55, '#2a5a7a'); // lighter
    g.addColorStop(1, '#193a2a');  // distant haze
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Soft cloud haze streaks
    const cloudAlpha = 0.07;
    const drift = (timeSeconds * 6) % canvas.width;
    ctx.save();
    ctx.globalAlpha = cloudAlpha;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 10; i++) {
      const y = (canvas.height * 0.12) + i * (canvas.height * 0.06);
      const w = canvas.width * (0.5 + (i % 3) * 0.2);
      const x = (i * canvas.width * 0.18 - drift);
      ctx.beginPath();
      ctx.ellipse(x, y, w, canvas.height * 0.03, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const drawLandTile: RoNRealisticTerrainRenderer['drawLandTile'] = ({
    ctx,
    screenX,
    screenY,
    gridX,
    gridY,
    tile,
    adjacentWater,
    timeSeconds,
    zoom,
  }) => {
    const p = ensurePatterns(ctx);
    const c = diamondCorners(screenX, screenY);
    const nearWater =
      (adjacentWater.north ? 1 : 0) +
      (adjacentWater.east ? 1 : 0) +
      (adjacentWater.south ? 1 : 0) +
      (adjacentWater.west ? 1 : 0);
    const wetness = clamp01(nearWater / 3);
    const seed = Math.floor(hash2D(gridX, gridY, 9001) * 1_000_000);
    const rng = makeSeededRng(seed);

    ctx.save();
    clipDiamond(ctx, screenX, screenY);

    // Base tone: natural grass, slightly darker near water, slightly varied per tile
    const baseGrass: [number, number, number] = [72, 98, 56];
    const dampGrass: [number, number, number] = [54, 78, 52];
    const dryGrass: [number, number, number] = [86, 104, 60];
    const grassTone = mixRGB(baseGrass, wetness > 0.35 ? dampGrass : dryGrass, wetness);
    const v = (rng() - 0.5) * 0.10;
    const topCol = mixRGB(grassTone, [255, 255, 255], clamp01(0.08 + v));
    const botCol = mixRGB(grassTone, [0, 0, 0], clamp01(0.08 - v));
    const grad = ctx.createLinearGradient(c.left.x, c.top.y, c.right.x, c.bottom.y);
    grad.addColorStop(0, rgbToCss(topCol));
    grad.addColorStop(1, rgbToCss(botCol));
    ctx.fillStyle = grad;
    ctx.fillRect(screenX - 4, screenY - 4, TILE_WIDTH + 8, TILE_HEIGHT + 8);

    // Layer: grass texture
    ctx.globalAlpha = 0.72;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = p.grass;
    ctx.translate(-((gridX * 17) % 256), -((gridY * 23) % 256));
    ctx.fillRect(screenX - 256, screenY - 256, TILE_WIDTH + 512, TILE_HEIGHT + 512);

    // Reset translate for subsequent drawing within clip
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    // Macro soil patches: reduce the "lawn" look.
    const soilChance = tile.forestDensity > 0 ? 0.18 : 0.28;
    const patchCount = Math.floor(2 + rng() * 4 + soilChance * 4);
    for (let i = 0; i < patchCount; i++) {
      const px = c.center.x + (rng() - 0.5) * TILE_WIDTH * 0.55;
      const py = c.center.y + (rng() - 0.2) * TILE_HEIGHT * 0.45;
      const prx = TILE_WIDTH * (0.07 + rng() * 0.10);
      const pry = TILE_HEIGHT * (0.07 + rng() * 0.14);
      ctx.globalAlpha = 0.18 + rng() * 0.18;
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = p.soil;
      ctx.beginPath();
      ctx.ellipse(px, py, prx, pry, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;

    // Wet shoreline stain on land tiles next to water (subtle, not "beach").
    if (nearWater > 0) {
      ctx.globalAlpha = 0.22 + wetness * 0.12;
      ctx.globalCompositeOperation = 'multiply';
      drawEdgeOcclusion(ctx, screenX, screenY, adjacentWater, 0.9);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    // Mountain/ore tiles: shift toward rock. (The peaks are still drawn by RoNCanvas for now.)
    if (tile.hasMetalDeposit) {
      ctx.globalAlpha = 0.55;
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = p.rock;
      ctx.translate(-((gridX * 11) % 256), -((gridY * 19) % 256));
      ctx.fillRect(screenX - 256, screenY - 256, TILE_WIDTH + 512, TILE_HEIGHT + 512);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    // Subtle grid edge (only when zoomed in, keep realism at distance)
    if (zoom >= 0.7) {
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(c.top.x, c.top.y);
      ctx.lineTo(c.right.x, c.right.y);
      ctx.lineTo(c.bottom.x, c.bottom.y);
      ctx.lineTo(c.left.x, c.left.y);
      ctx.closePath();
      ctx.stroke();
    }

    ctx.restore();
  };

  const drawWaterTile: RoNRealisticTerrainRenderer['drawWaterTile'] = ({
    ctx,
    screenX,
    screenY,
    gridX,
    gridY,
    adjacentLand,
    timeSeconds,
    waterImage,
  }) => {
    const p = ensurePatterns(ctx);
    const c = diamondCorners(screenX, screenY);
    const shore =
      (adjacentLand.north ? 1 : 0) +
      (adjacentLand.east ? 1 : 0) +
      (adjacentLand.south ? 1 : 0) +
      (adjacentLand.west ? 1 : 0);
    const shallow = clamp01(shore / 2);
    const seed = Math.floor(hash2D(gridX, gridY, 4242) * 1_000_000);
    const rng = makeSeededRng(seed);

    ctx.save();
    clipDiamond(ctx, screenX, screenY);

    // Base water color with depth-ish ramp (shallower near shores).
    const deep: [number, number, number] = [18, 58, 84];
    const mid: [number, number, number] = [22, 86, 112];
    const shallowCol: [number, number, number] = [52, 136, 146];
    const waterBase = mixRGB(mid, shallowCol, shallow * 0.75);
    const topCol = mixRGB(waterBase, [255, 255, 255], 0.06);
    const botCol = mixRGB(deep, [0, 0, 0], 0.08);
    const grad = ctx.createLinearGradient(c.left.x, c.top.y, c.right.x, c.bottom.y);
    grad.addColorStop(0, rgbToCss(topCol));
    grad.addColorStop(1, rgbToCss(botCol));
    ctx.fillStyle = grad;
    ctx.fillRect(screenX - 8, screenY - 8, TILE_WIDTH + 16, TILE_HEIGHT + 16);

    // If the existing water texture exists, use it as a detail layer (but color-corrected).
    if (waterImage) {
      const imgW = waterImage.naturalWidth || waterImage.width;
      const imgH = waterImage.naturalHeight || waterImage.height;
      const cropScale = 0.35;
      const cropW = imgW * cropScale;
      const cropH = imgH * cropScale;
      const srcX = rng() * (imgW - cropW);
      const srcY = rng() * (imgH - cropH);

      const aspect = cropH / cropW;
      const destW = TILE_WIDTH * 1.15;
      const destH = destW * aspect;
      const jitterX = (rng() - 0.5) * TILE_WIDTH * 0.10;
      const jitterY = (rng() - 0.5) * TILE_HEIGHT * 0.10;

      ctx.globalAlpha = 0.55;
      ctx.globalCompositeOperation = 'overlay';
      ctx.drawImage(
        waterImage,
        srcX,
        srcY,
        cropW,
        cropH,
        c.center.x - destW / 2 + jitterX,
        c.center.y - destH / 2 + jitterY,
        destW,
        destH
      );
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    // Animated wave/capillary ripples layer (screen-space drift)
    ctx.globalAlpha = 0.26;
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = p.waterWaves;
    ctx.translate(-((gridX * 13 + timeSeconds * 18) % 256), -((gridY * 17 + timeSeconds * 12) % 256));
    ctx.fillRect(screenX - 256, screenY - 256, TILE_WIDTH + 512, TILE_HEIGHT + 512);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    // Subtle vignette toward tile edges to create depth.
    drawEdgeOcclusion(ctx, screenX, screenY, { north: true, east: true, south: true, west: true }, 0.6);

    ctx.restore();
  };

  const drawBeachOnWater: RoNRealisticTerrainRenderer['drawBeachOnWater'] = ({
    ctx,
    screenX,
    screenY,
    gridX,
    gridY,
    adjacentLand,
    timeSeconds,
  }) => {
    const p = ensurePatterns(ctx);
    const c = diamondCorners(screenX, screenY);
    const hasAny = adjacentLand.north || adjacentLand.east || adjacentLand.south || adjacentLand.west;
    if (!hasAny) return;

    const seed = Math.floor(hash2D(gridX, gridY, 98765) * 1_000_000);
    const rng = makeSeededRng(seed);

    ctx.save();
    clipDiamond(ctx, screenX, screenY);

    const drawEdge = (a: { x: number; y: number }, b: { x: number; y: number }, inward: { x: number; y: number }) => {
      // Shallow sand gradient (underwater)
      const g = ctx.createLinearGradient(a.x, a.y, inward.x, inward.y);
      g.addColorStop(0, 'rgba(220, 200, 150, 0.42)'); // shallow sand
      g.addColorStop(0.65, 'rgba(120, 190, 190, 0.08)'); // blend
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(inward.x, inward.y);
      ctx.closePath();
      ctx.fill();

      // Foam line (animated, broken up with noise)
      const foamT = (timeSeconds * 0.8 + rng()) % 1;
      const fx = lerp(a.x, b.x, 0.5);
      const fy = lerp(a.y, b.y, 0.5);
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([3 + foamT * 3, 4 + (1 - foamT) * 3]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Foam breakup texture
      ctx.globalAlpha = 0.10;
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = p.foam;
      ctx.translate(-((gridX * 19 + timeSeconds * 35) % 256), -((gridY * 23 + timeSeconds * 28) % 256));
      ctx.fillRect(fx - 256, fy - 256, 512, 512);
      ctx.restore();
    };

    // Compute inward points (toward tile center) with a configurable width.
    const width = TILE_WIDTH * 0.18;
    const toInward = (from: { x: number; y: number }) => {
      const dx = c.center.x - from.x;
      const dy = c.center.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      return { x: from.x + (dx / len) * width, y: from.y + (dy / len) * width };
    };

    if (adjacentLand.north) drawEdge(c.left, c.top, toInward({ x: (c.left.x + c.top.x) / 2, y: (c.left.y + c.top.y) / 2 }));
    if (adjacentLand.east) drawEdge(c.top, c.right, toInward({ x: (c.top.x + c.right.x) / 2, y: (c.top.y + c.right.y) / 2 }));
    if (adjacentLand.south) drawEdge(c.right, c.bottom, toInward({ x: (c.right.x + c.bottom.x) / 2, y: (c.right.y + c.bottom.y) / 2 }));
    if (adjacentLand.west) drawEdge(c.bottom, c.left, toInward({ x: (c.bottom.x + c.left.x) / 2, y: (c.bottom.y + c.left.y) / 2 }));

    // Add a subtle sand texture band (very low alpha) to avoid flatness.
    ctx.globalAlpha = 0.08;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = p.sand;
    ctx.translate(-((gridX * 29 + timeSeconds * 4) % 256), -((gridY * 31 + timeSeconds * 4) % 256));
    ctx.fillRect(screenX - 256, screenY - 256, TILE_WIDTH + 512, TILE_HEIGHT + 512);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    ctx.restore();
  };

  singleton = {
    drawSky,
    drawLandTile,
    drawWaterTile,
    drawBeachOnWater,
  };
  return singleton;
}

