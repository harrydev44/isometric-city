/**
 * Rise of Nations - Enhanced Graphics System
 * 
 * High-fidelity procedural rendering system for realistic terrain, water,
 * forests, mountains, and visual effects. Uses simplex noise for natural
 * variation and animation.
 */

import { createNoise2D, createNoise3D } from 'simplex-noise';
import { TILE_WIDTH, TILE_HEIGHT } from '@/components/game/shared';

// Create noise generators with different seeds for variety
const noise2D = createNoise2D(() => 0.5);
const noise3D = createNoise3D(() => 0.3);
const terrainNoise = createNoise2D(() => 0.7);
const detailNoise = createNoise2D(() => 0.1);

// ============================================================================
// COLOR PALETTES - Realistic, Natural Colors
// ============================================================================

// Grass color palette - natural earthy greens (not cartoon-y)
const GRASS_COLORS = {
  // Base grass tones
  light: '#4a7c59',      // Light olive green
  mid: '#3d6b4f',        // Medium green
  dark: '#2d5a3f',       // Dark forest green
  shadow: '#234a32',     // Deep shadow
  highlight: '#5a8c69',  // Sunny highlight
  
  // Variation colors
  yellow: '#6b7a4a',     // Dried grass patches
  brown: '#5a6642',      // Earth tones
  moss: '#4a6b45',       // Mossy areas
};

// Water color palette - deep realistic ocean/lake tones
const WATER_COLORS = {
  deep: '#1a4a6e',       // Deep water
  mid: '#2a5a7e',        // Mid depth
  shallow: '#3a6a8e',    // Shallow water
  surface: '#4a7a9e',    // Surface reflection
  highlight: '#5a9abe',  // Sun highlights
  foam: '#ffffff',       // Wave foam
  ripple: 'rgba(255,255,255,0.3)', // Ripple effects
};

// Sand/beach palette
const SAND_COLORS = {
  light: '#e8d4a8',      // Dry sand
  mid: '#d4c098',        // Wet sand transition
  dark: '#c4a878',       // Wet sand
  stone: '#a09080',      // Pebbles
};

// Mountain palette
const MOUNTAIN_COLORS = {
  rock: '#6b7280',       // Gray rock
  rockLight: '#9ca3af',  // Light rock face
  rockDark: '#4b5563',   // Dark rock shadow
  snow: '#f5f5f5',       // Snow cap
  snowShadow: '#d1d5db', // Snow shadow
  ore: '#3f3f46',        // Metal ore
  oreGlint: '#71717a',   // Ore shine
};

// Forest palette
const FOREST_COLORS = {
  trunkDark: '#3d2817',  // Dark bark
  trunkLight: '#5c4033', // Light bark
  leafDark: '#1a4a2e',   // Dark foliage
  leafMid: '#2a5a3e',    // Medium foliage
  leafLight: '#3a6a4e',  // Light foliage
  shadow: '#0a2a1e',     // Ground shadow
};

// ============================================================================
// ENHANCED GRASS/TERRAIN RENDERING
// ============================================================================

/**
 * Draw an enhanced grass tile with procedural noise texture
 * Creates realistic, natural-looking terrain without flat gradients
 */
export function drawEnhancedGrassTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  time: number = 0,
  zoom: number = 1
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  // Create clipping path for isometric diamond
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(screenX + w / 2, screenY);
  ctx.lineTo(screenX + w, screenY + h / 2);
  ctx.lineTo(screenX + w / 2, screenY + h);
  ctx.lineTo(screenX, screenY + h / 2);
  ctx.closePath();
  ctx.clip();
  
  // Use noise to create natural variation
  const baseNoise = terrainNoise(gridX * 0.3, gridY * 0.3);
  const detailValue = detailNoise(gridX * 1.5, gridY * 1.5);
  
  // Calculate base color based on noise
  const colorMix = (baseNoise + 1) / 2; // 0 to 1
  
  // Draw multi-layer grass texture
  // Layer 1: Base color with gradient variation
  const baseGradient = ctx.createLinearGradient(
    screenX, screenY,
    screenX + w, screenY + h
  );
  
  if (colorMix > 0.6) {
    // Sunlit area
    baseGradient.addColorStop(0, GRASS_COLORS.highlight);
    baseGradient.addColorStop(0.5, GRASS_COLORS.light);
    baseGradient.addColorStop(1, GRASS_COLORS.mid);
  } else if (colorMix > 0.3) {
    // Normal grass
    baseGradient.addColorStop(0, GRASS_COLORS.light);
    baseGradient.addColorStop(0.5, GRASS_COLORS.mid);
    baseGradient.addColorStop(1, GRASS_COLORS.dark);
  } else {
    // Shadowed area
    baseGradient.addColorStop(0, GRASS_COLORS.mid);
    baseGradient.addColorStop(0.5, GRASS_COLORS.dark);
    baseGradient.addColorStop(1, GRASS_COLORS.shadow);
  }
  
  ctx.fillStyle = baseGradient;
  ctx.fillRect(screenX - 2, screenY - 2, w + 4, h + 4);
  
  // Layer 2: Add noise-based detail patches
  const patchCount = Math.floor(4 + Math.abs(detailValue) * 8);
  for (let i = 0; i < patchCount; i++) {
    const patchSeed = (gridX * 17 + gridY * 31 + i * 7) % 1000 / 1000;
    const patchNoise = detailNoise(gridX * 2 + i * 0.5, gridY * 2 + i * 0.3);
    
    const px = screenX + w * 0.1 + patchSeed * w * 0.8;
    const py = screenY + h * 0.1 + ((patchSeed * 1.618) % 1) * h * 0.8;
    const pSize = 2 + Math.abs(patchNoise) * 4;
    
    // Vary patch color based on noise
    if (patchNoise > 0.3) {
      ctx.fillStyle = GRASS_COLORS.yellow; // Dried grass
    } else if (patchNoise < -0.3) {
      ctx.fillStyle = GRASS_COLORS.moss; // Mossy
    } else {
      ctx.fillStyle = GRASS_COLORS.brown; // Earth tone
    }
    
    ctx.globalAlpha = 0.3 + Math.abs(patchNoise) * 0.3;
    ctx.beginPath();
    ctx.ellipse(px, py, pSize, pSize * 0.6, patchSeed * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  
  // Layer 3: Fine grass blade details (only at higher zoom)
  if (zoom >= 0.8) {
    const bladeCount = Math.floor(12 + Math.abs(baseNoise) * 8);
    ctx.strokeStyle = GRASS_COLORS.dark;
    ctx.lineWidth = 0.5;
    
    for (let i = 0; i < bladeCount; i++) {
      const bladeSeed = (gridX * 41 + gridY * 67 + i * 13) % 1000 / 1000;
      const bx = screenX + w * 0.1 + bladeSeed * w * 0.8;
      const by = screenY + h * 0.2 + ((bladeSeed * 2.718) % 1) * h * 0.6;
      const bladeHeight = 2 + bladeSeed * 3;
      
      // Slight wind animation
      const windOffset = Math.sin(time * 2 + bladeSeed * Math.PI * 2) * 1;
      
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(
        bx + windOffset,
        by - bladeHeight * 0.5,
        bx + windOffset * 1.5,
        by - bladeHeight
      );
      ctx.stroke();
    }
  }
  
  // Layer 4: Subtle shadow at tile edges for depth
  const edgeGradient = ctx.createRadialGradient(
    screenX + w / 2, screenY + h / 2, 0,
    screenX + w / 2, screenY + h / 2, w * 0.6
  );
  edgeGradient.addColorStop(0.7, 'rgba(0,0,0,0)');
  edgeGradient.addColorStop(1, 'rgba(0,0,0,0.15)');
  ctx.fillStyle = edgeGradient;
  ctx.fillRect(screenX - 2, screenY - 2, w + 4, h + 4);
  
  ctx.restore();
}

// ============================================================================
// ENHANCED WATER RENDERING
// ============================================================================

/**
 * Draw enhanced water tile with animated waves, depth, and reflections
 */
export function drawEnhancedWaterTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  time: number,
  adjacentWater: { north: boolean; east: boolean; south: boolean; west: boolean },
  zoom: number = 1
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  ctx.save();
  
  // Clip to isometric diamond
  ctx.beginPath();
  ctx.moveTo(screenX + w / 2, screenY);
  ctx.lineTo(screenX + w, screenY + h / 2);
  ctx.lineTo(screenX + w / 2, screenY + h);
  ctx.lineTo(screenX, screenY + h / 2);
  ctx.closePath();
  ctx.clip();
  
  // Calculate depth based on adjacency (more adjacent water = deeper)
  const adjacentCount = [adjacentWater.north, adjacentWater.east, adjacentWater.south, adjacentWater.west]
    .filter(Boolean).length;
  const depthFactor = adjacentCount / 4;
  
  // Animated noise for wave effect
  const waveNoise = noise3D(gridX * 0.5, gridY * 0.5, time * 0.5);
  const detailWave = noise3D(gridX * 1.5, gridY * 1.5, time * 0.8);
  
  // Base water color (depth-based gradient)
  const waterGradient = ctx.createLinearGradient(
    screenX, screenY,
    screenX + w, screenY + h
  );
  
  if (depthFactor > 0.7) {
    // Deep water
    waterGradient.addColorStop(0, WATER_COLORS.deep);
    waterGradient.addColorStop(0.5, adjustColor(WATER_COLORS.deep, 10));
    waterGradient.addColorStop(1, WATER_COLORS.mid);
  } else if (depthFactor > 0.3) {
    // Mid depth
    waterGradient.addColorStop(0, WATER_COLORS.mid);
    waterGradient.addColorStop(0.5, WATER_COLORS.shallow);
    waterGradient.addColorStop(1, WATER_COLORS.surface);
  } else {
    // Shallow water
    waterGradient.addColorStop(0, WATER_COLORS.shallow);
    waterGradient.addColorStop(0.5, WATER_COLORS.surface);
    waterGradient.addColorStop(1, adjustColor(WATER_COLORS.surface, 15));
  }
  
  ctx.fillStyle = waterGradient;
  ctx.fillRect(screenX - 2, screenY - 2, w + 4, h + 4);
  
  // Wave patterns (animated)
  ctx.globalAlpha = 0.15 + waveNoise * 0.1;
  const waveCount = 4 + Math.floor(depthFactor * 3);
  
  for (let i = 0; i < waveCount; i++) {
    const wavePhase = time * 0.8 + i * 0.5 + (gridX + gridY) * 0.2;
    const waveY = screenY + h * 0.2 + i * (h * 0.15);
    const waveAmplitude = 2 + detailWave * 2;
    
    ctx.strokeStyle = WATER_COLORS.ripple;
    ctx.lineWidth = 1 + depthFactor;
    ctx.beginPath();
    
    for (let x = 0; x <= w; x += 3) {
      const px = screenX + x;
      const py = waveY + Math.sin(x * 0.15 + wavePhase) * waveAmplitude;
      if (x === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  
  // Sun reflection sparkles
  const sparkleCount = Math.floor(3 + depthFactor * 5);
  for (let i = 0; i < sparkleCount; i++) {
    const sparkleSeed = (gridX * 23 + gridY * 47 + i * 11) % 1000 / 1000;
    const sparklePhase = time * 3 + sparkleSeed * Math.PI * 2;
    const sparkleIntensity = (Math.sin(sparklePhase) + 1) / 2;
    
    if (sparkleIntensity > 0.7) {
      const sx = screenX + w * 0.15 + sparkleSeed * w * 0.7;
      const sy = screenY + h * 0.15 + ((sparkleSeed * 1.414) % 1) * h * 0.7;
      const sSize = 1 + sparkleIntensity * 2;
      
      ctx.fillStyle = `rgba(255, 255, 255, ${(sparkleIntensity - 0.7) * 2})`;
      ctx.beginPath();
      ctx.arc(sx, sy, sSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  // Caustic light patterns (light refraction on bottom)
  if (depthFactor > 0.3 && zoom >= 0.6) {
    ctx.globalAlpha = 0.08;
    const causticPattern = noise2D(gridX * 2 + time * 0.3, gridY * 2 + time * 0.2);
    
    for (let i = 0; i < 5; i++) {
      const cx = screenX + w * (0.2 + causticPattern * 0.1) + i * w * 0.15;
      const cy = screenY + h * 0.3 + i * h * 0.1;
      const cSize = 3 + Math.abs(causticPattern) * 4;
      
      ctx.fillStyle = WATER_COLORS.highlight;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cSize, cSize * 0.5, Math.PI * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  
  // Edge darkening for depth effect
  const edgeShadow = ctx.createRadialGradient(
    screenX + w / 2, screenY + h / 2, w * 0.2,
    screenX + w / 2, screenY + h / 2, w * 0.65
  );
  edgeShadow.addColorStop(0, 'rgba(0,0,0,0)');
  edgeShadow.addColorStop(1, 'rgba(0,40,60,0.25)');
  ctx.fillStyle = edgeShadow;
  ctx.fillRect(screenX - 2, screenY - 2, w + 4, h + 4);
  
  ctx.restore();
}

// ============================================================================
// ENHANCED BEACH/SHORE RENDERING
// ============================================================================

/**
 * Draw enhanced beach transition with realistic sand texture and foam
 */
export function drawEnhancedBeach(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  time: number,
  adjacentLand: { north: boolean; east: boolean; south: boolean; west: boolean }
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  // Calculate which edges need beach
  const edges: Array<{ start: { x: number; y: number }; end: { x: number; y: number }; dir: string }> = [];
  
  if (adjacentLand.north) {
    edges.push({
      start: { x: screenX, y: screenY + h / 2 },
      end: { x: screenX + w / 2, y: screenY },
      dir: 'north'
    });
  }
  if (adjacentLand.east) {
    edges.push({
      start: { x: screenX + w / 2, y: screenY },
      end: { x: screenX + w, y: screenY + h / 2 },
      dir: 'east'
    });
  }
  if (adjacentLand.south) {
    edges.push({
      start: { x: screenX + w, y: screenY + h / 2 },
      end: { x: screenX + w / 2, y: screenY + h },
      dir: 'south'
    });
  }
  if (adjacentLand.west) {
    edges.push({
      start: { x: screenX + w / 2, y: screenY + h },
      end: { x: screenX, y: screenY + h / 2 },
      dir: 'west'
    });
  }
  
  // Draw beach for each edge
  for (const edge of edges) {
    ctx.save();
    
    // Create gradient from edge toward center
    const midX = (edge.start.x + edge.end.x) / 2;
    const midY = (edge.start.y + edge.end.y) / 2;
    const centerX = screenX + w / 2;
    const centerY = screenY + h / 2;
    
    const sandGradient = ctx.createLinearGradient(
      midX, midY,
      midX + (centerX - midX) * 0.4,
      midY + (centerY - midY) * 0.4
    );
    
    // Animated sand color with subtle variation
    const sandNoise = noise2D(gridX * 0.8 + time * 0.1, gridY * 0.8);
    const sandBaseColor = sandNoise > 0 ? SAND_COLORS.light : SAND_COLORS.mid;
    
    sandGradient.addColorStop(0, sandBaseColor);
    sandGradient.addColorStop(0.5, SAND_COLORS.mid);
    sandGradient.addColorStop(1, 'rgba(180, 160, 130, 0)');
    
    // Draw sand area
    const beachWidth = 8 + Math.abs(sandNoise) * 3;
    ctx.fillStyle = sandGradient;
    ctx.beginPath();
    ctx.moveTo(edge.start.x, edge.start.y);
    ctx.lineTo(edge.end.x, edge.end.y);
    ctx.lineTo(edge.end.x + (centerX - edge.end.x) * 0.3, edge.end.y + (centerY - edge.end.y) * 0.3);
    ctx.lineTo(edge.start.x + (centerX - edge.start.x) * 0.3, edge.start.y + (centerY - edge.start.y) * 0.3);
    ctx.closePath();
    ctx.fill();
    
    // Add sand grain texture
    const grainCount = 15 + Math.floor(Math.abs(sandNoise) * 10);
    ctx.fillStyle = SAND_COLORS.stone;
    ctx.globalAlpha = 0.3;
    
    for (let i = 0; i < grainCount; i++) {
      const grainSeed = (gridX * 37 + gridY * 53 + i * 19) % 1000 / 1000;
      const t = grainSeed;
      const gx = edge.start.x + (edge.end.x - edge.start.x) * t + (centerX - (edge.start.x + (edge.end.x - edge.start.x) * t)) * grainSeed * 0.25;
      const gy = edge.start.y + (edge.end.y - edge.start.y) * t + (centerY - (edge.start.y + (edge.end.y - edge.start.y) * t)) * grainSeed * 0.25;
      const gSize = 0.5 + grainSeed * 1.5;
      
      ctx.beginPath();
      ctx.arc(gx, gy, gSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    
    // Animated foam line
    const foamPhase = time * 1.5 + (gridX + gridY) * 0.3;
    const foamOffset = Math.sin(foamPhase) * 2;
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1.5 + Math.sin(foamPhase * 2) * 0.5;
    ctx.setLineDash([3, 2]);
    
    ctx.beginPath();
    ctx.moveTo(edge.start.x + foamOffset * 0.3, edge.start.y + foamOffset * 0.15);
    ctx.lineTo(edge.end.x + foamOffset * 0.3, edge.end.y + foamOffset * 0.15);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Add foam bubbles
    const bubbleCount = 5 + Math.floor(Math.abs(Math.sin(foamPhase)) * 5);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    
    for (let i = 0; i < bubbleCount; i++) {
      const bubbleSeed = (gridX * 29 + gridY * 41 + i * 23) % 1000 / 1000;
      const t = bubbleSeed;
      const bx = edge.start.x + (edge.end.x - edge.start.x) * t + Math.sin(time * 3 + bubbleSeed * 10) * 2;
      const by = edge.start.y + (edge.end.y - edge.start.y) * t + foamOffset * 0.5;
      const bSize = 1 + bubbleSeed * 2;
      
      ctx.beginPath();
      ctx.arc(bx, by, bSize, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  }
}

// ============================================================================
// ENHANCED MOUNTAIN/METAL DEPOSIT RENDERING
// ============================================================================

/**
 * Draw enhanced mountain with realistic peaks, snow, and ore deposits
 */
export function drawEnhancedMountain(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  time: number = 0
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  // Clip to isometric diamond
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(screenX + w / 2, screenY);
  ctx.lineTo(screenX + w, screenY + h / 2);
  ctx.lineTo(screenX + w / 2, screenY + h);
  ctx.lineTo(screenX, screenY + h / 2);
  ctx.closePath();
  ctx.clip();
  
  // Draw rocky base with gradient
  const baseGradient = ctx.createLinearGradient(
    screenX, screenY,
    screenX + w, screenY + h
  );
  baseGradient.addColorStop(0, MOUNTAIN_COLORS.rockLight);
  baseGradient.addColorStop(0.5, MOUNTAIN_COLORS.rock);
  baseGradient.addColorStop(1, MOUNTAIN_COLORS.rockDark);
  
  ctx.fillStyle = baseGradient;
  ctx.fillRect(screenX - 2, screenY - 2, w + 4, h + 4);
  
  // Add rock texture variation
  const rockNoise = terrainNoise(gridX * 0.5, gridY * 0.5);
  ctx.globalAlpha = 0.3;
  for (let i = 0; i < 8; i++) {
    const rockSeed = (gridX * 43 + gridY * 61 + i * 17) % 1000 / 1000;
    const rx = screenX + w * 0.1 + rockSeed * w * 0.8;
    const ry = screenY + h * 0.4 + ((rockSeed * 1.732) % 1) * h * 0.5;
    const rSize = 3 + rockSeed * 5;
    
    ctx.fillStyle = rockSeed > 0.5 ? MOUNTAIN_COLORS.rockLight : MOUNTAIN_COLORS.rockDark;
    ctx.beginPath();
    ctx.ellipse(rx, ry, rSize, rSize * 0.6, rockSeed * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  
  ctx.restore();
  
  // Draw mountain peaks cluster
  const peakSeed = gridX * 1000 + gridY;
  const numPeaks = 5 + (peakSeed % 4);
  
  // Peak configurations
  const peakConfigs = [
    { dx: 0.5, dy: 0.25, sizeMult: 1.4, heightMult: 1.4 },   // Center back - tallest
    { dx: 0.35, dy: 0.30, sizeMult: 1.2, heightMult: 1.2 },  // Back left
    { dx: 0.65, dy: 0.30, sizeMult: 1.3, heightMult: 1.25 }, // Back right
    { dx: 0.42, dy: 0.42, sizeMult: 1.0, heightMult: 1.0 },  // Mid left
    { dx: 0.58, dy: 0.44, sizeMult: 1.1, heightMult: 0.95 }, // Mid right
    { dx: 0.50, dy: 0.52, sizeMult: 0.9, heightMult: 0.85 }, // Front center
    { dx: 0.30, dy: 0.48, sizeMult: 0.75, heightMult: 0.7 }, // Front left
    { dx: 0.70, dy: 0.46, sizeMult: 0.8, heightMult: 0.75 }, // Front right
  ];
  
  // Sort by Y position for proper layering (back to front)
  const sortedPeaks = peakConfigs.slice(0, numPeaks).sort((a, b) => a.dy - b.dy);
  
  for (let p = 0; p < sortedPeaks.length; p++) {
    const config = sortedPeaks[p];
    const pSeed = peakSeed * 7 + p * 13;
    
    const baseX = screenX + w * config.dx + ((pSeed % 5) - 2.5) * 0.5;
    const baseY = screenY + h * config.dy + ((pSeed * 3 % 4) - 2) * 0.3;
    
    const peakWidth = (12 + (pSeed % 6)) * config.sizeMult;
    const peakHeight = (18 + (pSeed * 2 % 10)) * config.heightMult;
    const peakX = baseX + ((pSeed % 3) - 1) * 0.5;
    const peakY = baseY - peakHeight;
    
    // Draw left face (shadow)
    ctx.fillStyle = MOUNTAIN_COLORS.rockDark;
    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    ctx.lineTo(baseX - peakWidth * 0.35, baseY - peakHeight * 0.35);
    ctx.lineTo(baseX - peakWidth * 0.5, baseY);
    ctx.lineTo(baseX, baseY);
    ctx.closePath();
    ctx.fill();
    
    // Draw right face (lit)
    ctx.fillStyle = MOUNTAIN_COLORS.rockLight;
    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    ctx.lineTo(baseX + peakWidth * 0.3, baseY - peakHeight * 0.3);
    ctx.lineTo(baseX + peakWidth * 0.5, baseY);
    ctx.lineTo(baseX, baseY);
    ctx.closePath();
    ctx.fill();
    
    // Ridge line
    if (config.heightMult > 0.9) {
      ctx.fillStyle = MOUNTAIN_COLORS.rockDark;
      ctx.beginPath();
      ctx.moveTo(peakX, peakY);
      ctx.lineTo(peakX - 1, peakY + peakHeight * 0.4);
      ctx.lineTo(peakX + 1, peakY + peakHeight * 0.4);
      ctx.closePath();
      ctx.fill();
    }
    
    // Snow cap on taller peaks
    if (config.heightMult >= 1.1) {
      const snowHeight = peakHeight * 0.28;
      
      // Main snow cap
      ctx.fillStyle = MOUNTAIN_COLORS.snow;
      ctx.beginPath();
      ctx.moveTo(peakX, peakY);
      ctx.lineTo(peakX - peakWidth * 0.12, peakY + snowHeight);
      ctx.lineTo(peakX + peakWidth * 0.12, peakY + snowHeight);
      ctx.closePath();
      ctx.fill();
      
      // Snow shadow
      if (config.heightMult >= 1.3) {
        ctx.fillStyle = MOUNTAIN_COLORS.snowShadow;
        ctx.beginPath();
        ctx.arc(peakX - 2, peakY + snowHeight + 2, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  
  // Draw ore deposits at base
  const oreCount = 4 + (peakSeed % 3);
  const orePositions = [
    { dx: 0.28, dy: 0.72 },
    { dx: 0.42, dy: 0.76 },
    { dx: 0.58, dy: 0.74 },
    { dx: 0.72, dy: 0.72 },
    { dx: 0.38, dy: 0.68 },
    { dx: 0.62, dy: 0.70 },
  ];
  
  for (let o = 0; o < Math.min(oreCount, orePositions.length); o++) {
    const oPos = orePositions[o];
    const oSeed = peakSeed * 11 + o * 17;
    const oreX = screenX + w * oPos.dx + ((oSeed % 4) - 2) * 0.4;
    const oreY = screenY + h * oPos.dy + ((oSeed * 2 % 3) - 1) * 0.3;
    const oreSize = 1.5 + (oSeed % 2);
    
    // Ore diamond shape
    ctx.fillStyle = MOUNTAIN_COLORS.ore;
    ctx.beginPath();
    ctx.moveTo(oreX, oreY - oreSize);
    ctx.lineTo(oreX + oreSize, oreY);
    ctx.lineTo(oreX, oreY + oreSize);
    ctx.lineTo(oreX - oreSize, oreY);
    ctx.closePath();
    ctx.fill();
    
    // Metallic glint
    ctx.fillStyle = MOUNTAIN_COLORS.oreGlint;
    ctx.fillRect(oreX - 0.5, oreY - 0.5, 1, 1);
  }
  
  // Draw scattered boulders
  const boulderCount = 6 + (peakSeed % 4);
  for (let b = 0; b < boulderCount; b++) {
    const bSeed = peakSeed * 19 + b * 23;
    const bx = screenX + w * 0.2 + ((bSeed % 100) / 100) * w * 0.6;
    const by = screenY + h * 0.6 + ((bSeed * 3 % 50) / 100) * h * 0.35;
    const bSize = 2 + (bSeed % 3);
    
    ctx.fillStyle = MOUNTAIN_COLORS.rock;
    ctx.beginPath();
    ctx.arc(bx, by, bSize, 0, Math.PI * 2);
    ctx.fill();
    
    // Light highlight
    ctx.fillStyle = MOUNTAIN_COLORS.rockLight;
    ctx.beginPath();
    ctx.arc(bx - bSize * 0.25, by - bSize * 0.25, bSize * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ============================================================================
// ENHANCED FOREST RENDERING
// ============================================================================

/**
 * Draw enhanced forest with procedural trees and wind animation
 */
export function drawEnhancedForest(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  gridX: number,
  gridY: number,
  density: number, // 0-100
  time: number
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  // Draw grass base first
  drawEnhancedGrassTile(ctx, screenX, screenY, gridX, gridY, time);
  
  // Calculate number of trees based on density
  const numTrees = Math.floor(4 + (density / 100) * 6);
  
  // Tree positions (front to back for proper layering)
  const treePositions = [
    { dx: 0.5, dy: 0.35, size: 1.1 },
    { dx: 0.3, dy: 0.42, size: 0.95 },
    { dx: 0.7, dy: 0.42, size: 1.0 },
    { dx: 0.2, dy: 0.52, size: 0.85 },
    { dx: 0.5, dy: 0.52, size: 0.9 },
    { dx: 0.8, dy: 0.52, size: 0.88 },
    { dx: 0.35, dy: 0.62, size: 0.8 },
    { dx: 0.65, dy: 0.62, size: 0.82 },
    { dx: 0.5, dy: 0.72, size: 0.75 },
    { dx: 0.25, dy: 0.68, size: 0.7 },
  ];
  
  // Sort by Y for proper depth
  const trees = treePositions.slice(0, numTrees).sort((a, b) => a.dy - b.dy);
  
  for (let t = 0; t < trees.length; t++) {
    const pos = trees[t];
    const treeSeed = (gridX * 31 + gridY * 47 + t * 13) % 1000;
    
    // Position with slight randomization
    const tx = screenX + w * pos.dx + ((treeSeed % 10) - 5) * 0.8;
    const ty = screenY + h * pos.dy + ((Math.floor(treeSeed / 10) % 6) - 3) * 0.5;
    const treeScale = pos.size * (0.9 + (treeSeed % 20) / 100);
    
    // Wind sway animation
    const windPhase = time * 1.5 + treeSeed * 0.01;
    const sway = Math.sin(windPhase) * 1.5 * treeScale;
    
    drawProceduralTree(ctx, tx, ty, treeScale, sway, treeSeed);
  }
  
  // Add ground shadows
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(screenX + w / 2, screenY);
  ctx.lineTo(screenX + w, screenY + h / 2);
  ctx.lineTo(screenX + w / 2, screenY + h);
  ctx.lineTo(screenX, screenY + h / 2);
  ctx.closePath();
  ctx.clip();
  
  ctx.fillStyle = FOREST_COLORS.shadow;
  ctx.globalAlpha = 0.15;
  
  for (let t = 0; t < trees.length; t++) {
    const pos = trees[t];
    const shadowX = screenX + w * pos.dx + 3;
    const shadowY = screenY + h * pos.dy + 2;
    const shadowSize = 8 * pos.size;
    
    ctx.beginPath();
    ctx.ellipse(shadowX, shadowY, shadowSize, shadowSize * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * Draw a single procedural tree
 */
function drawProceduralTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  sway: number,
  seed: number
): void {
  const trunkHeight = 8 * scale;
  const trunkWidth = 2 * scale;
  const canopySize = 12 * scale;
  
  // Trunk
  ctx.fillStyle = FOREST_COLORS.trunkDark;
  ctx.beginPath();
  ctx.moveTo(x - trunkWidth / 2, y);
  ctx.lineTo(x + sway * 0.3, y - trunkHeight);
  ctx.lineTo(x + trunkWidth / 2, y);
  ctx.closePath();
  ctx.fill();
  
  // Trunk highlight
  ctx.fillStyle = FOREST_COLORS.trunkLight;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + sway * 0.3 + trunkWidth * 0.3, y - trunkHeight);
  ctx.lineTo(x + trunkWidth / 2, y);
  ctx.closePath();
  ctx.fill();
  
  // Tree type based on seed
  const treeType = seed % 3;
  
  if (treeType === 0) {
    // Conifer/pine tree
    drawConiferCanopy(ctx, x + sway * 0.5, y - trunkHeight, canopySize, seed);
  } else if (treeType === 1) {
    // Deciduous/round tree
    drawDeciduousCanopy(ctx, x + sway * 0.5, y - trunkHeight, canopySize, seed);
  } else {
    // Oak/broad tree
    drawOakCanopy(ctx, x + sway * 0.5, y - trunkHeight, canopySize, seed);
  }
}

/**
 * Draw conifer tree canopy (triangular)
 */
function drawConiferCanopy(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  seed: number
): void {
  // Multiple triangle layers
  const layers = 3;
  for (let i = 0; i < layers; i++) {
    const layerY = y + i * size * 0.25;
    const layerSize = size * (1 - i * 0.15);
    
    // Dark back layer
    ctx.fillStyle = FOREST_COLORS.leafDark;
    ctx.beginPath();
    ctx.moveTo(x, layerY - layerSize * 0.8);
    ctx.lineTo(x + layerSize * 0.5, layerY);
    ctx.lineTo(x - layerSize * 0.5, layerY);
    ctx.closePath();
    ctx.fill();
    
    // Light front layer
    ctx.fillStyle = FOREST_COLORS.leafMid;
    ctx.beginPath();
    ctx.moveTo(x, layerY - layerSize * 0.75);
    ctx.lineTo(x + layerSize * 0.35, layerY - layerSize * 0.1);
    ctx.lineTo(x, layerY);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * Draw deciduous tree canopy (rounded)
 */
function drawDeciduousCanopy(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  seed: number
): void {
  // Multiple overlapping circles
  const circles = [
    { dx: 0, dy: -0.5, s: 0.9 },
    { dx: -0.3, dy: -0.3, s: 0.7 },
    { dx: 0.3, dy: -0.3, s: 0.75 },
    { dx: 0, dy: -0.1, s: 0.65 },
  ];
  
  // Dark base layer
  ctx.fillStyle = FOREST_COLORS.leafDark;
  for (const c of circles) {
    ctx.beginPath();
    ctx.arc(x + c.dx * size, y + c.dy * size, size * c.s * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Light highlight layer
  ctx.fillStyle = FOREST_COLORS.leafLight;
  for (const c of circles) {
    ctx.beginPath();
    ctx.arc(
      x + c.dx * size - size * 0.05,
      y + c.dy * size - size * 0.1,
      size * c.s * 0.35,
      0, Math.PI * 2
    );
    ctx.fill();
  }
}

/**
 * Draw oak tree canopy (broad, irregular)
 */
function drawOakCanopy(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  seed: number
): void {
  // Large irregular blob
  ctx.fillStyle = FOREST_COLORS.leafMid;
  ctx.beginPath();
  
  const points = 8;
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const radius = size * 0.5 * (0.8 + ((seed * 7 + i * 13) % 10) / 25);
    const px = x + Math.cos(angle) * radius;
    const py = y - size * 0.4 + Math.sin(angle) * radius * 0.6;
    
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
  ctx.fill();
  
  // Darker shadow layer
  ctx.fillStyle = FOREST_COLORS.leafDark;
  ctx.beginPath();
  ctx.ellipse(x + size * 0.1, y - size * 0.2, size * 0.35, size * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Light top layer
  ctx.fillStyle = FOREST_COLORS.leafLight;
  ctx.beginPath();
  ctx.ellipse(x - size * 0.1, y - size * 0.5, size * 0.3, size * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ============================================================================
// PARTICLE SYSTEM
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

/**
 * Create smoke particles for industrial buildings
 */
export function createSmokeParticle(
  x: number,
  y: number
): Particle {
  return {
    x,
    y,
    vx: (Math.random() - 0.5) * 0.5,
    vy: -1 - Math.random() * 0.5,
    life: 1,
    maxLife: 1,
    size: 3 + Math.random() * 4,
    color: `rgba(${100 + Math.random() * 50}, ${100 + Math.random() * 50}, ${100 + Math.random() * 50}`,
    type: 'smoke',
  };
}

/**
 * Create dust particles for construction/combat
 */
export function createDustParticle(
  x: number,
  y: number
): Particle {
  const angle = Math.random() * Math.PI * 2;
  const speed = 1 + Math.random() * 2;
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 1,
    life: 0.6,
    maxLife: 0.6,
    size: 2 + Math.random() * 3,
    color: `rgba(160, 140, 100`,
    type: 'dust',
  };
}

/**
 * Create water splash particles
 */
export function createSplashParticle(
  x: number,
  y: number
): Particle {
  const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.6;
  const speed = 2 + Math.random() * 3;
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 0.5,
    maxLife: 0.5,
    size: 1.5 + Math.random() * 2,
    color: 'rgba(150, 200, 255',
    type: 'splash',
  };
}

/**
 * Update and draw particles
 */
export function updateAndDrawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  deltaTime: number
): Particle[] {
  const surviving: Particle[] = [];
  
  for (const p of particles) {
    // Update
    p.x += p.vx * deltaTime * 60;
    p.y += p.vy * deltaTime * 60;
    p.life -= deltaTime;
    
    // Gravity for some types
    if (p.type === 'splash' || p.type === 'dust') {
      p.vy += 0.15 * deltaTime * 60;
    }
    
    // Slow down smoke
    if (p.type === 'smoke') {
      p.vx *= 0.98;
      p.size += 0.05;
    }
    
    // Draw if alive
    if (p.life > 0) {
      const alpha = (p.life / p.maxLife) * 0.7;
      ctx.fillStyle = `${p.color}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      
      surviving.push(p);
    }
  }
  
  return surviving;
}

// ============================================================================
// UNIT SHADOW RENDERING
// ============================================================================

/**
 * Draw shadow under a unit for depth perception
 */
export function drawUnitShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y + size * 0.3, size * 1.2, size * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ============================================================================
// SELECTION GLOW EFFECT
// ============================================================================

/**
 * Draw pulsing selection glow around selected units/buildings
 */
export function drawSelectionGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  time: number,
  color: string = '#22c55e'
): void {
  const pulse = Math.sin(time * 4) * 0.3 + 0.7;
  
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 + pulse;
  ctx.globalAlpha = 0.5 + pulse * 0.3;
  ctx.setLineDash([4, 2]);
  
  // Draw rounded rectangle glow
  ctx.beginPath();
  ctx.moveTo(x + width / 2, y);
  ctx.lineTo(x + width, y + height / 2);
  ctx.lineTo(x + width / 2, y + height);
  ctx.lineTo(x, y + height / 2);
  ctx.closePath();
  ctx.stroke();
  
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ============================================================================
// SKY AND ATMOSPHERE
// ============================================================================

/**
 * Draw enhanced sky background with clouds
 */
export function drawEnhancedSky(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  time: number,
  timeOfDay: 'day' | 'night' | 'dawn' | 'dusk' = 'day'
): void {
  const w = canvas.width;
  const h = canvas.height;
  
  // Base gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  
  switch (timeOfDay) {
    case 'night':
      gradient.addColorStop(0, '#0a1628');
      gradient.addColorStop(0.4, '#0f1f38');
      gradient.addColorStop(1, '#1a2a40');
      break;
    case 'dawn':
      gradient.addColorStop(0, '#2a3f5f');
      gradient.addColorStop(0.3, '#5a4a6a');
      gradient.addColorStop(0.6, '#8a5a5a');
      gradient.addColorStop(1, '#aa7a5a');
      break;
    case 'dusk':
      gradient.addColorStop(0, '#3a2a5f');
      gradient.addColorStop(0.3, '#6a4a6a');
      gradient.addColorStop(0.6, '#8a4a4a');
      gradient.addColorStop(1, '#4a3a4a');
      break;
    default: // day
      gradient.addColorStop(0, '#1e4a6f');
      gradient.addColorStop(0.3, '#2e5a7f');
      gradient.addColorStop(0.6, '#3a6a8a');
      gradient.addColorStop(1, '#2a5a50');
  }
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  
  // Draw clouds (day/dawn/dusk only)
  if (timeOfDay !== 'night') {
    drawClouds(ctx, w, h, time, timeOfDay);
  } else {
    // Draw stars at night
    drawStars(ctx, w, h, time);
  }
}

/**
 * Draw animated clouds
 */
function drawClouds(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  timeOfDay: string
): void {
  const cloudColor = timeOfDay === 'day' ? 'rgba(255, 255, 255, 0.3)' :
                     timeOfDay === 'dawn' ? 'rgba(255, 220, 200, 0.3)' :
                     'rgba(200, 180, 200, 0.25)';
  
  ctx.fillStyle = cloudColor;
  
  // Draw several cloud layers
  const cloudCount = 8;
  for (let i = 0; i < cloudCount; i++) {
    const cloudX = ((time * 10 + i * width / cloudCount) % (width + 200)) - 100;
    const cloudY = height * 0.1 + i * height * 0.05 + Math.sin(i * 1.5) * 20;
    const cloudWidth = 80 + (i % 3) * 40;
    const cloudHeight = 25 + (i % 2) * 15;
    
    // Draw cloud as multiple overlapping ellipses
    for (let j = 0; j < 4; j++) {
      ctx.beginPath();
      ctx.ellipse(
        cloudX + j * cloudWidth * 0.25,
        cloudY + Math.sin(j * 2) * 5,
        cloudWidth * 0.3,
        cloudHeight * (0.6 + j % 2 * 0.3),
        0, 0, Math.PI * 2
      );
      ctx.fill();
    }
  }
}

/**
 * Draw twinkling stars
 */
function drawStars(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number
): void {
  const starCount = 50;
  
  for (let i = 0; i < starCount; i++) {
    const starX = (i * 7919 + 1234) % width;
    const starY = (i * 6271 + 5678) % (height * 0.4);
    const twinkle = (Math.sin(time * 3 + i) + 1) / 2;
    const size = 0.5 + twinkle * 1.5;
    
    ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + twinkle * 0.7})`;
    ctx.beginPath();
    ctx.arc(starX, starY, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Adjust a hex color by a percentage (positive = lighter, negative = darker)
 */
function adjustColor(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

/**
 * Linear interpolation between two colors
 */
export function lerpColor(color1: string, color2: string, t: number): string {
  const c1 = parseInt(color1.replace('#', ''), 16);
  const c2 = parseInt(color2.replace('#', ''), 16);
  
  const r1 = c1 >> 16, g1 = (c1 >> 8) & 0xFF, b1 = c1 & 0xFF;
  const r2 = c2 >> 16, g2 = (c2 >> 8) & 0xFF, b2 = c2 & 0xFF;
  
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  
  return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
}
