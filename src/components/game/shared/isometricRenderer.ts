/**
 * Shared Isometric Rendering System
 * 
 * This module provides core isometric rendering functionality that can be reused
 * across different games (IsoCity, Rise of Nations, etc.)
 */

import { TILE_WIDTH, TILE_HEIGHT } from '../types';
import { gridToScreen, screenToGrid, screenToGridRaw } from '../utils';
import { 
  drawGreenBaseTile, 
  drawGreyBaseTile, 
  drawIsometricDiamond,
  ZONE_COLORS,
  GREY_TILE_COLORS,
  TileColorScheme,
} from '../drawing';
import { loadImage, loadSpriteImage, getCachedImage, onImageLoaded } from '../imageLoader';
import { WATER_ASSET_PATH, WATER_ASSET_PATHS } from '../constants';

// Re-export commonly used items
export {
  TILE_WIDTH,
  TILE_HEIGHT,
  gridToScreen,
  screenToGrid,
  screenToGridRaw,
  loadImage,
  loadSpriteImage,
  getCachedImage,
  onImageLoaded,
  drawGreenBaseTile,
  drawGreyBaseTile,
  drawIsometricDiamond,
  ZONE_COLORS,
  GREY_TILE_COLORS,
  WATER_ASSET_PATH,
  WATER_ASSET_PATHS,
};
export type { TileColorScheme };

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hash2i(x: number, y: number): number {
  // Deterministic integer hash (fast, stable across sessions)
  let h = (x | 0) * 374761393 + (y | 0) * 668265263;
  h = (h ^ (h >>> 13)) | 0;
  h = (h * 1274126177) | 0;
  return h ^ (h >>> 16);
}

function rand01FromHash(h: number): number {
  // Map unsigned 32-bit int -> [0,1)
  return ((h >>> 0) % 1000000) / 1000000;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '').trim();
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  if (full.length !== 6) return null;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const rr = clamp(Math.round(r), 0, 255).toString(16).padStart(2, '0');
  const gg = clamp(Math.round(g), 0, 255).toString(16).padStart(2, '0');
  const bb = clamp(Math.round(b), 0, 255).toString(16).padStart(2, '0');
  return `#${rr}${gg}${bb}`;
}

function mixHex(a: string, b: string, t: number): string {
  const ar = hexToRgb(a);
  const br = hexToRgb(b);
  if (!ar || !br) return a;
  return rgbToHex(
    lerp(ar.r, br.r, t),
    lerp(ar.g, br.g, t),
    lerp(ar.b, br.b, t)
  );
}

const _patternCache = new Map<string, CanvasPattern>();

function getPattern(
  ctx: CanvasRenderingContext2D,
  key: string,
  size: number,
  draw: (pctx: CanvasRenderingContext2D, s: number) => void
): CanvasPattern {
  const cacheKey = `${key}:${size}`;
  const existing = _patternCache.get(cacheKey);
  if (existing) return existing;

  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const pctx = c.getContext('2d');
  if (!pctx) {
    const fallback = ctx.createPattern(c, 'repeat');
    if (!fallback) throw new Error('Failed to create canvas pattern');
    _patternCache.set(cacheKey, fallback);
    return fallback;
  }

  draw(pctx, size);
  const pattern = ctx.createPattern(c, 'repeat');
  if (!pattern) throw new Error('Failed to create canvas pattern');
  _patternCache.set(cacheKey, pattern);
  return pattern;
}

/**
 * Viewport bounds for culling off-screen tiles
 */
export interface ViewBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Camera state for isometric rendering
 */
export interface IsometricCamera {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

/**
 * Basic tile data required for rendering
 */
export interface RenderableTile {
  x: number;
  y: number;
  terrain?: 'grass' | 'water' | 'forest' | 'desert' | 'mountain';
  buildingType?: string;
  ownerId?: string;
  highlight?: boolean;
}

/**
 * Calculate view bounds for tile culling
 */
export function calculateViewBounds(
  canvas: HTMLCanvasElement,
  camera: IsometricCamera,
  padding: number = TILE_WIDTH * 2
): ViewBounds {
  const dpr = window.devicePixelRatio || 1;
  const viewWidth = canvas.width / (dpr * camera.zoom);
  const viewHeight = canvas.height / (dpr * camera.zoom);
  
  return {
    left: -camera.offsetX / camera.zoom - padding,
    top: -camera.offsetY / camera.zoom - padding * 2,
    right: viewWidth - camera.offsetX / camera.zoom + padding,
    bottom: viewHeight - camera.offsetY / camera.zoom + padding * 2,
  };
}

/**
 * Check if a tile position is within view bounds
 */
export function isTileVisible(
  screenX: number,
  screenY: number,
  bounds: ViewBounds
): boolean {
  return screenX >= bounds.left && screenX <= bounds.right &&
         screenY >= bounds.top && screenY <= bounds.bottom;
}

/**
 * Draw an isometric tile highlight (hover/selection)
 */
export function drawTileHighlight(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  style: 'hover' | 'selected' | 'attack' | 'move' | 'invalid' = 'hover'
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  // Style-specific colors
  const styles = {
    hover: { fill: 'rgba(255, 255, 255, 0.25)', stroke: '#ffffff', lineWidth: 2 },
    selected: { fill: 'rgba(34, 197, 94, 0.3)', stroke: '#22c55e', lineWidth: 2.5 },
    attack: { fill: 'rgba(239, 68, 68, 0.3)', stroke: '#ef4444', lineWidth: 2.5 },
    move: { fill: 'rgba(59, 130, 246, 0.25)', stroke: '#3b82f6', lineWidth: 2 },
    invalid: { fill: 'rgba(239, 68, 68, 0.4)', stroke: '#dc2626', lineWidth: 2.5 },
  };
  
  const s = styles[style];
  
  // Draw fill
  ctx.fillStyle = s.fill;
  ctx.beginPath();
  ctx.moveTo(screenX + w / 2, screenY);
  ctx.lineTo(screenX + w, screenY + h / 2);
  ctx.lineTo(screenX + w / 2, screenY + h);
  ctx.lineTo(screenX, screenY + h / 2);
  ctx.closePath();
  ctx.fill();
  
  // Draw border
  ctx.strokeStyle = s.stroke;
  ctx.lineWidth = s.lineWidth;
  ctx.stroke();
}

/**
 * Draw a grass/ground tile with optional zone coloring
 */
export function drawGroundTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  zone: 'none' | 'residential' | 'commercial' | 'industrial' = 'none',
  zoom: number = 1,
  highlight: boolean = false,
  adjacentWater?: { north: boolean; east: boolean; south: boolean; west: boolean }
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const colors = ZONE_COLORS[zone];

  // Per-tile variation (prevents flat-looking terrain)
  const h1 = hash2i(gridX, gridY);
  const v = rand01FromHash(h1);
  const v2 = rand01FromHash(hash2i(gridX + 17, gridY - 23));

  // Sun-ish gradient from NW -> SE
  const shadeA = mixHex(colors.top, '#244225', 0.18 + v * 0.08);
  const shadeB = mixHex(colors.top, '#7bdc6e', 0.10 + v2 * 0.10);
  const gradient = ctx.createLinearGradient(screenX, screenY, screenX + w, screenY + h);
  gradient.addColorStop(0, shadeB);
  gradient.addColorStop(0.55, colors.top);
  gradient.addColorStop(1, shadeA);

  // Base diamond
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(screenX + w / 2, screenY);
  ctx.lineTo(screenX + w, screenY + h / 2);
  ctx.lineTo(screenX + w / 2, screenY + h);
  ctx.lineTo(screenX, screenY + h / 2);
  ctx.closePath();
  ctx.fill();

  // Texture overlay (cached repeating pattern; offset per tile for variety)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(screenX + w / 2, screenY);
  ctx.lineTo(screenX + w, screenY + h / 2);
  ctx.lineTo(screenX + w / 2, screenY + h);
  ctx.lineTo(screenX, screenY + h / 2);
  ctx.closePath();
  ctx.clip();

  const grassPattern = getPattern(ctx, 'grass', 96, (pctx, s) => {
    pctx.clearRect(0, 0, s, s);
    // Base speckles + micro blades
    for (let i = 0; i < 520; i++) {
      const x = (i * 73) % s;
      const y = (i * 151) % s;
      const t = (i * 97) % 1000;
      const alpha = 0.035 + (t / 1000) * 0.06;
      pctx.fillStyle = i % 3 === 0
        ? `rgba(25, 60, 25, ${alpha})`
        : `rgba(190, 235, 170, ${alpha * 0.75})`;
      pctx.fillRect(x, y, 1, 1);
      if (i % 13 === 0) {
        pctx.strokeStyle = `rgba(40, 95, 40, ${alpha * 0.9})`;
        pctx.lineWidth = 1;
        pctx.beginPath();
        pctx.moveTo(x, y);
        pctx.lineTo(x + 2, y + 3);
        pctx.stroke();
      }
    }
    // Occasional dry/dirt flecks
    for (let i = 0; i < 140; i++) {
      const x = (i * 41) % s;
      const y = (i * 89) % s;
      pctx.fillStyle = 'rgba(120, 95, 55, 0.055)';
      pctx.fillRect(x, y, 2, 1);
    }
  });

  const offX = ((h1 >>> 0) % 97) - 48;
  const offY = ((hash2i(gridX - 9, gridY + 7) >>> 0) % 97) - 48;
  ctx.translate(screenX + offX, screenY + offY);
  ctx.globalAlpha = zoom >= 0.7 ? 0.32 : 0.22;
  ctx.fillStyle = grassPattern;
  ctx.fillRect(-offX, -offY, w + 128, h + 128);

  // Moist edge darkening near water (subtle, but adds a lot of "realism")
  if (adjacentWater && (adjacentWater.north || adjacentWater.east || adjacentWater.south || adjacentWater.west)) {
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = 'rgba(10, 40, 30, 1)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
  
  // Draw grid lines when zoomed in
  if (zoom >= 0.6) {
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
  
  // Draw zone border for zoned tiles
  if (zone !== 'none' && zoom >= 0.95) {
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 2]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  
  if (highlight) {
    drawTileHighlight(ctx, screenX, screenY, 'hover');
  }
}

/**
 * Draw a water tile with texture
 */
export function drawWaterTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  adjacentWater?: { north: boolean; east: boolean; south: boolean; west: boolean }
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;

  // Pick among multiple water textures for variety (fallback to WATER_ASSET_PATH)
  const pick = Math.abs(hash2i(gridX * 3, gridY * 7)) % WATER_ASSET_PATHS.length;
  const waterSrc = WATER_ASSET_PATHS[pick] || WATER_ASSET_PATH;
  const waterImage = getCachedImage(waterSrc) || getCachedImage(WATER_ASSET_PATH);
  
  if (!waterImage) {
    // Fallback: draw solid blue tile
    const g = ctx.createLinearGradient(screenX, screenY, screenX + w, screenY + h);
    g.addColorStop(0, '#1d4ed8');
    g.addColorStop(0.55, '#2563eb');
    g.addColorStop(1, '#0ea5e9');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(screenX + w / 2, screenY);
    ctx.lineTo(screenX + w, screenY + h / 2);
    ctx.lineTo(screenX + w / 2, screenY + h);
    ctx.lineTo(screenX, screenY + h / 2);
    ctx.closePath();
    ctx.fill();
    return;
  }
  
  const tileCenterX = screenX + w / 2;
  const tileCenterY = screenY + h / 2;
  
  // Deterministic "random" offset based on tile position for variety
  const seedX = ((gridX * 7919 + gridY * 6271) % 1000) / 1000;
  const seedY = ((gridX * 4177 + gridY * 9311) % 1000) / 1000;
  
  const imgW = waterImage.naturalWidth || waterImage.width;
  const imgH = waterImage.naturalHeight || waterImage.height;
  
  // Take a subcrop for variety
  const cropScale = 0.35;
  const cropW = imgW * cropScale;
  const cropH = imgH * cropScale;
  const maxOffsetX = imgW - cropW;
  const maxOffsetY = imgH - cropH;
  const srcX = seedX * maxOffsetX;
  const srcY = seedY * maxOffsetY;
  
  ctx.save();
  
  // Clip to isometric diamond shape
  ctx.beginPath();
  ctx.moveTo(screenX + w / 2, screenY);
  ctx.lineTo(screenX + w, screenY + h / 2);
  ctx.lineTo(screenX + w / 2, screenY + h);
  ctx.lineTo(screenX, screenY + h / 2);
  ctx.closePath();
  ctx.clip();
  
  const aspectRatio = cropH / cropW;
  const jitterX = (seedX - 0.5) * w * 0.3;
  const jitterY = (seedY - 0.5) * h * 0.3;
  
  // Draw water texture (slight animated drift)
  const destWidth = w * 1.15;
  const destHeight = destWidth * aspectRatio;
  const time = performance.now() / 1000;
  const driftX = Math.sin(time * 0.35 + (gridX + gridY) * 0.15) * 2.2;
  const driftY = Math.cos(time * 0.28 + (gridX - gridY) * 0.12) * 1.6;

  ctx.globalAlpha = 0.96;
  ctx.drawImage(
    waterImage,
    srcX, srcY, cropW, cropH,
    Math.round(tileCenterX - destWidth / 2 + jitterX * 0.3 + driftX),
    Math.round(tileCenterY - destHeight / 2 + jitterY * 0.3 + driftY),
    Math.round(destWidth),
    Math.round(destHeight)
  );

  // Shore shallows + foam for edges adjacent to land (adjacentWater=false)
  if (adjacentWater) {
    const corners = {
      top: { x: screenX + w / 2, y: screenY },
      right: { x: screenX + w, y: screenY + h / 2 },
      bottom: { x: screenX + w / 2, y: screenY + h },
      left: { x: screenX, y: screenY + h / 2 },
    };

    // Inward vectors (toward tile center) for each edge
    const inv = {
      north: { dx: 0.707, dy: 0.707 },
      east: { dx: -0.707, dy: 0.707 },
      south: { dx: -0.707, dy: -0.707 },
      west: { dx: 0.707, dy: -0.707 },
    };

    const drawEdgeShallows = (a: { x: number; y: number }, b: { x: number; y: number }, inwardDx: number, inwardDy: number, intensity: number) => {
      const shallowW = w * 0.12;

      // Shallow water tint (screen blend)
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.35 * intensity;
      const g = ctx.createLinearGradient(a.x, a.y, a.x + inwardDx * shallowW, a.y + inwardDy * shallowW);
      g.addColorStop(0, 'rgba(90, 240, 230, 0.9)');
      g.addColorStop(1, 'rgba(30, 160, 210, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(b.x + inwardDx * shallowW, b.y + inwardDy * shallowW);
      ctx.lineTo(a.x + inwardDx * shallowW, a.y + inwardDy * shallowW);
      ctx.closePath();
      ctx.fill();

      // Foam line
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.28 * intensity;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.2;
      const wobble = Math.sin(time * 1.2 + (gridX * 0.9 + gridY * 0.7)) * 0.8;
      ctx.beginPath();
      ctx.moveTo(a.x + inwardDx * (shallowW * 0.65) + wobble, a.y + inwardDy * (shallowW * 0.65));
      ctx.lineTo(b.x + inwardDx * (shallowW * 0.65) + wobble, b.y + inwardDy * (shallowW * 0.65));
      ctx.stroke();

      ctx.globalCompositeOperation = 'source-over';
    };

    if (!adjacentWater.north) drawEdgeShallows(corners.left, corners.top, inv.north.dx, inv.north.dy, 1);
    if (!adjacentWater.east) drawEdgeShallows(corners.top, corners.right, inv.east.dx, inv.east.dy, 0.95);
    if (!adjacentWater.south) drawEdgeShallows(corners.right, corners.bottom, inv.south.dx, inv.south.dy, 0.9);
    if (!adjacentWater.west) drawEdgeShallows(corners.bottom, corners.left, inv.west.dx, inv.west.dy, 0.95);
  }

  // Caustic highlights (subtle animated sparkle)
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.14;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const s = hash2i(gridX * 11 + i * 19, gridY * 13 - i * 7);
    const rx = rand01FromHash(s);
    const ry = rand01FromHash(hash2i(s, s ^ 0x9e3779b9));
    const px = screenX + rx * w;
    const py = screenY + ry * h;
    const r = 3.5 + rand01FromHash(s ^ 0x7f4a7c15) * 4.5;
    const phase = time * (0.8 + rx * 0.9) + ry * 6.0;
    ctx.beginPath();
    ctx.arc(px, py, r, phase, phase + 1.2);
    ctx.stroke();
  }
  ctx.restore();
  
  ctx.restore();
}

/**
 * Draw a selection box (for drag-select)
 */
export function drawSelectionBox(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number
): void {
  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const w = Math.abs(endX - startX);
  const h = Math.abs(endY - startY);
  
  // Draw dashed border
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
  
  // Draw semi-transparent fill
  ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
  ctx.fillRect(x, y, w, h);
}

/**
 * Draw a unit circle with selection indicator
 */
export function drawUnit(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  color: string,
  isSelected: boolean,
  symbol: string = '•',
  zoom: number = 1
): void {
  const unitSize = 8 * zoom;
  const centerX = screenX + (TILE_WIDTH / 4) * zoom;
  const centerY = screenY - unitSize;
  
  // Unit body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(centerX, centerY, unitSize, 0, Math.PI * 2);
  ctx.fill();
  
  // Selection ring
  if (isSelected) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Selection glow
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, unitSize + 3, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  
  // Symbol
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.max(8, 10 * zoom)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, centerX, centerY);
}

/**
 * Draw a health bar
 */
export function drawHealthBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  healthPercent: number,
  zoom: number = 1
): void {
  const barHeight = 3 * zoom;
  
  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(x - 1, y - 1, width + 2, barHeight + 2);
  
  // Health bar (color based on health)
  ctx.fillStyle = healthPercent > 0.5 ? '#22c55e' : healthPercent > 0.25 ? '#eab308' : '#ef4444';
  ctx.fillRect(x, y, width * healthPercent, barHeight);
}

/**
 * Draw background sky gradient
 */
export function drawSkyBackground(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  timeOfDay: 'day' | 'night' | 'dawn' | 'dusk' = 'day'
): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  
  switch (timeOfDay) {
    case 'night':
      gradient.addColorStop(0, '#0f1419');
      gradient.addColorStop(0.5, '#141c24');
      gradient.addColorStop(1, '#1a2a1f');
      break;
    case 'dawn':
      gradient.addColorStop(0, '#1a365d');
      gradient.addColorStop(0.5, '#374151');
      gradient.addColorStop(1, '#92400e');
      break;
    case 'dusk':
      gradient.addColorStop(0, '#4c1d95');
      gradient.addColorStop(0.5, '#831843');
      gradient.addColorStop(1, '#1f2937');
      break;
    default: // day
      gradient.addColorStop(0, '#1e3a5f');
      gradient.addColorStop(0.5, '#2d4a6a');
      gradient.addColorStop(1, '#1a4a2e');
  }
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/**
 * Draw fire effect on a building
 * Used when buildings are on fire (IsoCity) or under attack (RoN)
 * 
 * @param ctx - Canvas 2D rendering context (already transformed for zoom/offset)
 * @param screenX - Screen X position of the tile (from gridToScreen)
 * @param screenY - Screen Y position of the tile (from gridToScreen)
 * @param animTime - Animation time in seconds for fire flickering
 * @param intensity - Fire intensity from 0 to 1 (default 1)
 */
export function drawFireEffect(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  animTime: number,
  intensity: number = 1
): void {
  const centerX = screenX + TILE_WIDTH / 2;
  const centerY = screenY + TILE_HEIGHT / 2;
  
  const pulse = Math.sin(animTime * 6) * 0.3 + 0.7;
  const outerPulse = Math.sin(animTime * 4) * 0.5 + 0.5;
  
  // Outer pulsing ring
  ctx.beginPath();
  ctx.arc(centerX, centerY - 12, 22 + outerPulse * 8, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(239, 68, 68, ${0.3 * (1 - outerPulse) * intensity})`;
  ctx.lineWidth = 2;
  ctx.stroke();
  
  ctx.save();
  ctx.translate(centerX, centerY - 15);
  
  // Red triangle/flame base
  ctx.fillStyle = `rgba(220, 38, 38, ${0.9 * pulse * intensity})`;
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(8, 5);
  ctx.lineTo(-8, 5);
  ctx.closePath();
  ctx.fill();
  
  // Border highlight
  ctx.strokeStyle = `rgba(252, 165, 165, ${pulse * intensity})`;
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // Yellow/orange flame inner
  ctx.fillStyle = `rgba(251, 191, 36, ${intensity})`;
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.quadraticCurveTo(2.5, 0, 2, 2.5);
  ctx.quadraticCurveTo(0.5, 1.5, 0, 2.5);
  ctx.quadraticCurveTo(-0.5, 1.5, -2, 2.5);
  ctx.quadraticCurveTo(-2.5, 0, 0, -3);
  ctx.fill();
  
  ctx.restore();
}

/**
 * Set up canvas for high-DPI rendering
 */
export function setupCanvas(
  canvas: HTMLCanvasElement,
  container: HTMLElement
): { width: number; height: number; dpr: number } {
  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();
  
  // Set display size
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  
  // Set actual size in memory (scaled for DPI)
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  
  return {
    width: canvas.width,
    height: canvas.height,
    dpr,
  };
}
