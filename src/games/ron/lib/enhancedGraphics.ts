/**
 * Rise of Nations - Enhanced Graphics System
 * 
 * Provides realistic, polished terrain and effects rendering:
 * - Natural grass/earth with procedural variation (no cartoon gradients)
 * - Animated water with depth, waves, foam, and reflections
 * - Beaches with wet/dry gradients and foam lines
 * - Forests with layered trees, wind animation, and shadows
 * - Mountains with rock textures, snow caps, and ore glints
 * - Atmospheric lighting and particle effects
 * - Unit shadows and selection effects
 * 
 * Performance: Caches noise and gradients; provides quality toggle for mobile.
 */

import { createNoise2D, NoiseFunction2D } from 'simplex-noise';

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

export interface GraphicsQuality {
  enableWaterAnimation: boolean;
  enableWaveReflections: boolean;
  enableParticles: boolean;
  enableShadows: boolean;
  enableWindAnimation: boolean;
  terrainDetailLevel: 'low' | 'medium' | 'high';
}

export const QUALITY_PRESETS: Record<'low' | 'medium' | 'high', GraphicsQuality> = {
  low: {
    enableWaterAnimation: false,
    enableWaveReflections: false,
    enableParticles: false,
    enableShadows: false,
    enableWindAnimation: false,
    terrainDetailLevel: 'low',
  },
  medium: {
    enableWaterAnimation: true,
    enableWaveReflections: false,
    enableParticles: true,
    enableShadows: true,
    enableWindAnimation: true,
    terrainDetailLevel: 'medium',
  },
  high: {
    enableWaterAnimation: true,
    enableWaveReflections: true,
    enableParticles: true,
    enableShadows: true,
    enableWindAnimation: true,
    terrainDetailLevel: 'high',
  },
};

let currentQuality: GraphicsQuality = QUALITY_PRESETS.high;

export function setGraphicsQuality(quality: 'low' | 'medium' | 'high'): void {
  currentQuality = QUALITY_PRESETS[quality];
}

export function getGraphicsQuality(): GraphicsQuality {
  return currentQuality;
}

// ============================================================================
// NOISE GENERATION & CACHING
// ============================================================================

// Single noise instances - reused for performance
const terrainNoise: NoiseFunction2D = createNoise2D();
const waterNoise: NoiseFunction2D = createNoise2D();
const foliageNoise: NoiseFunction2D = createNoise2D();

// Noise cache for frequently accessed values
const noiseCache = new Map<string, number>();
const MAX_CACHE_SIZE = 10000;

function getCachedNoise(key: string, x: number, y: number, noise: NoiseFunction2D, scale: number = 1): number {
  const cacheKey = `${key}_${Math.round(x * 100)}_${Math.round(y * 100)}_${scale}`;
  
  if (noiseCache.has(cacheKey)) {
    return noiseCache.get(cacheKey)!;
  }
  
  const value = noise(x * scale, y * scale);
  
  // Limit cache size
  if (noiseCache.size > MAX_CACHE_SIZE) {
    const firstKey = noiseCache.keys().next().value;
    if (firstKey !== undefined) {
      noiseCache.delete(firstKey);
    }
  }
  
  noiseCache.set(cacheKey, value);
  return value;
}

// Animation time - updated each frame
let animationTime = 0;

export function updateAnimationTime(deltaSeconds: number): void {
  animationTime += deltaSeconds;
}

export function getAnimationTime(): number {
  return animationTime;
}

// ============================================================================
// COLOR UTILITIES
// ============================================================================

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function lerpColor(color1: string, color2: string, t: number): string {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  return rgbToHex(
    c1.r + (c2.r - c1.r) * t,
    c1.g + (c2.g - c1.g) * t,
    c1.b + (c2.b - c1.b) * t
  );
}

function adjustBrightness(color: string, amount: number): string {
  const rgb = hexToRgb(color);
  return rgbToHex(
    rgb.r + amount,
    rgb.g + amount,
    rgb.b + amount
  );
}

// ============================================================================
// REALISTIC COLOR PALETTES (Non-cartoon, muted, natural tones)
// ============================================================================

// Grass palette - natural, varied greens and earth tones (NOT bright/cartoon)
const GRASS_PALETTE = {
  // Base grass colors - muted, natural
  baseGreen: '#4a6741',      // Muted olive green
  darkGreen: '#3d5736',      // Dark forest green
  lightGreen: '#5c7a4e',     // Lighter sage
  yellowGreen: '#6b7a45',    // Dry grass hint
  // Earth/dirt patches
  dirtLight: '#8b7355',      // Light brown earth
  dirtDark: '#6b5344',       // Dark soil
  dirtRed: '#7a5a45',        // Reddish earth
  // Shadows and highlights
  shadow: '#2d3a28',         // Dark shadow
  highlight: '#7a9a68',      // Sun-touched grass
};

// Water palette - realistic ocean/lake colors with depth
const WATER_PALETTE = {
  // Depth-based colors (shallow to deep)
  shallow: '#5a9fa8',        // Turquoise shallow
  midDepth: '#3d7a8a',       // Teal mid-depth
  deep: '#1e4a5c',           // Dark blue deep
  veryDeep: '#0f2a3a',       // Very deep blue-black
  // Surface effects
  foam: '#e8f4f4',           // White foam
  foamShadow: '#c8dada',     // Foam shadow
  sparkle: '#ffffff',        // Sun sparkle
  waveCrest: '#7ab8c2',      // Wave crest highlight
  // Reflection tints
  skyReflect: '#6aa8c4',     // Sky reflection
};

// Beach/sand palette - natural sand tones
const BEACH_PALETTE = {
  wetSand: '#9a8a6a',        // Wet sand near water
  damp: '#b5a580',           // Damp sand
  drySand: '#d4c4a0',        // Dry sand
  hotSand: '#e0d4b0',        // Sun-bleached sand
  // Details
  pebbles: '#7a7060',        // Small pebbles
  seaweed: '#4a6048',        // Seaweed bits
  shell: '#f0e8d8',          // Shell white
};

// Mountain/rock palette - realistic stone and snow
const MOUNTAIN_PALETTE = {
  // Rock colors
  rockBase: '#6a6a6a',       // Medium grey rock
  rockDark: '#4a4a4a',       // Dark rock/shadow
  rockLight: '#8a8a88',      // Light rock face
  rockWarm: '#7a7268',       // Warm grey
  // Snow and ice
  snow: '#f0f4f8',           // Pure snow
  snowShadow: '#c8d0d8',     // Snow in shadow
  ice: '#d8e8f0',            // Ice blue tint
  // Ore deposits
  ironOre: '#4a3830',        // Iron ore color
  copperOre: '#8a6040',      // Copper tint
  goldOre: '#b8a040',        // Gold vein
};

// Forest palette - natural tree colors
const FOREST_PALETTE = {
  // Canopy colors
  canopyDark: '#2a4a2a',     // Deep forest shadow
  canopyMid: '#3a5a38',      // Mid canopy
  canopyLight: '#4a6a48',    // Sun-lit canopy
  // Trunk colors
  trunkDark: '#3a2820',      // Dark bark
  trunkLight: '#5a4838',     // Light bark
  // Ground cover
  moss: '#4a5a3a',           // Mossy ground
  deadLeaves: '#6a5a40',     // Leaf litter
  mushroom: '#c8b8a0',       // Fungus
};

// ============================================================================
// ENHANCED GRASS/TERRAIN RENDERING
// ============================================================================

export interface EnhancedGrassOptions {
  gridX: number;
  gridY: number;
  tileWidth: number;
  tileHeight: number;
  screenX: number;
  screenY: number;
  zoom: number;
  ownerId?: string | null;
  ownerColor?: string | null;
}

/**
 * Draw enhanced realistic grass tile with procedural variation
 */
export function drawEnhancedGrass(
  ctx: CanvasRenderingContext2D,
  options: EnhancedGrassOptions
): void {
  const { gridX, gridY, tileWidth, tileHeight, screenX, screenY, zoom } = options;
  
  const w = tileWidth;
  const h = tileHeight;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  // Multi-octave noise for natural variation
  const noiseScale1 = 0.05;
  const noiseScale2 = 0.15;
  const noiseScale3 = 0.4;
  
  const n1 = getCachedNoise('grass1', gridX, gridY, terrainNoise, noiseScale1);
  const n2 = getCachedNoise('grass2', gridX, gridY, terrainNoise, noiseScale2);
  const n3 = getCachedNoise('grass3', gridX, gridY, terrainNoise, noiseScale3);
  
  // Combined noise for base color selection (normalized 0-1)
  const combinedNoise = (n1 * 0.5 + n2 * 0.3 + n3 * 0.2 + 1) / 2;
  
  // Determine base grass color from palette based on noise
  let baseColor: string;
  if (combinedNoise < 0.25) {
    baseColor = lerpColor(GRASS_PALETTE.darkGreen, GRASS_PALETTE.baseGreen, combinedNoise * 4);
  } else if (combinedNoise < 0.5) {
    baseColor = lerpColor(GRASS_PALETTE.baseGreen, GRASS_PALETTE.lightGreen, (combinedNoise - 0.25) * 4);
  } else if (combinedNoise < 0.75) {
    baseColor = lerpColor(GRASS_PALETTE.lightGreen, GRASS_PALETTE.yellowGreen, (combinedNoise - 0.5) * 4);
  } else {
    baseColor = lerpColor(GRASS_PALETTE.yellowGreen, GRASS_PALETTE.highlight, (combinedNoise - 0.75) * 4);
  }
  
  // Add subtle lighting variation (simulated sun angle)
  const lightNoise = getCachedNoise('light', gridX, gridY, terrainNoise, 0.02);
  const lightAdjust = Math.round(lightNoise * 8);
  baseColor = adjustBrightness(baseColor, lightAdjust);
  
  // Draw base diamond
  ctx.fillStyle = baseColor;
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.fill();
  
  // Add dirt patches (procedural)
  if (currentQuality.terrainDetailLevel !== 'low') {
    const dirtNoise = getCachedNoise('dirt', gridX, gridY, foliageNoise, 0.25);
    if (dirtNoise > 0.6) {
      const dirtIntensity = (dirtNoise - 0.6) / 0.4;
      const dirtColor = lerpColor(GRASS_PALETTE.dirtLight, GRASS_PALETTE.dirtDark, dirtNoise);
      
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, screenY);
      ctx.lineTo(screenX + w, cy);
      ctx.lineTo(cx, screenY + h);
      ctx.lineTo(screenX, cy);
      ctx.closePath();
      ctx.clip();
      
      // Draw dirt patches as irregular ellipses
      ctx.fillStyle = dirtColor;
      const patchX = cx + (dirtNoise - 0.5) * w * 0.5;
      const patchY = cy + (n2 - 0.5) * h * 0.3;
      ctx.beginPath();
      ctx.ellipse(patchX, patchY, w * 0.2 * dirtIntensity, h * 0.15 * dirtIntensity, n3 * Math.PI, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    }
  }
  
  // Add subtle grass texture/strokes at high zoom
  if (currentQuality.terrainDetailLevel === 'high' && zoom >= 0.8) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, screenY);
    ctx.lineTo(screenX + w, cy);
    ctx.lineTo(cx, screenY + h);
    ctx.lineTo(screenX, cy);
    ctx.closePath();
    ctx.clip();
    
    const numStrokes = 6;
    ctx.strokeStyle = adjustBrightness(baseColor, -15);
    ctx.lineWidth = 0.5;
    
    for (let i = 0; i < numStrokes; i++) {
      const seed = (gridX * 17 + gridY * 31 + i * 7) % 100;
      const sx = screenX + (seed / 100) * w;
      const sy = screenY + ((seed * 3) % 100) / 100 * h;
      const angle = (seed * 2 % 40 - 20) * Math.PI / 180;
      const length = 3 + (seed % 4);
      
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.sin(angle) * length, sy - Math.cos(angle) * length);
      ctx.stroke();
    }
    
    ctx.restore();
  }
  
  // Subtle grid line at edges (only when zoomed in)
  if (zoom >= 0.6) {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
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
// ENHANCED WATER RENDERING
// ============================================================================

export interface EnhancedWaterOptions {
  gridX: number;
  gridY: number;
  tileWidth: number;
  tileHeight: number;
  screenX: number;
  screenY: number;
  depth?: number; // 0-1, how deep the water is (affects color)
  adjacentLand?: { north: boolean; east: boolean; south: boolean; west: boolean };
}

/**
 * Draw enhanced realistic water with animation, depth, and effects
 */
export function drawEnhancedWater(
  ctx: CanvasRenderingContext2D,
  options: EnhancedWaterOptions
): void {
  const { gridX, gridY, tileWidth, tileHeight, screenX, screenY, adjacentLand } = options;
  
  const w = tileWidth;
  const h = tileHeight;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  // Calculate depth based on distance from shore
  let depth = options.depth ?? 0.5;
  if (adjacentLand) {
    const shoreCount = [adjacentLand.north, adjacentLand.east, adjacentLand.south, adjacentLand.west].filter(Boolean).length;
    depth = Math.max(0.1, 0.3 - shoreCount * 0.1);
  }
  
  // Animated noise for wave effect
  const waveSpeed = currentQuality.enableWaterAnimation ? 0.3 : 0;
  const t = animationTime * waveSpeed;
  
  const waveNoise1 = waterNoise((gridX + t) * 0.1, gridY * 0.1);
  const waveNoise2 = waterNoise(gridX * 0.2, (gridY + t * 0.7) * 0.2);
  const combinedWave = (waveNoise1 + waveNoise2) / 2;
  
  // Select water color based on depth
  let waterColor: string;
  if (depth < 0.25) {
    waterColor = lerpColor(WATER_PALETTE.shallow, WATER_PALETTE.midDepth, depth * 4);
  } else if (depth < 0.5) {
    waterColor = lerpColor(WATER_PALETTE.midDepth, WATER_PALETTE.deep, (depth - 0.25) * 4);
  } else {
    waterColor = lerpColor(WATER_PALETTE.deep, WATER_PALETTE.veryDeep, Math.min((depth - 0.5) * 2, 1));
  }
  
  // Add wave-based brightness variation
  const waveBrightness = Math.round(combinedWave * 10);
  waterColor = adjustBrightness(waterColor, waveBrightness);
  
  // Draw base water
  ctx.fillStyle = waterColor;
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.fill();
  
  // Draw wave patterns
  if (currentQuality.enableWaterAnimation) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, screenY);
    ctx.lineTo(screenX + w, cy);
    ctx.lineTo(cx, screenY + h);
    ctx.lineTo(screenX, cy);
    ctx.closePath();
    ctx.clip();
    
    // Wave crests (subtle white lines)
    const numWaves = 3;
    for (let i = 0; i < numWaves; i++) {
      const wavePhase = t * 2 + i * 0.5 + gridX * 0.1 + gridY * 0.1;
      const waveY = cy + Math.sin(wavePhase) * h * 0.15 + (i - 1) * h * 0.25;
      const waveAlpha = 0.15 + Math.sin(wavePhase) * 0.1;
      
      ctx.strokeStyle = `rgba(255, 255, 255, ${waveAlpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(screenX + w * 0.1, waveY);
      ctx.quadraticCurveTo(cx, waveY + Math.sin(wavePhase + 1) * 3, screenX + w * 0.9, waveY);
      ctx.stroke();
    }
    
    ctx.restore();
  }
  
  // Sun sparkles (occasional bright spots)
  if (currentQuality.enableWaveReflections && depth < 0.5) {
    const sparkleSeed = (gridX * 13 + gridY * 17 + Math.floor(t * 2)) % 100;
    if (sparkleSeed < 15) {
      const sparkleX = cx + ((sparkleSeed % 10) - 5) * w * 0.05;
      const sparkleY = cy + ((sparkleSeed % 7) - 3) * h * 0.05;
      const sparkleAlpha = 0.3 + Math.sin(t * 10 + sparkleSeed) * 0.2;
      
      ctx.fillStyle = `rgba(255, 255, 255, ${sparkleAlpha})`;
      ctx.beginPath();
      ctx.arc(sparkleX, sparkleY, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  // Subtle reflection of sky
  if (currentQuality.enableWaveReflections) {
    const grad = ctx.createLinearGradient(screenX, screenY, screenX, screenY + h);
    grad.addColorStop(0, 'rgba(150, 200, 220, 0.12)');
    grad.addColorStop(0.5, 'rgba(150, 200, 220, 0.05)');
    grad.addColorStop(1, 'rgba(50, 80, 100, 0.08)');
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx, screenY);
    ctx.lineTo(screenX + w, cy);
    ctx.lineTo(cx, screenY + h);
    ctx.lineTo(screenX, cy);
    ctx.closePath();
    ctx.fill();
  }
}

// ============================================================================
// ENHANCED BEACH/SHORE RENDERING
// ============================================================================

export interface EnhancedBeachOptions {
  gridX: number;
  gridY: number;
  tileWidth: number;
  tileHeight: number;
  screenX: number;
  screenY: number;
  adjacentLand: { north: boolean; east: boolean; south: boolean; west: boolean };
}

/**
 * Draw enhanced beach transition on water tile edges adjacent to land
 */
export function drawEnhancedBeach(
  ctx: CanvasRenderingContext2D,
  options: EnhancedBeachOptions
): void {
  const { gridX, gridY, tileWidth, tileHeight, screenX, screenY, adjacentLand } = options;
  
  const w = tileWidth;
  const h = tileHeight;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  ctx.save();
  
  // Clip to diamond
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.clip();
  
  // Beach width as fraction of tile
  const beachWidth = 0.35;
  
  // Draw beach for each adjacent land edge
  const edges = [
    { key: 'north' as const, x1: screenX, y1: cy, x2: cx, y2: screenY },
    { key: 'east' as const, x1: cx, y1: screenY, x2: screenX + w, y2: cy },
    { key: 'south' as const, x1: screenX + w, y1: cy, x2: cx, y2: screenY + h },
    { key: 'west' as const, x1: cx, y1: screenY + h, x2: screenX, y2: cy },
  ];
  
  for (const edge of edges) {
    if (!adjacentLand[edge.key]) continue;
    
    // Calculate gradient direction (perpendicular to edge, into water)
    const edgeMidX = (edge.x1 + edge.x2) / 2;
    const edgeMidY = (edge.y1 + edge.y2) / 2;
    const toCenterX = cx - edgeMidX;
    const toCenterY = cy - edgeMidY;
    const len = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY);
    const dirX = toCenterX / len;
    const dirY = toCenterY / len;
    
    // Create gradient from edge toward center
    const gradStart = { x: edgeMidX, y: edgeMidY };
    const gradEnd = { x: edgeMidX + dirX * w * beachWidth, y: edgeMidY + dirY * h * beachWidth };
    
    const grad = ctx.createLinearGradient(gradStart.x, gradStart.y, gradEnd.x, gradEnd.y);
    grad.addColorStop(0, BEACH_PALETTE.wetSand);
    grad.addColorStop(0.4, BEACH_PALETTE.damp);
    grad.addColorStop(0.7, BEACH_PALETTE.drySand + '80'); // Fade out
    grad.addColorStop(1, 'transparent');
    
    // Draw beach gradient
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(edge.x1, edge.y1);
    ctx.lineTo(edge.x2, edge.y2);
    ctx.lineTo(edge.x2 + dirX * w * beachWidth, edge.y2 + dirY * h * beachWidth);
    ctx.lineTo(edge.x1 + dirX * w * beachWidth, edge.y1 + dirY * h * beachWidth);
    ctx.closePath();
    ctx.fill();
    
    // Animated foam line at water's edge
    if (currentQuality.enableWaterAnimation) {
      const foamOffset = Math.sin(animationTime * 2 + gridX * 0.5 + gridY * 0.3) * 2;
      const foamY = edgeMidY + dirY * (5 + foamOffset);
      const foamX = edgeMidX + dirX * (5 + foamOffset);
      
      ctx.strokeStyle = BEACH_PALETTE.shell + 'aa';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      // Draw foam line along edge
      const perpX = -(edge.y2 - edge.y1) / len * 0.7;
      const perpY = (edge.x2 - edge.x1) / len * 0.7;
      
      ctx.moveTo(foamX - perpX * w * 0.4, foamY - perpY * h * 0.4);
      ctx.quadraticCurveTo(
        foamX, foamY + Math.sin(animationTime * 3 + gridX) * 2,
        foamX + perpX * w * 0.4, foamY + perpY * h * 0.4
      );
      ctx.stroke();
      
      // Secondary foam
      ctx.strokeStyle = BEACH_PALETTE.shell + '55';
      ctx.lineWidth = 1.5;
      const foam2Offset = foamOffset + 3;
      ctx.beginPath();
      ctx.moveTo(edgeMidX + dirX * foam2Offset - perpX * w * 0.3, edgeMidY + dirY * foam2Offset - perpY * h * 0.3);
      ctx.lineTo(edgeMidX + dirX * foam2Offset + perpX * w * 0.3, edgeMidY + dirY * foam2Offset + perpY * h * 0.3);
      ctx.stroke();
    }
  }
  
  ctx.restore();
}

// ============================================================================
// ENHANCED FOREST RENDERING
// ============================================================================

export interface EnhancedForestOptions {
  gridX: number;
  gridY: number;
  tileWidth: number;
  tileHeight: number;
  screenX: number;
  screenY: number;
  density: number; // 0-100
  zoom: number;
}

/**
 * Draw enhanced forest with procedural trees, wind animation, and shadows
 */
export function drawEnhancedForest(
  ctx: CanvasRenderingContext2D,
  options: EnhancedForestOptions
): void {
  const { gridX, gridY, tileWidth, tileHeight, screenX, screenY, density, zoom } = options;
  
  // Draw dark ground cover first
  const w = tileWidth;
  const h = tileHeight;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  // Forest floor (darker than regular grass)
  ctx.fillStyle = FOREST_PALETTE.moss;
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.fill();
  
  // Add leaf litter patches
  const leafNoise = getCachedNoise('leaves', gridX, gridY, foliageNoise, 0.3);
  if (leafNoise > 0.3) {
    ctx.fillStyle = FOREST_PALETTE.deadLeaves;
    const patchX = cx + (leafNoise - 0.5) * w * 0.4;
    const patchY = cy + ((leafNoise * 2) % 1 - 0.5) * h * 0.3;
    ctx.beginPath();
    ctx.ellipse(patchX, patchY, w * 0.15, h * 0.1, leafNoise * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Calculate number of trees based on density
  const numTrees = Math.floor(4 + (density / 100) * 5);
  
  // Generate tree positions with deterministic randomness
  const treePositions: Array<{ x: number; y: number; scale: number; type: number }> = [];
  for (let i = 0; i < numTrees; i++) {
    const seed = (gridX * 31 + gridY * 17 + i * 13) % 1000;
    const nx = 0.15 + (seed % 70) / 100;
    const ny = 0.2 + ((seed * 3) % 60) / 100;
    const scale = 0.7 + (seed % 30) / 100;
    const type = seed % 3;
    
    treePositions.push({ x: nx, y: ny, scale, type });
  }
  
  // Sort by Y for proper depth ordering
  treePositions.sort((a, b) => a.y - b.y);
  
  // Wind animation
  const windStrength = currentQuality.enableWindAnimation ? 0.02 : 0;
  const windPhase = animationTime * 1.5 + gridX * 0.3 + gridY * 0.2;
  const windSway = Math.sin(windPhase) * windStrength;
  
  // Draw tree shadows first
  if (currentQuality.enableShadows) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, screenY);
    ctx.lineTo(screenX + w, cy);
    ctx.lineTo(cx, screenY + h);
    ctx.lineTo(screenX, cy);
    ctx.closePath();
    ctx.clip();
    
    for (const tree of treePositions) {
      const tx = screenX + tree.x * w;
      const ty = screenY + tree.y * h;
      const size = 8 * tree.scale;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.beginPath();
      ctx.ellipse(tx + size * 0.5, ty + size * 0.3, size * 0.8, size * 0.3, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  
  // Draw trees
  for (const tree of treePositions) {
    drawProceduralTree(ctx, screenX + tree.x * w, screenY + tree.y * h - 5, tree.scale, tree.type, windSway);
  }
}

/**
 * Draw a single procedural tree
 */
function drawProceduralTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  type: number,
  windSway: number
): void {
  const baseSize = 12 * scale;
  
  ctx.save();
  ctx.translate(x, y);
  
  // Apply wind sway at top
  ctx.transform(1, 0, windSway, 1, 0, 0);
  
  // Trunk
  const trunkWidth = baseSize * 0.15;
  const trunkHeight = baseSize * 0.5;
  ctx.fillStyle = FOREST_PALETTE.trunkDark;
  ctx.fillRect(-trunkWidth / 2, -trunkHeight, trunkWidth, trunkHeight);
  
  // Trunk highlight
  ctx.fillStyle = FOREST_PALETTE.trunkLight;
  ctx.fillRect(-trunkWidth / 2, -trunkHeight, trunkWidth * 0.3, trunkHeight);
  
  // Foliage based on type
  if (type === 0) {
    // Conical evergreen (3 layers)
    for (let i = 0; i < 3; i++) {
      const layerY = -trunkHeight - i * baseSize * 0.3;
      const layerSize = baseSize * (0.5 - i * 0.1);
      
      ctx.fillStyle = i === 0 ? FOREST_PALETTE.canopyDark : 
                      i === 1 ? FOREST_PALETTE.canopyMid : FOREST_PALETTE.canopyLight;
      ctx.beginPath();
      ctx.moveTo(0, layerY - layerSize);
      ctx.lineTo(layerSize, layerY);
      ctx.lineTo(-layerSize, layerY);
      ctx.closePath();
      ctx.fill();
    }
  } else if (type === 1) {
    // Round deciduous
    const canopyY = -trunkHeight - baseSize * 0.4;
    const canopySize = baseSize * 0.5;
    
    // Main canopy
    ctx.fillStyle = FOREST_PALETTE.canopyMid;
    ctx.beginPath();
    ctx.arc(0, canopyY, canopySize, 0, Math.PI * 2);
    ctx.fill();
    
    // Highlight
    ctx.fillStyle = FOREST_PALETTE.canopyLight;
    ctx.beginPath();
    ctx.arc(-canopySize * 0.3, canopyY - canopySize * 0.3, canopySize * 0.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Shadow
    ctx.fillStyle = FOREST_PALETTE.canopyDark;
    ctx.beginPath();
    ctx.arc(canopySize * 0.2, canopyY + canopySize * 0.2, canopySize * 0.4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Bushy/irregular
    const canopyY = -trunkHeight - baseSize * 0.3;
    
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const dist = baseSize * 0.25;
      const blobX = Math.cos(angle) * dist;
      const blobY = Math.sin(angle) * dist * 0.6 + canopyY;
      const blobSize = baseSize * (0.25 + (i % 2) * 0.1);
      
      ctx.fillStyle = i < 2 ? FOREST_PALETTE.canopyDark : FOREST_PALETTE.canopyMid;
      ctx.beginPath();
      ctx.ellipse(blobX, blobY, blobSize, blobSize * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  ctx.restore();
}

// ============================================================================
// ENHANCED MOUNTAIN/METAL DEPOSIT RENDERING
// ============================================================================

export interface EnhancedMountainOptions {
  gridX: number;
  gridY: number;
  tileWidth: number;
  tileHeight: number;
  screenX: number;
  screenY: number;
  hasOre: boolean;
  zoom: number;
}

/**
 * Draw enhanced mountain/metal deposit with realistic rock and snow
 */
export function drawEnhancedMountain(
  ctx: CanvasRenderingContext2D,
  options: EnhancedMountainOptions
): void {
  const { gridX, gridY, tileWidth, tileHeight, screenX, screenY, hasOre, zoom } = options;
  
  const w = tileWidth;
  const h = tileHeight;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  // Base rock tile
  const rockNoise = getCachedNoise('rock', gridX, gridY, terrainNoise, 0.2);
  const rockColor = lerpColor(MOUNTAIN_PALETTE.rockDark, MOUNTAIN_PALETTE.rockLight, (rockNoise + 1) / 2);
  
  ctx.fillStyle = rockColor;
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.fill();
  
  // Mountain peaks
  const numPeaks = 2 + ((gridX + gridY) % 2);
  const seed = gridX * 17 + gridY * 31;
  
  for (let i = 0; i < numPeaks; i++) {
    const peakSeed = seed * 7 + i * 13;
    const peakX = cx + ((peakSeed % 40) - 20) / 100 * w;
    const peakBaseY = cy + ((peakSeed * 2 % 30) / 100) * h * 0.3;
    const peakHeight = h * (0.6 + (peakSeed % 30) / 100);
    const peakWidth = w * (0.25 + (peakSeed % 20) / 100);
    
    // Main peak (dark side)
    ctx.fillStyle = MOUNTAIN_PALETTE.rockDark;
    ctx.beginPath();
    ctx.moveTo(peakX - peakWidth / 2, peakBaseY);
    ctx.lineTo(peakX, peakBaseY - peakHeight);
    ctx.lineTo(peakX + peakWidth / 2, peakBaseY);
    ctx.closePath();
    ctx.fill();
    
    // Light side of peak
    ctx.fillStyle = MOUNTAIN_PALETTE.rockLight;
    ctx.beginPath();
    ctx.moveTo(peakX, peakBaseY - peakHeight);
    ctx.lineTo(peakX + peakWidth / 2, peakBaseY);
    ctx.lineTo(peakX + peakWidth * 0.1, peakBaseY - peakHeight * 0.2);
    ctx.closePath();
    ctx.fill();
    
    // Snow cap (on taller peaks)
    if (peakHeight > h * 0.65) {
      const snowHeight = peakHeight * 0.3;
      ctx.fillStyle = MOUNTAIN_PALETTE.snow;
      ctx.beginPath();
      ctx.moveTo(peakX - peakWidth * 0.25, peakBaseY - peakHeight + snowHeight);
      ctx.lineTo(peakX, peakBaseY - peakHeight);
      ctx.lineTo(peakX + peakWidth * 0.25, peakBaseY - peakHeight + snowHeight);
      ctx.closePath();
      ctx.fill();
      
      // Snow shadow
      ctx.fillStyle = MOUNTAIN_PALETTE.snowShadow;
      ctx.beginPath();
      ctx.moveTo(peakX, peakBaseY - peakHeight);
      ctx.lineTo(peakX - peakWidth * 0.15, peakBaseY - peakHeight + snowHeight * 0.7);
      ctx.lineTo(peakX, peakBaseY - peakHeight + snowHeight * 0.5);
      ctx.closePath();
      ctx.fill();
    }
  }
  
  // Draw boulders at base
  const numBoulders = 5 + (seed % 4);
  for (let i = 0; i < numBoulders; i++) {
    const bSeed = seed * 19 + i * 23;
    const bx = screenX + w * 0.2 + ((bSeed % 60) / 100) * w * 0.6;
    const by = cy + h * 0.1 + ((bSeed * 3 % 40) / 100) * h * 0.3;
    const bSize = 2 + (bSeed % 3);
    
    ctx.fillStyle = MOUNTAIN_PALETTE.rockBase;
    ctx.beginPath();
    ctx.arc(bx, by, bSize, 0, Math.PI * 2);
    ctx.fill();
    
    // Highlight
    ctx.fillStyle = MOUNTAIN_PALETTE.rockLight;
    ctx.beginPath();
    ctx.arc(bx - bSize * 0.25, by - bSize * 0.25, bSize * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Ore deposits if present
  if (hasOre && currentQuality.terrainDetailLevel !== 'low') {
    const numOre = 4 + (seed % 3);
    for (let i = 0; i < numOre; i++) {
      const oSeed = seed * 11 + i * 17;
      const ox = cx + ((oSeed % 50) - 25) / 100 * w * 0.6;
      const oy = cy - h * 0.1 + ((oSeed * 2 % 30) - 15) / 100 * h * 0.4;
      const oSize = 2 + (oSeed % 2);
      
      // Dark ore vein
      ctx.fillStyle = MOUNTAIN_PALETTE.ironOre;
      ctx.beginPath();
      ctx.ellipse(ox, oy, oSize * 1.2, oSize * 0.8, oSeed * 0.1, 0, Math.PI * 2);
      ctx.fill();
      
      // Metallic glint (animated)
      if (currentQuality.enableWaterAnimation) {
        const glintPhase = (animationTime * 0.5 + oSeed * 0.1) % (Math.PI * 2);
        const glintAlpha = Math.max(0, Math.sin(glintPhase) * 0.6);
        if (glintAlpha > 0.1) {
          ctx.fillStyle = `rgba(200, 180, 100, ${glintAlpha})`;
          ctx.beginPath();
          ctx.arc(ox - oSize * 0.3, oy - oSize * 0.3, oSize * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  
  // Ambient occlusion at edges
  if (currentQuality.terrainDetailLevel === 'high') {
    const aoGrad = ctx.createRadialGradient(cx, cy, w * 0.2, cx, cy, w * 0.6);
    aoGrad.addColorStop(0, 'transparent');
    aoGrad.addColorStop(1, 'rgba(0, 0, 0, 0.15)');
    ctx.fillStyle = aoGrad;
    ctx.beginPath();
    ctx.moveTo(cx, screenY);
    ctx.lineTo(screenX + w, cy);
    ctx.lineTo(cx, screenY + h);
    ctx.lineTo(screenX, cy);
    ctx.closePath();
    ctx.fill();
  }
}

// ============================================================================
// ENHANCED OIL DEPOSIT RENDERING
// ============================================================================

export interface EnhancedOilOptions {
  gridX: number;
  gridY: number;
  tileWidth: number;
  tileHeight: number;
  screenX: number;
  screenY: number;
  zoom: number;
}

/**
 * Draw enhanced oil deposit with realistic dark pools
 */
export function drawEnhancedOil(
  ctx: CanvasRenderingContext2D,
  options: EnhancedOilOptions
): void {
  const { gridX, gridY, tileWidth, tileHeight, screenX, screenY } = options;
  
  const w = tileWidth;
  const h = tileHeight;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  const seed = gridX * 31 + gridY * 17;
  
  // Draw grass base first
  drawEnhancedGrass(ctx, { ...options, ownerColor: undefined, ownerId: undefined });
  
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.clip();
  
  // Multiple oil splotches
  const numSplotches = 4 + (seed % 3);
  
  for (let i = 0; i < numSplotches; i++) {
    const sSeed = seed * 7 + i * 13;
    const sx = cx + ((sSeed % 60) - 30) / 100 * w * 0.5;
    const sy = cy + ((sSeed * 2 % 50) - 25) / 100 * h * 0.5;
    const sw = w * (0.1 + (sSeed % 40) / 1000);
    const sh = h * (0.08 + (sSeed % 30) / 1000);
    const angle = (sSeed % 90 - 45) * Math.PI / 180;
    
    // Dark oil base
    const darkness = 10 + (i * 3 % 15);
    ctx.fillStyle = `rgb(${darkness}, ${darkness}, ${darkness + 5})`;
    ctx.beginPath();
    ctx.ellipse(sx, sy, sw, sh, angle, 0, Math.PI * 2);
    ctx.fill();
    
    // Iridescent sheen
    if (currentQuality.terrainDetailLevel !== 'low') {
      const sheenPhase = (animationTime * 0.3 + i * 0.5) % 1;
      const sheenColors = ['rgba(80, 40, 120, 0.2)', 'rgba(40, 80, 100, 0.2)', 'rgba(80, 60, 40, 0.2)'];
      ctx.fillStyle = sheenColors[Math.floor(sheenPhase * 3) % 3];
      ctx.beginPath();
      ctx.ellipse(sx - sw * 0.2, sy - sh * 0.2, sw * 0.5, sh * 0.4, angle, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  ctx.restore();
}

// ============================================================================
// ENHANCED SKY BACKGROUND
// ============================================================================

export interface EnhancedSkyOptions {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  timeOfDay: 'dawn' | 'day' | 'dusk' | 'night';
}

const SKY_PALETTES = {
  dawn: {
    top: '#1a2a44',
    mid: '#4a3a5a',
    bottom: '#aa6040',
    clouds: 'rgba(255, 200, 180, 0.3)',
  },
  day: {
    top: '#1a3a5a',
    mid: '#2a4a6a',
    bottom: '#3a5a4a',
    clouds: 'rgba(255, 255, 255, 0.15)',
  },
  dusk: {
    top: '#2a2044',
    mid: '#5a3040',
    bottom: '#8a4a30',
    clouds: 'rgba(255, 150, 100, 0.25)',
  },
  night: {
    top: '#0a0a14',
    mid: '#101020',
    bottom: '#151a20',
    clouds: 'rgba(100, 100, 120, 0.1)',
  },
};

/**
 * Draw enhanced atmospheric sky background with optional clouds
 */
export function drawEnhancedSky(options: EnhancedSkyOptions): void {
  const { canvas, ctx, timeOfDay } = options;
  const palette = SKY_PALETTES[timeOfDay];
  
  // Main gradient
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, palette.top);
  grad.addColorStop(0.5, palette.mid);
  grad.addColorStop(1, palette.bottom);
  
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Subtle cloud layer
  if (currentQuality.terrainDetailLevel !== 'low') {
    const numClouds = 5;
    const cloudY = canvas.height * 0.15;
    
    for (let i = 0; i < numClouds; i++) {
      const cloudX = ((animationTime * 5 + i * canvas.width / numClouds) % (canvas.width * 1.5)) - canvas.width * 0.25;
      const cloudWidth = 80 + (i * 17) % 60;
      const cloudHeight = 20 + (i * 11) % 15;
      
      ctx.fillStyle = palette.clouds;
      ctx.beginPath();
      ctx.ellipse(cloudX, cloudY + (i % 3) * 20, cloudWidth, cloudHeight, 0, 0, Math.PI * 2);
      ctx.ellipse(cloudX + cloudWidth * 0.5, cloudY + 5 + (i % 3) * 20, cloudWidth * 0.7, cloudHeight * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ============================================================================
// PARTICLE SYSTEM
// ============================================================================

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'smoke' | 'dust' | 'spark' | 'splash';
}

const particles: Particle[] = [];
const MAX_PARTICLES = 200;

/**
 * Spawn particles at a location
 */
export function spawnParticles(
  x: number,
  y: number,
  type: 'smoke' | 'dust' | 'spark' | 'splash',
  count: number = 5
): void {
  if (!currentQuality.enableParticles) return;
  
  for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 1.5;
    
    const particle: Particle = {
      x,
      y,
      vx: Math.cos(angle) * speed * (type === 'smoke' ? 0.3 : 1),
      vy: type === 'smoke' ? -0.5 - Math.random() * 0.5 : Math.sin(angle) * speed - 1,
      life: 1,
      maxLife: 1 + Math.random() * 0.5,
      size: type === 'spark' ? 1 + Math.random() : 2 + Math.random() * 3,
      color: type === 'smoke' ? '#505050' :
             type === 'dust' ? '#8a7a60' :
             type === 'spark' ? '#ffaa30' :
             '#a0d0e0',
      type,
    };
    
    particles.push(particle);
  }
}

/**
 * Update and draw all particles
 */
export function updateAndDrawParticles(ctx: CanvasRenderingContext2D, deltaTime: number): void {
  if (!currentQuality.enableParticles) return;
  
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    
    // Update
    p.x += p.vx * deltaTime * 60;
    p.y += p.vy * deltaTime * 60;
    p.vy += 0.02 * deltaTime * 60; // Gravity
    p.life -= deltaTime / p.maxLife;
    
    // Remove dead particles
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    
    // Draw
    const alpha = p.life * (p.type === 'spark' ? 1 : 0.6);
    ctx.fillStyle = p.color + Math.round(alpha * 255).toString(16).padStart(2, '0');
    
    if (p.type === 'spark') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const size = p.size * (p.type === 'smoke' ? (2 - p.life) : p.life);
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ============================================================================
// UNIT SHADOWS
// ============================================================================

export interface UnitShadowOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  isFlying?: boolean;
}

/**
 * Draw a unit shadow on the ground
 */
export function drawUnitShadow(ctx: CanvasRenderingContext2D, options: UnitShadowOptions): void {
  if (!currentQuality.enableShadows) return;
  
  const { x, y, width, height, isFlying } = options;
  
  // Flying units have shadows offset and smaller
  const shadowOffset = isFlying ? 10 : 3;
  const shadowScale = isFlying ? 0.6 : 0.8;
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.ellipse(
    x + shadowOffset,
    y + shadowOffset,
    width * shadowScale * 0.5,
    height * shadowScale * 0.25,
    0.2,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

// ============================================================================
// SELECTION GLOW EFFECT
// ============================================================================

export interface SelectionGlowOptions {
  x: number;
  y: number;
  radius: number;
  color: string;
  isEnemy?: boolean;
}

/**
 * Draw a pulsing selection glow around a unit
 */
export function drawSelectionGlow(ctx: CanvasRenderingContext2D, options: SelectionGlowOptions): void {
  const { x, y, radius, color, isEnemy } = options;
  
  const pulse = Math.sin(animationTime * 4) * 0.2 + 0.8;
  const glowColor = isEnemy ? '#ef4444' : color;
  
  // Outer glow
  ctx.strokeStyle = glowColor + '40';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, radius + 4 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  
  // Inner ring
  ctx.strokeStyle = glowColor + '80';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
  ctx.stroke();
  
  // Core ring
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
}

// ============================================================================
// TERRITORY OVERLAY
// ============================================================================

export interface TerritoryOverlayOptions {
  screenX: number;
  screenY: number;
  tileWidth: number;
  tileHeight: number;
  ownerColor: string;
  isBorder: { north: boolean; east: boolean; south: boolean; west: boolean };
}

/**
 * Draw territory overlay with subtle fill and border lines
 */
export function drawTerritoryOverlay(ctx: CanvasRenderingContext2D, options: TerritoryOverlayOptions): void {
  const { screenX, screenY, tileWidth, tileHeight, ownerColor, isBorder } = options;
  
  const w = tileWidth;
  const h = tileHeight;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;
  
  // Subtle territory fill
  ctx.fillStyle = ownerColor + '0a';
  ctx.beginPath();
  ctx.moveTo(cx, screenY);
  ctx.lineTo(screenX + w, cy);
  ctx.lineTo(cx, screenY + h);
  ctx.lineTo(screenX, cy);
  ctx.closePath();
  ctx.fill();
  
  // Border lines where territory changes
  ctx.strokeStyle = ownerColor + 'aa';
  ctx.lineWidth = 2.5;
  
  if (isBorder.north) {
    ctx.beginPath();
    ctx.moveTo(screenX, cy);
    ctx.lineTo(cx, screenY);
    ctx.stroke();
  }
  if (isBorder.east) {
    ctx.beginPath();
    ctx.moveTo(cx, screenY);
    ctx.lineTo(screenX + w, cy);
    ctx.stroke();
  }
  if (isBorder.south) {
    ctx.beginPath();
    ctx.moveTo(screenX + w, cy);
    ctx.lineTo(cx, screenY + h);
    ctx.stroke();
  }
  if (isBorder.west) {
    ctx.beginPath();
    ctx.moveTo(cx, screenY + h);
    ctx.lineTo(screenX, cy);
    ctx.stroke();
  }
}

// ============================================================================
// FISHING SPOT INDICATOR
// ============================================================================

export interface FishingSpotOptions {
  screenX: number;
  screenY: number;
  tileWidth: number;
  tileHeight: number;
}

/**
 * Draw animated fishing spot indicator (bubbles, ripples)
 */
export function drawFishingSpot(ctx: CanvasRenderingContext2D, options: FishingSpotOptions): void {
  const { screenX, screenY, tileWidth, tileHeight } = options;
  
  const cx = screenX + tileWidth / 2;
  const cy = screenY + tileHeight / 2;
  
  // Animated ripples
  const numRipples = 3;
  for (let i = 0; i < numRipples; i++) {
    const phase = ((animationTime * 0.5 + i * 0.33) % 1);
    const radius = 3 + phase * 12;
    const alpha = 0.4 * (1 - phase);
    
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // Occasional bubbles
  const bubblePhase = (animationTime * 2) % 3;
  if (bubblePhase < 1) {
    const bubbleY = cy - bubblePhase * 8;
    const bubbleAlpha = 0.5 * (1 - bubblePhase);
    ctx.fillStyle = `rgba(255, 255, 255, ${bubbleAlpha})`;
    ctx.beginPath();
    ctx.arc(cx + Math.sin(animationTime * 3) * 3, bubbleY, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Fish icon (subtle)
  ctx.fillStyle = 'rgba(100, 180, 200, 0.4)';
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.sin(animationTime) * 0.2);
  
  // Simple fish shape
  ctx.beginPath();
  ctx.ellipse(0, 0, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-5, 0);
  ctx.lineTo(-8, -3);
  ctx.lineTo(-8, 3);
  ctx.closePath();
  ctx.fill();
  
  ctx.restore();
}

// ============================================================================
// CLEAR CACHES (call occasionally to prevent memory bloat)
// ============================================================================

export function clearGraphicsCaches(): void {
  noiseCache.clear();
  particles.length = 0;
}
