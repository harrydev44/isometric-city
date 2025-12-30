import { TILE_WIDTH, TILE_HEIGHT } from '../renderConfig';
import { clamp01, darken, desaturate, lighten, mixHex, withAlpha } from './color';
import { hash2i, mulberry32 } from './prng';
import { getRoNMaterialPatterns } from './textures';
import type { RoNGraphicsQuality } from '../../types/graphics';

export type RoNZone = 'none' | 'residential' | 'commercial' | 'industrial';

export type RoNGraphicsOptions = {
  quality: RoNGraphicsQuality;
  /**
   * World time in seconds (used for water animation).
   */
  time: number;
  /**
   * If true, draw subtle grid strokes at higher zoom (keeps readability).
   */
  showGridWhenZoomed?: boolean;
};

function clipDiamond(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.beginPath();
  ctx.moveTo(x + TILE_WIDTH / 2, y);
  ctx.lineTo(x + TILE_WIDTH, y + TILE_HEIGHT / 2);
  ctx.lineTo(x + TILE_WIDTH / 2, y + TILE_HEIGHT);
  ctx.lineTo(x, y + TILE_HEIGHT / 2);
  ctx.closePath();
  ctx.clip();
}

function drawSoftAo(ctx: CanvasRenderingContext2D, x: number, y: number, intensity: number): void {
  // Subtle ambient occlusion to break up the “flat tile” look.
  const g = ctx.createLinearGradient(x, y, x, y + TILE_HEIGHT);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.65, `rgba(0,0,0,${0.08 * intensity})`);
  g.addColorStop(1, `rgba(0,0,0,${0.14 * intensity})`);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, TILE_WIDTH, TILE_HEIGHT);
}

function zoneTint(zone: RoNZone): { tint: string; alpha: number } | null {
  // Keep zones readable but not garish (avoid neon).
  switch (zone) {
    case 'residential':
      return { tint: '#2f8b57', alpha: 0.12 };
    case 'commercial':
      return { tint: '#2a62a7', alpha: 0.10 };
    case 'industrial':
      return { tint: '#a36b2a', alpha: 0.12 };
    default:
      return null;
  }
}

export function drawRoNRealisticGroundTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  zone: RoNZone,
  zoom: number,
  opts: RoNGraphicsOptions
): void {
  const patterns = getRoNMaterialPatterns(ctx, opts.quality);
  if (!patterns) {
    // SSR/early fallback: draw a muted, non-neon placeholder.
    ctx.fillStyle = '#4f6b3e';
    ctx.beginPath();
    ctx.moveTo(screenX + TILE_WIDTH / 2, screenY);
    ctx.lineTo(screenX + TILE_WIDTH, screenY + TILE_HEIGHT / 2);
    ctx.lineTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT);
    ctx.lineTo(screenX, screenY + TILE_HEIGHT / 2);
    ctx.closePath();
    ctx.fill();
    return;
  }

  const seed = hash2i(gridX, gridY, 991);
  const rnd = mulberry32(seed);

  // Dirt exposure factor (roads/traffic would increase this later).
  const macro = rnd(); // 0..1
  const dirt = clamp01((macro - 0.35) / 0.65); // bias towards grass

  ctx.save();
  clipDiamond(ctx, screenX, screenY);

  // Align patterns in world-space so textures continue across tiles.
  ctx.save();
  ctx.translate(-gridX * TILE_WIDTH, -gridY * TILE_HEIGHT);

  // Base: grass.
  ctx.globalAlpha = 1;
  ctx.fillStyle = patterns.grass;
  ctx.fillRect(gridX * TILE_WIDTH, gridY * TILE_HEIGHT, TILE_WIDTH, TILE_HEIGHT);

  // Blend-in soil patches (soft, not hard-masked).
  if (dirt > 0.02) {
    ctx.globalAlpha = 0.55 * dirt;
    ctx.fillStyle = patterns.soil;
    ctx.fillRect(gridX * TILE_WIDTH, gridY * TILE_HEIGHT, TILE_WIDTH, TILE_HEIGHT);
  }
  ctx.restore();

  // Subtle directional lighting (top-left sun), keeps an “isometric” read while staying realistic.
  const light = ctx.createLinearGradient(
    screenX,
    screenY,
    screenX + TILE_WIDTH,
    screenY + TILE_HEIGHT
  );
  light.addColorStop(0, 'rgba(255,255,255,0.06)');
  light.addColorStop(0.55, 'rgba(255,255,255,0)');
  light.addColorStop(1, 'rgba(0,0,0,0.05)');
  ctx.fillStyle = light;
  ctx.fillRect(screenX, screenY, TILE_WIDTH, TILE_HEIGHT);

  drawSoftAo(ctx, screenX, screenY, 1);

  // Zone tint overlay (very subtle, realistic).
  const z = zoneTint(zone);
  if (z) {
    ctx.fillStyle = withAlpha(z.tint, z.alpha);
    ctx.fillRect(screenX, screenY, TILE_WIDTH, TILE_HEIGHT);
  }

  ctx.restore();

  // Grid stroke only when zoomed in enough (helps readability without “tile art” vibe).
  if ((opts.showGridWhenZoomed ?? true) && zoom >= 0.8) {
    ctx.strokeStyle = 'rgba(10, 15, 10, 0.28)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(screenX + TILE_WIDTH / 2, screenY);
    ctx.lineTo(screenX + TILE_WIDTH, screenY + TILE_HEIGHT / 2);
    ctx.lineTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT);
    ctx.lineTo(screenX, screenY + TILE_HEIGHT / 2);
    ctx.closePath();
    ctx.stroke();
  }
}

export function drawRoNRealisticRockTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  zoom: number,
  opts: RoNGraphicsOptions
): void {
  const patterns = getRoNMaterialPatterns(ctx, opts.quality);
  if (!patterns) return;

  ctx.save();
  clipDiamond(ctx, screenX, screenY);

  ctx.save();
  ctx.translate(-gridX * TILE_WIDTH, -gridY * TILE_HEIGHT);
  ctx.globalAlpha = 1;
  ctx.fillStyle = patterns.rock;
  ctx.fillRect(gridX * TILE_WIDTH, gridY * TILE_HEIGHT, TILE_WIDTH, TILE_HEIGHT);
  ctx.restore();

  // Cooler tone + slight height shadow.
  ctx.fillStyle = 'rgba(10, 18, 24, 0.10)';
  ctx.fillRect(screenX, screenY, TILE_WIDTH, TILE_HEIGHT);
  drawSoftAo(ctx, screenX, screenY, 1.15);

  // Pebbles / scree when zoomed in.
  if (zoom >= 0.75) {
    const baseSeed = hash2i(gridX, gridY, 771);
    const rnd = mulberry32(baseSeed);
    for (let i = 0; i < (opts.quality === 'low' ? 3 : 6); i++) {
      const px = screenX + TILE_WIDTH * (0.18 + rnd() * 0.64);
      const py = screenY + TILE_HEIGHT * (0.45 + rnd() * 0.45);
      const r = 0.9 + rnd() * 1.8;
      ctx.fillStyle = `rgba(15, 18, 22, ${0.18 + rnd() * 0.18})`;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(220, 225, 230, ${0.10 + rnd() * 0.10})`;
      ctx.beginPath();
      ctx.arc(px - r * 0.25, py - r * 0.25, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

export function drawRoNRealisticWaterTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  adjacentWater: { north: boolean; east: boolean; south: boolean; west: boolean } | undefined,
  opts: RoNGraphicsOptions
): void {
  const patterns = getRoNMaterialPatterns(ctx, opts.quality);
  if (!patterns) return;

  const aw = adjacentWater ?? { north: true, east: true, south: true, west: true };
  const open = (aw.north ? 1 : 0) + (aw.east ? 1 : 0) + (aw.south ? 1 : 0) + (aw.west ? 1 : 0);
  const shore = clamp01(1 - open / 4); // 0 = open water, 1 = tight shore

  ctx.save();
  clipDiamond(ctx, screenX, screenY);

  // Base water albedo (world-aligned).
  ctx.save();
  ctx.translate(-gridX * TILE_WIDTH, -gridY * TILE_HEIGHT);
  ctx.fillStyle = patterns.water;
  ctx.globalAlpha = 1;
  ctx.fillRect(gridX * TILE_WIDTH, gridY * TILE_HEIGHT, TILE_WIDTH, TILE_HEIGHT);
  ctx.restore();

  // Depth + turbidity near shore.
  const shallowTint = mixHex('#1d6b84', '#2ea2b8', 0.25);
  const deepTint = '#071b26';
  const depthColor = mixHex(deepTint, shallowTint, clamp01(0.25 + shore * 0.85));
  ctx.fillStyle = withAlpha(depthColor, 0.22);
  ctx.fillRect(screenX, screenY, TILE_WIDTH, TILE_HEIGHT);

  // Animated ripples/specular caustics.
  ctx.save();
  const t = opts.time;
  const dx = Math.cos(t * 0.35) * 18;
  const dy = Math.sin(t * 0.28) * 12;
  ctx.translate(dx, dy);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = patterns.waterDetail;
  ctx.fillRect(screenX - TILE_WIDTH, screenY - TILE_HEIGHT, TILE_WIDTH * 3, TILE_HEIGHT * 3);
  ctx.restore();

  // Gentle highlight toward top edge (sky reflection).
  const skyReflect = ctx.createLinearGradient(screenX, screenY, screenX, screenY + TILE_HEIGHT);
  skyReflect.addColorStop(0, 'rgba(200, 235, 255, 0.10)');
  skyReflect.addColorStop(0.45, 'rgba(200, 235, 255, 0.02)');
  skyReflect.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = skyReflect;
  ctx.fillRect(screenX, screenY, TILE_WIDTH, TILE_HEIGHT);

  // Shore foam when not fully surrounded by water.
  if (shore > 0.001) {
    ctx.save();
    ctx.globalAlpha = 0.35 + shore * 0.35;
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = patterns.foam;
    // Slight animation to avoid static “sticker foam”.
    const fx = Math.sin(t * 0.65 + gridX * 0.13) * 6;
    const fy = Math.cos(t * 0.55 + gridY * 0.17) * 5;
    ctx.translate(fx, fy);
    ctx.fillRect(screenX - TILE_WIDTH, screenY - TILE_HEIGHT, TILE_WIDTH * 3, TILE_HEIGHT * 3);
    ctx.restore();
  }

  ctx.restore();
}

export function drawRoNRealisticBeachOnWater(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  adjacentLand: { north: boolean; east: boolean; south: boolean; west: boolean },
  opts: RoNGraphicsOptions
): void {
  const patterns = getRoNMaterialPatterns(ctx, opts.quality);
  if (!patterns) return;

  const any = adjacentLand.north || adjacentLand.east || adjacentLand.south || adjacentLand.west;
  if (!any) return;

  // Beach band width: visually stronger than IsoCity’s sidewalk strip.
  const beachWidth = TILE_WIDTH * 0.11;

  // Compute diamond corners in screen space.
  const top = { x: screenX + TILE_WIDTH / 2, y: screenY };
  const right = { x: screenX + TILE_WIDTH, y: screenY + TILE_HEIGHT / 2 };
  const bottom = { x: screenX + TILE_WIDTH / 2, y: screenY + TILE_HEIGHT };
  const left = { x: screenX, y: screenY + TILE_HEIGHT / 2 };

  // Inward vectors from each edge towards center.
  const inward = {
    north: { dx: 0.707, dy: 0.707 },
    east: { dx: -0.707, dy: 0.707 },
    south: { dx: -0.707, dy: -0.707 },
    west: { dx: 0.707, dy: -0.707 },
  } as const;

  ctx.save();
  clipDiamond(ctx, screenX, screenY);

  // Sand texture band (world-aligned in screen space is OK; it’s a narrow strip).
  const drawBand = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    v: { dx: number; dy: number }
  ) => {
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = patterns.sand;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(b.x + v.dx * beachWidth, b.y + v.dy * beachWidth);
    ctx.lineTo(a.x + v.dx * beachWidth, a.y + v.dy * beachWidth);
    ctx.closePath();
    ctx.fill();

    // Wet sand darkening closer to water.
    const wet = ctx.createLinearGradient(a.x, a.y, a.x + v.dx * beachWidth, a.y + v.dy * beachWidth);
    wet.addColorStop(0, 'rgba(0,0,0,0.18)');
    wet.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = wet;
    ctx.fill();

    // Foam edge (thin, animated noise).
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = patterns.foam;
    const t = opts.time;
    ctx.translate(Math.sin(t * 0.8) * 4, Math.cos(t * 0.65) * 3);
    ctx.fillRect(screenX - TILE_WIDTH, screenY - TILE_HEIGHT, TILE_WIDTH * 3, TILE_HEIGHT * 3);
    ctx.restore();

    ctx.restore();
  };

  // Land adjacency indicates which edge gets a beach band.
  // Note: In RoNCanvas, "north" means tile at x-1 is land (the NW edge visually).
  if (adjacentLand.north) drawBand(left, top, inward.north);
  if (adjacentLand.east) drawBand(top, right, inward.east);
  if (adjacentLand.south) drawBand(right, bottom, inward.south);
  if (adjacentLand.west) drawBand(bottom, left, inward.west);

  ctx.restore();

  // Subtle warm highlight for sand (helps it read as beach at a glance).
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = 'rgba(255, 235, 190, 0.6)';
  ctx.fillRect(screenX, screenY, TILE_WIDTH, TILE_HEIGHT);
  ctx.restore();
}

/**
 * Convenience helper: turn a bright UI-ish team color into a more believable paint dye/cloth accent.
 */
export function toMutedAccent(teamColor: string): { accent: string; accentDark: string; accentLight: string } {
  const accent = desaturate(teamColor, 0.28);
  return {
    accent,
    accentDark: darken(desaturate(teamColor, 0.35), 0.22),
    accentLight: lighten(desaturate(teamColor, 0.15), 0.12),
  };
}

