/**
 * Rise of Nations - Enhanced Graphics System
 * 
 * Provides high-fidelity terrain, water, lighting, and effects rendering
 * with a realistic, polished aesthetic that avoids the cartoony look.
 * Uses procedural noise for natural-looking textures and subtle animations.
 */

import { createNoise2D, NoiseFunction2D } from 'simplex-noise';
import { TILE_WIDTH, TILE_HEIGHT, gridToScreen } from '@/components/game/shared';

// ============================================================================
// NOISE GENERATORS (initialized lazily for performance)
// ============================================================================

let terrainNoise: NoiseFunction2D | null = null;
let grassDetailNoise: NoiseFunction2D | null = null;
let waterNoise: NoiseFunction2D | null = null;
let waveNoise: NoiseFunction2D | null = null;
let cloudNoise: NoiseFunction2D | null = null;
let sandNoise: NoiseFunction2D | null = null;
let rockNoise: NoiseFunction2D | null = null;
let vegetationNoise: NoiseFunction2D | null = null;

function getTerrainNoise(): NoiseFunction2D {
  if (!terrainNoise) terrainNoise = createNoise2D();
  return terrainNoise;
}

function getGrassDetailNoise(): NoiseFunction2D {
  if (!grassDetailNoise) grassDetailNoise = createNoise2D();
  return grassDetailNoise;
}

function getWaterNoise(): NoiseFunction2D {
  if (!waterNoise) waterNoise = createNoise2D();
  return waterNoise;
}

function getWaveNoise(): NoiseFunction2D {
  if (!waveNoise) waveNoise = createNoise2D();
  return waveNoise;
}

function getCloudNoise(): NoiseFunction2D {
  if (!cloudNoise) cloudNoise = createNoise2D();
  return cloudNoise;
}

function getSandNoise(): NoiseFunction2D {
  if (!sandNoise) sandNoise = createNoise2D();
  return sandNoise;
}

function getRockNoise(): NoiseFunction2D {
  if (!rockNoise) rockNoise = createNoise2D();
  return rockNoise;
}

function getVegetationNoise(): NoiseFunction2D {
  if (!vegetationNoise) vegetationNoise = createNoise2D();
  return vegetationNoise;
}

// ============================================================================
// REALISTIC COLOR PALETTES
// ============================================================================

/** 
 * Realistic grass palette - natural greens with subtle earth tones
 * Avoiding overly saturated/cartoony colors
 */
export const REALISTIC_GRASS_COLORS = {
  // Base natural grass tones (more muted and realistic)
  primary: { h: 95, s: 28, l: 38 },    // Natural grass green
  shadow: { h: 100, s: 22, l: 28 },    // Shaded grass
  highlight: { h: 88, s: 32, l: 48 },  // Sun-lit grass
  dry: { h: 55, s: 30, l: 42 },        // Dry/yellow patches
  moss: { h: 110, s: 20, l: 32 },      // Mossy areas
  earth: { h: 30, s: 35, l: 30 },      // Visible earth between grass
};

/** 
 * Realistic water palette - deep ocean blues with natural variation
 */
export const REALISTIC_WATER_COLORS = {
  deep: { h: 210, s: 55, l: 22 },      // Deep ocean
  mid: { h: 205, s: 50, l: 32 },       // Mid-depth
  shallow: { h: 195, s: 45, l: 45 },   // Shallow/coastal
  surface: { h: 200, s: 40, l: 55 },   // Surface reflection
  foam: { h: 195, s: 15, l: 92 },      // Foam/whitecaps
  sparkle: '#ffffff',                   // Sun sparkles
  darkDepth: { h: 215, s: 60, l: 15 }, // Very deep areas
};

/** 
 * Realistic sand/beach palette 
 */
export const REALISTIC_BEACH_COLORS = {
  dry: { h: 38, s: 35, l: 72 },        // Dry sand
  wet: { h: 35, s: 40, l: 52 },        // Wet sand near water
  dark: { h: 30, s: 30, l: 38 },       // Dark/wet sand
  pebbles: { h: 25, s: 18, l: 50 },    // Pebble areas
  foam: { h: 45, s: 10, l: 95 },       // Foam on beach
};

/** 
 * Realistic forest palette 
 */
export const REALISTIC_FOREST_COLORS = {
  canopy: { h: 120, s: 35, l: 22 },    // Dense canopy
  highlight: { h: 105, s: 40, l: 35 }, // Sun-lit leaves
  shadow: { h: 130, s: 28, l: 15 },    // Deep shadow
  trunk: { h: 25, s: 35, l: 25 },      // Tree trunks
  trunkLight: { h: 28, s: 30, l: 35 }, // Light bark
  undergrowth: { h: 95, s: 25, l: 28 },// Ground vegetation
};

/** 
 * Realistic mountain/rock palette 
 */
export const REALISTIC_MOUNTAIN_COLORS = {
  rock: { h: 25, s: 12, l: 42 },       // Grey-brown rock
  shadow: { h: 220, s: 10, l: 28 },    // Rock shadow
  highlight: { h: 35, s: 8, l: 58 },   // Sun-lit rock
  snow: { h: 210, s: 8, l: 95 },       // Snow caps
  snowShadow: { h: 215, s: 15, l: 85 },// Snow shadows
  ore: { h: 35, s: 50, l: 35 },        // Metal ore deposits
  oreShine: { h: 40, s: 60, l: 50 },   // Ore metallic shine
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** Convert HSL to CSS color string */
function hsl(h: number, s: number, l: number, a = 1): string {
  return a === 1 ? `hsl(${h}, ${s}%, ${l}%)` : `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

/** Lerp between two values */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/** Smooth step interpolation */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Get octave noise for more natural patterns */
function octaveNoise(
  noise: NoiseFunction2D,
  x: number,
  y: number,
  octaves: number,
  persistence: number,
  scale: number
): number {
  let total = 0;
  let frequency = scale;
  let amplitude = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    total += noise(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }

  return total / maxValue;
}

/** Clamp value between min and max */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Hash function for deterministic randomness */
function hash(x: number, y: number, seed: number = 0): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453123;
  return n - Math.floor(n);
}

// ============================================================================
// ENHANCED GRASS/TERRAIN RENDERING
// ============================================================================

export interface GrassRenderOptions {
  ambient?: number;         // 0-1 ambient light level
  highlight?: boolean;      // Hover highlight
  selected?: boolean;       // Selection state
  timeOfDay?: 'day' | 'dawn' | 'dusk' | 'night';
  season?: 'spring' | 'summer' | 'autumn' | 'winter';
}

/**
 * Render enhanced grass terrain with realistic procedural texturing
 * Creates natural-looking grass with subtle color variation and detail
 */
export function drawEnhancedGrassTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  zoom: number,
  options: GrassRenderOptions = {}
): void {
  const { 
    ambient = 1.0, 
    highlight = false, 
    selected = false,
    timeOfDay = 'day',
    season = 'summer'
  } = options;
  
  const noise = getTerrainNoise();
  const detailNoise = getGrassDetailNoise();

  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;

  // Multi-layer noise for natural terrain variation
  const largeScale = octaveNoise(noise, gridX * 0.15, gridY * 0.15, 3, 0.5, 0.08);
  const mediumScale = octaveNoise(detailNoise, gridX * 0.5, gridY * 0.5, 2, 0.6, 0.2);
  const smallScale = octaveNoise(noise, gridX * 2, gridY * 2, 1, 0.8, 0.5);

  // Blend noise for natural grass color variation
  const colorBlend = (largeScale + mediumScale * 0.5 + smallScale * 0.25) / 1.75;
  
  // Season and time adjustments
  const seasonMod = season === 'autumn' ? { hShift: -15, sMod: -5, lMod: 5 } :
                    season === 'winter' ? { hShift: -20, sMod: -15, lMod: 10 } :
                    season === 'spring' ? { hShift: 5, sMod: 5, lMod: 3 } :
                    { hShift: 0, sMod: 0, lMod: 0 };
                    
  const timeMod = timeOfDay === 'dawn' ? { lMod: -8 } :
                  timeOfDay === 'dusk' ? { lMod: -12, hShift: 10 } :
                  timeOfDay === 'night' ? { lMod: -25, sMod: -10 } :
                  { lMod: 0, sMod: 0, hShift: 0 };

  // Calculate base color with natural variation
  const baseH = lerp(REALISTIC_GRASS_COLORS.shadow.h, REALISTIC_GRASS_COLORS.highlight.h, (colorBlend + 1) / 2)
                + (seasonMod.hShift || 0) + (timeMod.hShift || 0);
  const baseS = lerp(REALISTIC_GRASS_COLORS.shadow.s, REALISTIC_GRASS_COLORS.primary.s, (colorBlend + 1) / 2)
                + (seasonMod.sMod || 0) + (timeMod.sMod || 0);
  const baseL = lerp(REALISTIC_GRASS_COLORS.shadow.l, REALISTIC_GRASS_COLORS.highlight.l, (colorBlend + 1) / 2)
                + (seasonMod.lMod || 0) + (timeMod.lMod || 0);

  // Apply ambient lighting
  const finalL = baseL * clamp(ambient, 0.4, 1.0);

  // Create subtle gradient for 3D depth effect
  const gradient = ctx.createLinearGradient(
    screenX, screenY + h / 2,
    screenX + w, screenY + h / 2
  );
  
  // Subtle gradient stops for natural lighting
  gradient.addColorStop(0, hsl(baseH + 3, baseS - 2, finalL - 4));
  gradient.addColorStop(0.3, hsl(baseH, baseS, finalL - 1));
  gradient.addColorStop(0.7, hsl(baseH - 2, baseS + 1, finalL + 2));
  gradient.addColorStop(1, hsl(baseH - 4, baseS + 2, finalL + 4));

  // Draw base tile with gradient
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.fill();

  // Add grass detail when zoomed in
  if (zoom >= 0.5) {
    ctx.save();
    
    // Clip to tile
    ctx.beginPath();
    ctx.moveTo(cx, screenY);
    ctx.lineTo(screenX + w, cy);
    ctx.lineTo(cx, screenY + h);
    ctx.lineTo(screenX, cy);
    ctx.closePath();
    ctx.clip();

    // Draw subtle grass texture patches
    const numPatches = zoom >= 0.8 ? 8 : 4;
    for (let i = 0; i < numPatches; i++) {
      const seedX = hash(gridX, gridY, i * 17);
      const seedY = hash(gridY, gridX, i * 31);
      const patchX = cx + (seedX - 0.5) * w * 0.6;
      const patchY = cy + (seedY - 0.5) * h * 0.6;
      const patchSize = 3 + seedX * 4;
      
      const patchH = baseH + (seedX - 0.5) * 12;
      const patchL = finalL + (seedY - 0.5) * 6;
      
      ctx.fillStyle = hsl(patchH, baseS - 3, patchL, 0.3);
      ctx.beginPath();
      ctx.ellipse(patchX, patchY, patchSize, patchSize * 0.5, seedX * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw individual grass blades when very zoomed in
    if (zoom >= 0.8) {
      const numBlades = Math.floor(6 + smallScale * 3);
      for (let i = 0; i < numBlades; i++) {
        const seedX = hash(gridX, gridY, i * 7 + 100);
        const seedY = hash(gridY, gridX, i * 11 + 100);
        const bladeX = cx + (seedX - 0.5) * w * 0.7;
        const bladeY = cy + (seedY - 0.5) * h * 0.7;
        
        const bladeH = baseH + (seedX - 0.5) * 15;
        const bladeL = finalL + (seedY - 0.5) * 8;
        
        ctx.strokeStyle = hsl(bladeH, baseS - 5, bladeL, 0.5);
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(bladeX, bladeY);
        ctx.lineTo(bladeX + (seedX - 0.5) * 2, bladeY - 2 - seedY * 2);
        ctx.stroke();
      }
    }

    ctx.restore();

    // Draw subtle grid outline when zoomed in
    if (zoom >= 0.6) {
      ctx.strokeStyle = `rgba(0, 0, 0, ${0.08 + (1 - zoom) * 0.05})`;
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      ctx.moveTo(cx, screenY);
      ctx.lineTo(screenX + w, cy);
      ctx.lineTo(cx, screenY + h);
      ctx.lineTo(screenX, cy);
      ctx.closePath();
      ctx.stroke();
    }
  }

  // Highlight/selection overlay
  if (highlight || selected) {
    const overlayColor = selected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.12)';
    const strokeColor = selected ? '#22c55e' : 'rgba(255, 255, 255, 0.6)';
    
    ctx.fillStyle = overlayColor;
    ctx.beginPath();
    ctx.moveTo(cx, screenY);
    ctx.lineTo(screenX + w, cy);
    ctx.lineTo(cx, screenY + h);
    ctx.lineTo(screenX, cy);
    ctx.closePath();
    ctx.fill();
    
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = selected ? 2 : 1.5;
    ctx.stroke();
  }
}

// ============================================================================
// ENHANCED WATER RENDERING
// ============================================================================

export interface WaterRenderOptions {
  ambient?: number;
  timeOfDay?: 'day' | 'dawn' | 'dusk' | 'night';
  weather?: 'clear' | 'cloudy' | 'stormy';
}

/**
 * Calculate water depth based on adjacent tiles
 * Returns 0-1 where 0 is shallow (near shore) and 1 is deep
 */
function calculateWaterDepth(
  adjacentWater: { north: boolean; east: boolean; south: boolean; west: boolean }
): number {
  const numAdjacentWater = [
    adjacentWater.north, 
    adjacentWater.east, 
    adjacentWater.south, 
    adjacentWater.west
  ].filter(Boolean).length;
  
  return numAdjacentWater / 4;
}

/**
 * Render enhanced water tile with realistic waves, reflections, and depth
 */
export function drawEnhancedWaterTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  animTime: number,
  zoom: number,
  adjacentWater: { north: boolean; east: boolean; south: boolean; west: boolean },
  options: WaterRenderOptions = {}
): void {
  const { ambient = 1.0, timeOfDay = 'day', weather = 'clear' } = options;
  const waterNoiseFn = getWaterNoise();
  const waveNoiseFn = getWaveNoise();

  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;

  // Calculate water depth for coloring
  const depth = calculateWaterDepth(adjacentWater);
  
  // Base water color based on depth
  const deepColor = REALISTIC_WATER_COLORS.deep;
  const shallowColor = REALISTIC_WATER_COLORS.shallow;
  
  // Time-based adjustments
  const timeMod = timeOfDay === 'dawn' ? { lMod: -5, hShift: 5 } :
                  timeOfDay === 'dusk' ? { lMod: -8, hShift: 15 } :
                  timeOfDay === 'night' ? { lMod: -20, sMod: -15 } :
                  { lMod: 0, sMod: 0, hShift: 0 };

  // Weather adjustments
  const weatherMod = weather === 'stormy' ? { lMod: -12, sMod: 10 } :
                     weather === 'cloudy' ? { lMod: -5 } :
                     { lMod: 0, sMod: 0 };

  // Blend between deep and shallow based on depth
  const baseH = lerp(shallowColor.h, deepColor.h, depth) + (timeMod.hShift || 0);
  const baseS = lerp(shallowColor.s, deepColor.s, depth) + (timeMod.sMod || 0) + (weatherMod.sMod || 0);
  const baseL = lerp(shallowColor.l, deepColor.l, depth) * ambient + (timeMod.lMod || 0) + (weatherMod.lMod || 0);

  // Animated wave pattern
  const waveSpeed = weather === 'stormy' ? 2.5 : 1.5;
  const waveAmplitude = weather === 'stormy' ? 0.15 : 0.08;
  const wavePattern = octaveNoise(
    waveNoiseFn, 
    gridX * 0.3 + animTime * waveSpeed * 0.1, 
    gridY * 0.3 + animTime * waveSpeed * 0.08, 
    2, 0.5, 0.3
  );
  
  // Static water texture variation
  const textureNoise = octaveNoise(waterNoiseFn, gridX * 0.5, gridY * 0.5, 3, 0.6, 0.2);

  // Create animated gradient for water surface
  const waveOffset = wavePattern * waveAmplitude * h;
  const gradient = ctx.createLinearGradient(
    screenX, screenY + h / 2 + waveOffset,
    screenX + w, screenY + h / 2 - waveOffset
  );
  
  const lightVar = (1 + wavePattern * 0.3);
  gradient.addColorStop(0, hsl(baseH + 2, baseS, baseL * lightVar - 3));
  gradient.addColorStop(0.3, hsl(baseH, baseS - 2, baseL * lightVar));
  gradient.addColorStop(0.7, hsl(baseH - 1, baseS + 2, baseL * lightVar + 2));
  gradient.addColorStop(1, hsl(baseH - 2, baseS + 3, baseL * lightVar + 4));

  // Draw water base
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.fill();

  // Add wave highlights and shadows when zoomed in
  if (zoom >= 0.4) {
    ctx.save();
    
    // Clip to tile
    ctx.beginPath();
    ctx.moveTo(cx, screenY);
    ctx.lineTo(screenX + w, cy);
    ctx.lineTo(cx, screenY + h);
    ctx.lineTo(screenX, cy);
    ctx.closePath();
    ctx.clip();

    // Draw subtle wave lines
    const numWaves = zoom >= 0.7 ? 5 : 3;
    for (let i = 0; i < numWaves; i++) {
      const waveY = screenY + h * 0.2 + (i / numWaves) * h * 0.6;
      const wavePhase = animTime * 1.2 + i * 0.5 + gridX * 0.2;
      const waveSin = Math.sin(wavePhase) * 3;
      
      const waveAlpha = 0.15 + Math.sin(wavePhase * 0.5) * 0.08;
      ctx.strokeStyle = `rgba(255, 255, 255, ${waveAlpha * ambient})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(screenX + 5, waveY + waveSin);
      ctx.quadraticCurveTo(cx, waveY + waveSin * 1.5, screenX + w - 5, waveY + waveSin * 0.8);
      ctx.stroke();
    }

    // Sun sparkles on water surface (when day and zoomed in)
    if (zoom >= 0.6 && timeOfDay === 'day' && weather !== 'stormy') {
      const sparklePhase = animTime * 3 + gridX * 2 + gridY * 3;
      const sparkleCount = zoom >= 0.8 ? 4 : 2;
      
      for (let i = 0; i < sparkleCount; i++) {
        const sparkleX = cx + (hash(gridX, gridY, i * 11) - 0.5) * w * 0.5;
        const sparkleY = cy + (hash(gridY, gridX, i * 17) - 0.5) * h * 0.4;
        const sparkleSize = 1 + hash(gridX, gridY, i * 23) * 2;
        const sparkleAlpha = Math.max(0, Math.sin(sparklePhase + i * 1.5)) * 0.6;
        
        if (sparkleAlpha > 0.1) {
          ctx.fillStyle = `rgba(255, 255, 255, ${sparkleAlpha * ambient})`;
          ctx.beginPath();
          ctx.arc(sparkleX, sparkleY, sparkleSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  // Subtle outline for tile visibility
  if (zoom >= 0.6) {
    ctx.strokeStyle = `rgba(0, 0, 0, 0.1)`;
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.moveTo(cx, screenY);
    ctx.lineTo(screenX + w, cy);
    ctx.lineTo(cx, screenY + h);
    ctx.lineTo(screenX, cy);
    ctx.closePath();
    ctx.stroke();
  }
}

// ============================================================================
// ENHANCED BEACH/SHORE RENDERING
// ============================================================================

/**
 * Draw enhanced beach edge on a water tile where it meets land
 * Creates realistic sand-to-water transition with foam
 */
export function drawEnhancedBeachEdge(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  animTime: number,
  zoom: number,
  adjacentLand: { north: boolean; east: boolean; south: boolean; west: boolean }
): void {
  const { north, east, south, west } = adjacentLand;
  if (!north && !east && !south && !west) return;

  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  const sandNoiseFn = getSandNoise();

  const beachWidth = w * 0.12;  // Width of beach strip
  
  // Beach texture noise
  const sandTexture = octaveNoise(sandNoiseFn, gridX * 2, gridY * 2, 2, 0.5, 0.3);
  
  // Calculate corner points for the diamond
  const corners = {
    top: { x: cx, y: screenY },
    right: { x: screenX + w, y: cy },
    bottom: { x: cx, y: screenY + h },
    left: { x: screenX, y: cy },
  };

  ctx.save();

  // Draw beach edges for each adjacent land direction
  const edges = [
    { hasLand: north, start: corners.left, end: corners.top, inward: { dx: 0.707, dy: 0.707 } },
    { hasLand: east, start: corners.top, end: corners.right, inward: { dx: -0.707, dy: 0.707 } },
    { hasLand: south, start: corners.right, end: corners.bottom, inward: { dx: -0.707, dy: -0.707 } },
    { hasLand: west, start: corners.bottom, end: corners.left, inward: { dx: 0.707, dy: -0.707 } },
  ];

  for (const edge of edges) {
    if (!edge.hasLand) continue;

    // Sand gradient from beach color to water
    const sandH = REALISTIC_BEACH_COLORS.wet.h + sandTexture * 5;
    const sandS = REALISTIC_BEACH_COLORS.wet.s;
    const sandL = REALISTIC_BEACH_COLORS.wet.l + sandTexture * 8;

    // Draw sand strip
    ctx.fillStyle = hsl(sandH, sandS, sandL, 0.85);
    ctx.beginPath();
    ctx.moveTo(edge.start.x, edge.start.y);
    ctx.lineTo(edge.end.x, edge.end.y);
    ctx.lineTo(
      edge.end.x + edge.inward.dx * beachWidth,
      edge.end.y + edge.inward.dy * beachWidth
    );
    ctx.lineTo(
      edge.start.x + edge.inward.dx * beachWidth,
      edge.start.y + edge.inward.dy * beachWidth
    );
    ctx.closePath();
    ctx.fill();

    // Animated foam line at water's edge
    if (zoom >= 0.5) {
      const foamPhase = animTime * 1.5 + gridX * 0.3 + gridY * 0.2;
      const foamWidth = 2 + Math.sin(foamPhase) * 1;
      const foamAlpha = 0.4 + Math.sin(foamPhase * 0.7) * 0.2;
      
      ctx.strokeStyle = `rgba(255, 255, 255, ${foamAlpha})`;
      ctx.lineWidth = foamWidth;
      ctx.beginPath();
      ctx.moveTo(
        edge.start.x + edge.inward.dx * beachWidth * 0.9,
        edge.start.y + edge.inward.dy * beachWidth * 0.9
      );
      ctx.lineTo(
        edge.end.x + edge.inward.dx * beachWidth * 0.9,
        edge.end.y + edge.inward.dy * beachWidth * 0.9
      );
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ============================================================================
// ENHANCED FOREST RENDERING
// ============================================================================

export interface ForestRenderOptions {
  density: number;  // 0-1 forest density
  ambient?: number;
  animTime?: number;
  timeOfDay?: 'day' | 'dawn' | 'dusk' | 'night';
}

/**
 * Draw enhanced forest tile with procedural trees
 */
export function drawEnhancedForestTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  zoom: number,
  options: ForestRenderOptions
): void {
  const { density, ambient = 1.0, animTime = 0, timeOfDay = 'day' } = options;
  const vegNoise = getVegetationNoise();
  
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;

  // First draw the grass base
  drawEnhancedGrassTile(ctx, screenX, screenY, gridX, gridY, zoom, {
    ambient: ambient * 0.7, // Darker under trees
    timeOfDay,
  });

  // Number of trees based on density
  const numTrees = Math.ceil(density * 4) + 1;
  
  // Time-based lighting
  const timeMod = timeOfDay === 'night' ? { lMod: -20 } :
                  timeOfDay === 'dusk' ? { lMod: -10 } :
                  { lMod: 0 };

  ctx.save();
  
  // Clip to tile area
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.clip();

  // Draw trees from back to front for proper overlapping
  for (let i = 0; i < numTrees; i++) {
    const treeHash = hash(gridX, gridY, i * 13);
    const treeHash2 = hash(gridY, gridX, i * 17);
    
    // Position trees within the tile
    const treeX = cx + (treeHash - 0.5) * w * 0.5;
    const treeY = cy + (treeHash2 - 0.5) * h * 0.4;
    
    // Tree size variation
    const treeScale = 0.6 + treeHash * 0.6;
    const treeHeight = 18 * treeScale * (zoom > 0.5 ? 1 : 0.8);
    const canopyWidth = 10 * treeScale;
    
    // Wind animation
    const windOffset = animTime ? Math.sin(animTime * 1.5 + treeHash * 10) * 1.5 : 0;
    
    // Tree colors with variation
    const canopyH = REALISTIC_FOREST_COLORS.canopy.h + (treeHash - 0.5) * 15;
    const canopyS = REALISTIC_FOREST_COLORS.canopy.s + (treeHash2 - 0.5) * 10;
    const canopyL = (REALISTIC_FOREST_COLORS.canopy.l + (treeHash - 0.5) * 8) * ambient + (timeMod.lMod || 0);
    
    // Draw tree trunk
    if (zoom >= 0.6) {
      ctx.fillStyle = hsl(
        REALISTIC_FOREST_COLORS.trunk.h,
        REALISTIC_FOREST_COLORS.trunk.s,
        REALISTIC_FOREST_COLORS.trunk.l * ambient + (timeMod.lMod || 0) * 0.5
      );
      ctx.fillRect(
        treeX - 1.5,
        treeY - treeHeight * 0.4,
        3,
        treeHeight * 0.5
      );
    }
    
    // Draw tree canopy (layered for depth)
    // Shadow layer
    ctx.fillStyle = hsl(canopyH, canopyS, canopyL - 8, 0.8);
    ctx.beginPath();
    ctx.ellipse(
      treeX + windOffset + 1,
      treeY - treeHeight * 0.6 + 2,
      canopyWidth * 0.9,
      canopyWidth * 0.55,
      0, 0, Math.PI * 2
    );
    ctx.fill();
    
    // Main canopy
    ctx.fillStyle = hsl(canopyH, canopyS, canopyL);
    ctx.beginPath();
    ctx.ellipse(
      treeX + windOffset,
      treeY - treeHeight * 0.6,
      canopyWidth,
      canopyWidth * 0.6,
      0, 0, Math.PI * 2
    );
    ctx.fill();
    
    // Highlight layer
    ctx.fillStyle = hsl(canopyH - 5, canopyS + 5, canopyL + 6, 0.5);
    ctx.beginPath();
    ctx.ellipse(
      treeX + windOffset - 2,
      treeY - treeHeight * 0.65,
      canopyWidth * 0.5,
      canopyWidth * 0.3,
      -0.3, 0, Math.PI * 2
    );
    ctx.fill();
  }

  ctx.restore();
}

// ============================================================================
// ENHANCED MOUNTAIN/ROCK RENDERING
// ============================================================================

export interface MountainRenderOptions {
  hasOre?: boolean;
  oreType?: 'metal' | 'gold' | 'oil';
  ambient?: number;
  animTime?: number;
}

/**
 * Draw enhanced mountain/metal deposit tile
 */
export function drawEnhancedMountainTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  zoom: number,
  options: MountainRenderOptions = {}
): void {
  const { hasOre = true, oreType = 'metal', ambient = 1.0, animTime = 0 } = options;
  const rockNoiseFn = getRockNoise();
  
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;

  // Rock texture noise
  const rockTexture = octaveNoise(rockNoiseFn, gridX * 2, gridY * 2, 3, 0.5, 0.25);
  
  // Base rock colors
  const baseRock = REALISTIC_MOUNTAIN_COLORS.rock;
  const rockH = baseRock.h + rockTexture * 10;
  const rockS = baseRock.s + Math.abs(rockTexture) * 5;
  const rockL = (baseRock.l + rockTexture * 12) * ambient;

  // Draw base rock tile
  const gradient = ctx.createLinearGradient(screenX, cy, screenX + w, cy);
  gradient.addColorStop(0, hsl(rockH, rockS, rockL - 5));
  gradient.addColorStop(0.4, hsl(rockH, rockS, rockL));
  gradient.addColorStop(1, hsl(rockH, rockS, rockL + 8));
  
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  
  // Clip to tile
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.clip();

  // Draw mountain peaks
  const numPeaks = 2 + Math.floor(hash(gridX, gridY, 0) * 2);
  for (let i = 0; i < numPeaks; i++) {
    const peakX = cx + (hash(gridX, gridY, i * 5) - 0.5) * w * 0.4;
    const peakBase = cy + (hash(gridY, gridX, i * 7) - 0.3) * h * 0.3;
    const peakHeight = 12 + hash(gridX, gridY, i * 11) * 10;
    const peakWidth = 8 + hash(gridY, gridX, i * 13) * 6;
    
    const peakL = rockL + hash(gridX, gridY, i * 17) * 10;
    
    // Peak shadow side
    ctx.fillStyle = hsl(rockH, rockS, peakL - 8);
    ctx.beginPath();
    ctx.moveTo(peakX, peakBase - peakHeight);
    ctx.lineTo(peakX + peakWidth * 0.5, peakBase);
    ctx.lineTo(peakX, peakBase);
    ctx.closePath();
    ctx.fill();
    
    // Peak lit side
    ctx.fillStyle = hsl(rockH, rockS, peakL + 4);
    ctx.beginPath();
    ctx.moveTo(peakX, peakBase - peakHeight);
    ctx.lineTo(peakX - peakWidth * 0.5, peakBase);
    ctx.lineTo(peakX, peakBase);
    ctx.closePath();
    ctx.fill();
    
    // Snow cap on tallest peaks
    if (peakHeight > 18 && zoom >= 0.5) {
      ctx.fillStyle = hsl(
        REALISTIC_MOUNTAIN_COLORS.snow.h,
        REALISTIC_MOUNTAIN_COLORS.snow.s,
        REALISTIC_MOUNTAIN_COLORS.snow.l * ambient
      );
      ctx.beginPath();
      ctx.moveTo(peakX, peakBase - peakHeight);
      ctx.lineTo(peakX + peakWidth * 0.2, peakBase - peakHeight * 0.7);
      ctx.lineTo(peakX - peakWidth * 0.2, peakBase - peakHeight * 0.7);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Draw ore deposits if present
  if (hasOre && zoom >= 0.5) {
    const oreColor = oreType === 'gold' ? { h: 45, s: 70, l: 55 } :
                     oreType === 'oil' ? { h: 0, s: 0, l: 15 } :
                     REALISTIC_MOUNTAIN_COLORS.ore;
    
    const numOreSpots = 3 + Math.floor(hash(gridX, gridY, 100) * 3);
    for (let i = 0; i < numOreSpots; i++) {
      const oreX = cx + (hash(gridX, gridY, i * 23 + 200) - 0.5) * w * 0.5;
      const oreY = cy + (hash(gridY, gridX, i * 29 + 200) - 0.5) * h * 0.4;
      const oreSize = 2 + hash(gridX, gridY, i * 31 + 200) * 3;
      
      // Ore glow/shine animation
      const shinePhase = animTime * 2 + i;
      const shineIntensity = 0.3 + Math.sin(shinePhase) * 0.2;
      
      ctx.fillStyle = hsl(oreColor.h, oreColor.s, oreColor.l * ambient);
      ctx.beginPath();
      ctx.ellipse(oreX, oreY, oreSize, oreSize * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Metallic shine
      if (oreType !== 'oil') {
        ctx.fillStyle = `rgba(255, 255, 255, ${shineIntensity * ambient})`;
        ctx.beginPath();
        ctx.arc(oreX - oreSize * 0.3, oreY - oreSize * 0.3, oreSize * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();
  
  // Outline
  if (zoom >= 0.6) {
    ctx.strokeStyle = `rgba(0, 0, 0, 0.15)`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, screenY);
    ctx.lineTo(screenX + w, cy);
    ctx.lineTo(cx, screenY + h);
    ctx.lineTo(screenX, cy);
    ctx.closePath();
    ctx.stroke();
  }
}

// ============================================================================
// ENHANCED SKY/ATMOSPHERE RENDERING
// ============================================================================

/**
 * Draw realistic sky background with atmospheric effects
 */
export function drawEnhancedSkyBackground(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  timeOfDay: 'day' | 'dawn' | 'dusk' | 'night' = 'day',
  animTime: number = 0
): void {
  const cloudNoiseFn = getCloudNoise();
  const width = canvas.width;
  const height = canvas.height;

  // Sky gradient colors based on time
  const skyColors = {
    day: { top: '#1a4a6a', mid: '#2d5a7a', bottom: '#3a6a4a' },
    dawn: { top: '#2a3a5a', mid: '#5a4a5a', bottom: '#8a5a3a' },
    dusk: { top: '#3a2a5a', mid: '#6a3a4a', bottom: '#2a3a3a' },
    night: { top: '#0a1520', mid: '#101a25', bottom: '#0a1a15' },
  };

  const colors = skyColors[timeOfDay];
  
  // Create sky gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, colors.top);
  gradient.addColorStop(0.5, colors.mid);
  gradient.addColorStop(1, colors.bottom);
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Add subtle cloud layer for day/dawn/dusk
  if (timeOfDay !== 'night') {
    const cloudAlpha = timeOfDay === 'day' ? 0.08 : 0.12;
    
    // Sample cloud noise at several points and draw soft cloud shapes
    for (let i = 0; i < 5; i++) {
      const cloudX = (hash(i, 0, 1) * width + animTime * 5) % (width * 1.2) - width * 0.1;
      const cloudY = height * 0.1 + hash(0, i, 1) * height * 0.3;
      const cloudWidth = 100 + hash(i, i, 1) * 150;
      const cloudHeight = 30 + hash(i, i, 2) * 40;
      
      ctx.fillStyle = `rgba(255, 255, 255, ${cloudAlpha})`;
      ctx.beginPath();
      ctx.ellipse(cloudX, cloudY, cloudWidth, cloudHeight, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Stars for night
  if (timeOfDay === 'night') {
    for (let i = 0; i < 50; i++) {
      const starX = hash(i, 0, 100) * width;
      const starY = hash(0, i, 100) * height * 0.6;
      const starSize = 0.5 + hash(i, i, 100) * 1.5;
      const twinkle = 0.3 + Math.sin(animTime * 2 + i) * 0.3;
      
      ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + twinkle})`;
      ctx.beginPath();
      ctx.arc(starX, starY, starSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ============================================================================
// PARTICLE EFFECTS SYSTEM
// ============================================================================

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'smoke' | 'dust' | 'spark' | 'splash' | 'leaf';
}

export interface ParticleSystem {
  particles: Particle[];
  maxParticles: number;
}

/**
 * Create a new particle system
 */
export function createParticleSystem(maxParticles: number = 100): ParticleSystem {
  return {
    particles: [],
    maxParticles,
  };
}

/**
 * Add a particle to the system
 */
export function emitParticle(
  system: ParticleSystem,
  x: number,
  y: number,
  type: Particle['type'],
  options: Partial<Particle> = {}
): void {
  if (system.particles.length >= system.maxParticles) {
    // Remove oldest particle
    system.particles.shift();
  }

  const defaults: Record<Particle['type'], Partial<Particle>> = {
    smoke: { vx: 0, vy: -1, life: 2, size: 5, color: 'rgba(100, 100, 100, 0.3)' },
    dust: { vx: 0.5, vy: -0.5, life: 1, size: 3, color: 'rgba(150, 130, 100, 0.4)' },
    spark: { vx: 2, vy: -2, life: 0.5, size: 2, color: 'rgba(255, 200, 50, 0.8)' },
    splash: { vx: 1, vy: -1.5, life: 0.8, size: 2, color: 'rgba(150, 200, 255, 0.6)' },
    leaf: { vx: 0.5, vy: 0.3, life: 3, size: 3, color: 'rgba(100, 150, 50, 0.5)' },
  };

  const def = defaults[type];
  const particle: Particle = {
    x,
    y,
    vx: options.vx ?? def.vx ?? 0,
    vy: options.vy ?? def.vy ?? 0,
    life: options.life ?? def.life ?? 1,
    maxLife: options.life ?? def.life ?? 1,
    size: options.size ?? def.size ?? 3,
    color: options.color ?? def.color ?? 'white',
    type,
  };

  system.particles.push(particle);
}

/**
 * Update particle system
 */
export function updateParticles(system: ParticleSystem, deltaTime: number): void {
  for (let i = system.particles.length - 1; i >= 0; i--) {
    const p = system.particles[i];
    p.x += p.vx * deltaTime * 60;
    p.y += p.vy * deltaTime * 60;
    p.life -= deltaTime;
    
    // Gravity for some particle types
    if (p.type === 'spark' || p.type === 'splash') {
      p.vy += 0.1 * deltaTime * 60;
    }
    
    // Remove dead particles
    if (p.life <= 0) {
      system.particles.splice(i, 1);
    }
  }
}

/**
 * Draw particles
 */
export function drawParticles(
  ctx: CanvasRenderingContext2D,
  system: ParticleSystem,
  offsetX: number,
  offsetY: number,
  zoom: number
): void {
  for (const p of system.particles) {
    const alpha = p.life / p.maxLife;
    const size = p.size * (1 + (1 - alpha) * 0.5) * zoom;
    
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(
      (p.x + offsetX) * zoom,
      (p.y + offsetY) * zoom,
      size,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ============================================================================
// UNIT SHADOW AND GLOW EFFECTS
// ============================================================================

/**
 * Draw unit shadow on the ground
 */
export function drawUnitShadow(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  width: number,
  height: number
): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.ellipse(screenX, screenY + height * 0.1, width * 0.4, height * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw selection glow around a unit or building
 */
export function drawSelectionGlow(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  width: number,
  height: number,
  animTime: number,
  color: string = '#22c55e'
): void {
  const pulse = 0.7 + Math.sin(animTime * 4) * 0.3;
  const glowSize = 3 + pulse * 2;
  
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = pulse * 0.8;
  ctx.beginPath();
  ctx.ellipse(
    screenX + width / 2,
    screenY + height * 0.3,
    width * 0.5 + glowSize,
    height * 0.25 + glowSize * 0.5,
    0, 0, Math.PI * 2
  );
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// ============================================================================
// EXPORT COMBINED RENDER FUNCTION
// ============================================================================

export interface EnhancedRenderOptions {
  zoom: number;
  animTime: number;
  ambient?: number;
  timeOfDay?: 'day' | 'dawn' | 'dusk' | 'night';
  season?: 'spring' | 'summer' | 'autumn' | 'winter';
  weather?: 'clear' | 'cloudy' | 'stormy';
}

/**
 * Main render function for enhanced terrain
 * Automatically selects the appropriate renderer based on tile type
 */
export function drawEnhancedTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  tileType: 'grass' | 'water' | 'forest' | 'mountain' | 'beach',
  options: EnhancedRenderOptions & {
    forestDensity?: number;
    adjacentWater?: { north: boolean; east: boolean; south: boolean; west: boolean };
    adjacentLand?: { north: boolean; east: boolean; south: boolean; west: boolean };
    hasOre?: boolean;
    oreType?: 'metal' | 'gold' | 'oil';
  }
): void {
  const { zoom, animTime, ambient = 1, timeOfDay = 'day', season = 'summer', weather = 'clear' } = options;
  
  switch (tileType) {
    case 'grass':
      drawEnhancedGrassTile(ctx, screenX, screenY, gridX, gridY, zoom, {
        ambient,
        timeOfDay,
        season,
      });
      break;
      
    case 'water':
      drawEnhancedWaterTile(
        ctx, screenX, screenY, gridX, gridY, animTime, zoom,
        options.adjacentWater || { north: true, east: true, south: true, west: true },
        { ambient, timeOfDay, weather }
      );
      // Draw beach edges if adjacent to land
      if (options.adjacentLand) {
        drawEnhancedBeachEdge(
          ctx, screenX, screenY, gridX, gridY, animTime, zoom,
          options.adjacentLand
        );
      }
      break;
      
    case 'forest':
      drawEnhancedForestTile(ctx, screenX, screenY, gridX, gridY, zoom, {
        density: options.forestDensity || 0.7,
        ambient,
        animTime,
        timeOfDay,
      });
      break;
      
    case 'mountain':
      drawEnhancedMountainTile(ctx, screenX, screenY, gridX, gridY, zoom, {
        hasOre: options.hasOre,
        oreType: options.oreType,
        ambient,
        animTime,
      });
      break;
      
    case 'beach':
      // Beach is rendered as part of water tiles
      break;
  }
}
