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
import { WATER_ASSET_PATH } from '../constants';
import { getPattern, hash2D, mixHex } from './terrainTextures';

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
};
export type { TileColorScheme };

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
  zone: 'none' | 'residential' | 'commercial' | 'industrial' = 'none',
  zoom: number = 1,
  highlight: boolean = false
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const colors = ZONE_COLORS[zone];

  const cx = screenX + w / 2;
  const cy = screenY + h / 2;

  // Slight per-tile tone variance to avoid flat repeating look.
  // (Use screen coords for stability across grid transforms.)
  const seed = hash2D((screenX / 4) | 0, (screenY / 4) | 0, zone.length);
  const t = (seed % 1000) / 1000;

  // Base lighting gradient across the tile (gives "form" / sun direction).
  const light = mixHex(colors.top, '#7ddf6a', 0.12 * t);
  const dark = mixHex(colors.top, '#1b2a1b', 0.14 * (1 - t));
  const g = ctx.createLinearGradient(screenX, screenY, screenX + w, screenY + h);
  g.addColorStop(0, light);
  g.addColorStop(0.55, colors.top);
  g.addColorStop(1, dark);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.clip();

  // Base fill
  ctx.fillStyle = g;
  ctx.fillRect(screenX - 2, screenY - 2, w + 4, h + 4);

  // Texture overlay (cached patterns)
  // Keep subtle at low zoom; increase slightly when zoomed in.
  const textureAlpha = Math.max(0.08, Math.min(0.22, 0.08 + (zoom - 0.5) * 0.10));
  ctx.globalAlpha = textureAlpha;
  ctx.globalCompositeOperation = 'multiply';
  ctx.translate(-((screenX + (seed % 17)) % 128), -((screenY + ((seed >> 8) % 17)) % 128));
  ctx.fillStyle = getPattern(ctx, zone === 'industrial' ? 'dirt' : 'grass');
  ctx.fillRect(screenX - 130, screenY - 130, w + 260, h + 260);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Subtle specular highlight
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.06 + (zoom >= 1 ? 0.04 : 0);
  const hg = ctx.createRadialGradient(cx - w * 0.15, cy - h * 0.20, 0, cx - w * 0.15, cy - h * 0.20, w * 0.85);
  hg.addColorStop(0, 'rgba(255,255,255,0.9)');
  hg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hg;
  ctx.fillRect(screenX - 2, screenY - 2, w + 4, h + 4);

  ctx.restore();

  // Crisp edge + faint micro-shadow gives much more depth.
  if (zoom >= 0.55) {
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, screenY);
    ctx.lineTo(screenX + w, cy);
    ctx.lineTo(cx, screenY + h);
    ctx.lineTo(screenX, cy);
    ctx.closePath();
    ctx.stroke();
  }

  // Zone border for zoned tiles
  if (zone !== 'none' && zoom >= 0.95) {
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 2]);
    ctx.beginPath();
    ctx.moveTo(cx, screenY);
    ctx.lineTo(screenX + w, cy);
    ctx.lineTo(cx, screenY + h);
    ctx.lineTo(screenX, cy);
    ctx.closePath();
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
  adjacentWater?: { north: boolean; east: boolean; south: boolean; west: boolean },
  timeSeconds?: number
): void {
  const waterImage = getCachedImage(WATER_ASSET_PATH);
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const t = timeSeconds ?? performance.now() / 1000;
  
  if (!waterImage) {
    // Fallback: draw solid blue tile
    ctx.fillStyle = '#2563eb';
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

  // Base water gradient (deep -> shallow) + subtle lighting
  const base = ctx.createLinearGradient(screenX, screenY, screenX + w, screenY + h);
  base.addColorStop(0, '#0b2a4a');
  base.addColorStop(0.55, '#0f4c6a');
  base.addColorStop(1, '#0a5a73');
  ctx.fillStyle = base;
  ctx.fillRect(screenX - 2, screenY - 2, w + 4, h + 4);
  
  const aspectRatio = cropH / cropW;
  const jitterX = (seedX - 0.5) * w * 0.3;
  const jitterY = (seedY - 0.5) * h * 0.3;
  
  // Draw water texture (as a mid-frequency detail layer)
  const destWidth = w * 1.15;
  const destHeight = destWidth * aspectRatio;

  const prevSmoothing = ctx.imageSmoothingEnabled;
  const prevQuality = (ctx as any).imageSmoothingQuality;
  ctx.imageSmoothingEnabled = true;
  (ctx as any).imageSmoothingQuality = 'high';

  ctx.globalAlpha = 0.55;
  ctx.drawImage(
    waterImage,
    srcX, srcY, cropW, cropH,
    Math.round(tileCenterX - destWidth / 2 + jitterX * 0.3),
    Math.round(tileCenterY - destHeight / 2 + jitterY * 0.3),
    Math.round(destWidth),
    Math.round(destHeight)
  );

  // Animated ripples + caustics-like highlights (cheap: repeating pattern + translation)
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.10;
  const ripplePattern = getPattern(ctx, 'ripples');
  ctx.translate(-((tileCenterX + t * 14 + gridX * 7) % 256), -((tileCenterY + t * 9 + gridY * 11) % 256));
  ctx.fillStyle = ripplePattern;
  ctx.fillRect(screenX - 260, screenY - 260, w + 520, h + 520);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Edge deepening where this water meets land (pre-beach pass)
  if (adjacentWater) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#062035';
    const cx = screenX + w / 2;
    const cy = screenY + h / 2;
    // north edge (left->top)
    if (!adjacentWater.north) {
      ctx.beginPath();
      ctx.moveTo(screenX, cy);
      ctx.lineTo(cx, screenY);
      ctx.lineTo(cx, screenY + h * 0.18);
      ctx.lineTo(screenX + w * 0.18, cy);
      ctx.closePath();
      ctx.fill();
    }
    // east edge (top->right)
    if (!adjacentWater.east) {
      ctx.beginPath();
      ctx.moveTo(cx, screenY);
      ctx.lineTo(screenX + w, cy);
      ctx.lineTo(screenX + w - w * 0.18, cy);
      ctx.lineTo(cx, screenY + h * 0.18);
      ctx.closePath();
      ctx.fill();
    }
    // south edge (right->bottom)
    if (!adjacentWater.south) {
      ctx.beginPath();
      ctx.moveTo(screenX + w, cy);
      ctx.lineTo(cx, screenY + h);
      ctx.lineTo(cx, screenY + h - h * 0.18);
      ctx.lineTo(screenX + w - w * 0.18, cy);
      ctx.closePath();
      ctx.fill();
    }
    // west edge (bottom->left)
    if (!adjacentWater.west) {
      ctx.beginPath();
      ctx.moveTo(cx, screenY + h);
      ctx.lineTo(screenX, cy);
      ctx.lineTo(screenX + w * 0.18, cy);
      ctx.lineTo(cx, screenY + h - h * 0.18);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Restore smoothing state
  ctx.imageSmoothingEnabled = prevSmoothing;
  (ctx as any).imageSmoothingQuality = prevQuality;
  
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
