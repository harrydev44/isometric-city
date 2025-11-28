/**
 * Day/night cycle lighting utilities.
 * Extracted from CanvasIsometricGrid.tsx for better code organization.
 */

import { Tile } from '@/types/game';
import { TILE_WIDTH, TILE_HEIGHT } from './types';

// ============================================================================
// Lighting Calculation Utilities
// ============================================================================

/**
 * Calculate darkness level based on hour (0-23).
 * Dawn: 5-7, Day: 7-18, Dusk: 18-20, Night: 20-5
 */
export function getDarkness(hour: number): number {
  if (hour >= 7 && hour < 18) return 0; // Full daylight
  if (hour >= 5 && hour < 7) return 1 - (hour - 5) / 2; // Dawn transition
  if (hour >= 18 && hour < 20) return (hour - 18) / 2; // Dusk transition
  return 1; // Night
}

/**
 * Get ambient color based on time of day.
 */
export function getAmbientColor(hour: number): { r: number; g: number; b: number } {
  if (hour >= 7 && hour < 18) return { r: 255, g: 255, b: 255 };
  if (hour >= 5 && hour < 7) {
    const t = (hour - 5) / 2;
    return { r: Math.round(60 + 40 * t), g: Math.round(40 + 30 * t), b: Math.round(70 + 20 * t) };
  }
  if (hour >= 18 && hour < 20) {
    const t = (hour - 18) / 2;
    return { r: Math.round(100 - 40 * t), g: Math.round(70 - 30 * t), b: Math.round(90 - 20 * t) };
  }
  return { r: 20, g: 30, b: 60 };
}

/**
 * Pseudo-random number generator based on seed.
 * Used for consistent window lighting positions.
 */
export function pseudoRandom(seed: number, n: number): number {
  const s = Math.sin(seed + n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

// ============================================================================
// Building Type Sets for Lighting
// ============================================================================

/**
 * Building types that do not have lights.
 */
export const NON_LIT_TYPES = new Set([
  'grass', 'empty', 'water', 'road', 'tree', 'park', 'park_large', 'tennis'
]);

/**
 * Residential building types.
 */
export const RESIDENTIAL_TYPES = new Set([
  'house_small', 'house_medium', 'mansion', 'apartment_low', 'apartment_high'
]);

/**
 * Commercial building types.
 */
export const COMMERCIAL_TYPES = new Set([
  'shop_small', 'shop_medium', 'office_low', 'office_high', 'mall'
]);

// ============================================================================
// Light Source Types
// ============================================================================

export type LightCutout = {
  x: number;
  y: number;
  type: 'road' | 'building';
  buildingType?: string;
  seed?: number;
};

export type ColoredGlow = {
  x: number;
  y: number;
  type: string;
};

// ============================================================================
// Light Source Collection
// ============================================================================

/**
 * Collect light sources from visible tiles for rendering.
 */
export function collectLightSources(
  grid: Tile[][],
  minGridX: number,
  maxGridX: number,
  minGridY: number,
  maxGridY: number,
  viewLeft: number,
  viewRight: number,
  viewTop: number,
  viewBottom: number
): { lightCutouts: LightCutout[]; coloredGlows: ColoredGlow[] } {
  const lightCutouts: LightCutout[] = [];
  const coloredGlows: ColoredGlow[] = [];

  for (let y = minGridY; y <= maxGridY; y++) {
    for (let x = minGridX; x <= maxGridX; x++) {
      const screenX = (x - y) * TILE_WIDTH / 2;
      const screenY = (x + y) * TILE_HEIGHT / 2;

      // Viewport culling
      if (screenX + TILE_WIDTH < viewLeft || screenX > viewRight ||
          screenY + TILE_HEIGHT * 3 < viewTop || screenY > viewBottom) {
        continue;
      }

      const tile = grid[y]?.[x];
      if (!tile) continue;
      
      const buildingType = tile.building.type;

      if (buildingType === 'road') {
        lightCutouts.push({ x, y, type: 'road' });
        coloredGlows.push({ x, y, type: 'road' });
      } else if (!NON_LIT_TYPES.has(buildingType) && tile.building.powered) {
        lightCutouts.push({ x, y, type: 'building', buildingType, seed: x * 1000 + y });

        // Check for special colored glows
        if (buildingType === 'hospital' || buildingType === 'fire_station' ||
            buildingType === 'police_station' || buildingType === 'power_plant') {
          coloredGlows.push({ x, y, type: buildingType });
        }
      }
    }
  }

  return { lightCutouts, coloredGlows };
}

// ============================================================================
// Light Rendering
// ============================================================================

/**
 * Render a road light cutout.
 */
export function renderRoadLightCutout(
  ctx: CanvasRenderingContext2D,
  tileCenterX: number,
  tileCenterY: number,
  lightIntensity: number
): void {
  const lightRadius = 28;
  const gradient = ctx.createRadialGradient(tileCenterX, tileCenterY, 0, tileCenterX, tileCenterY, lightRadius);
  gradient.addColorStop(0, `rgba(255, 255, 255, ${0.7 * lightIntensity})`);
  gradient.addColorStop(0.4, `rgba(255, 255, 255, ${0.35 * lightIntensity})`);
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(tileCenterX, tileCenterY, lightRadius, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Render a building light cutout with window lights.
 */
export function renderBuildingLightCutout(
  ctx: CanvasRenderingContext2D,
  tileCenterX: number,
  tileCenterY: number,
  buildingType: string,
  seed: number,
  lightIntensity: number
): void {
  const isResidential = RESIDENTIAL_TYPES.has(buildingType);
  const isCommercial = COMMERCIAL_TYPES.has(buildingType);
  const glowStrength = isCommercial ? 0.85 : isResidential ? 0.6 : 0.7;

  let numWindows = 2;
  if (buildingType.includes('medium') || buildingType.includes('low')) numWindows = 3;
  if (buildingType.includes('high') || buildingType === 'mall') numWindows = 5;
  if (buildingType === 'mansion' || buildingType === 'office_high') numWindows = 4;

  const windowSize = 5;
  const buildingHeight = -18;

  for (let i = 0; i < numWindows; i++) {
    const isLit = pseudoRandom(seed, i) < (isResidential ? 0.55 : 0.75);
    if (!isLit) continue;

    const wx = tileCenterX + (pseudoRandom(seed, i + 10) - 0.5) * 22;
    const wy = tileCenterY + buildingHeight + (pseudoRandom(seed, i + 20) - 0.5) * 16;

    const gradient = ctx.createRadialGradient(wx, wy, 0, wx, wy, windowSize * 2.5);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${glowStrength * lightIntensity})`);
    gradient.addColorStop(0.5, `rgba(255, 255, 255, ${glowStrength * 0.4 * lightIntensity})`);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(wx, wy, windowSize * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ground glow
  const groundGlow = ctx.createRadialGradient(
    tileCenterX, tileCenterY + TILE_HEIGHT / 4, 0,
    tileCenterX, tileCenterY + TILE_HEIGHT / 4, TILE_WIDTH * 0.6
  );
  groundGlow.addColorStop(0, `rgba(255, 255, 255, ${0.25 * lightIntensity})`);
  groundGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = groundGlow;
  ctx.beginPath();
  ctx.ellipse(tileCenterX, tileCenterY + TILE_HEIGHT / 4, TILE_WIDTH * 0.6, TILE_HEIGHT / 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Render a colored glow for roads or special buildings.
 */
export function renderColoredGlow(
  ctx: CanvasRenderingContext2D,
  tileCenterX: number,
  tileCenterY: number,
  glowType: string,
  lightIntensity: number
): void {
  if (glowType === 'road') {
    const gradient = ctx.createRadialGradient(tileCenterX, tileCenterY, 0, tileCenterX, tileCenterY, 20);
    gradient.addColorStop(0, `rgba(255, 210, 130, ${0.25 * lightIntensity})`);
    gradient.addColorStop(0.5, `rgba(255, 190, 100, ${0.1 * lightIntensity})`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(tileCenterX, tileCenterY, 20, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  let glowColor: { r: number; g: number; b: number } | null = null;
  let glowRadius = 20;

  if (glowType === 'hospital') {
    glowColor = { r: 255, g: 80, b: 80 };
    glowRadius = 25;
  } else if (glowType === 'fire_station') {
    glowColor = { r: 255, g: 100, b: 50 };
    glowRadius = 22;
  } else if (glowType === 'police_station') {
    glowColor = { r: 60, g: 140, b: 255 };
    glowRadius = 22;
  } else if (glowType === 'power_plant') {
    glowColor = { r: 255, g: 200, b: 50 };
    glowRadius = 30;
  }

  if (glowColor) {
    const gradient = ctx.createRadialGradient(
      tileCenterX, tileCenterY - 15, 0,
      tileCenterX, tileCenterY - 15, glowRadius
    );
    gradient.addColorStop(0, `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, ${0.4 * lightIntensity})`);
    gradient.addColorStop(0.5, `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, ${0.15 * lightIntensity})`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(tileCenterX, tileCenterY - 15, glowRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Grid to screen coordinate conversion for lighting.
 */
export function lightingGridToScreen(gx: number, gy: number): { screenX: number; screenY: number } {
  return {
    screenX: (gx - gy) * TILE_WIDTH / 2,
    screenY: (gx + gy) * TILE_HEIGHT / 2,
  };
}
