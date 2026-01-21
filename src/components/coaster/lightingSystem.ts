/**
 * IsoCoaster Lighting System
 * Provides enhanced day/night cycle lighting effects with dynamic ambiance
 */

import { useEffect } from 'react';
import { Tile } from '@/games/coaster/types';

// =============================================================================
// CONSTANTS
// =============================================================================

const TILE_WIDTH = 64;
const HEIGHT_RATIO = 0.60;
const TILE_HEIGHT = TILE_WIDTH * HEIGHT_RATIO;

// Animation timing
const LIGHT_FLICKER_SPEED = 0.08;
const LIGHT_PULSE_SPEED = 0.04;

// =============================================================================
// LIGHTING UTILITY FUNCTIONS
// =============================================================================

/**
 * Calculate darkness level based on hour of day (0-23)
 * Dawn: 5-7, Day: 7-18, Dusk: 18-20, Night: 20-5
 * @returns Value from 0 (full daylight) to 1 (full night)
 */
export function getDarkness(hour: number): number {
  if (hour >= 7 && hour < 18) return 0; // Full daylight
  if (hour >= 5 && hour < 7) return 1 - (hour - 5) / 2; // Dawn transition
  if (hour >= 18 && hour < 20) return (hour - 18) / 2; // Dusk transition
  return 1; // Night
}

/**
 * Get ambient color based on time of day
 * Returns RGB values for the ambient lighting overlay
 * Using rich, atmospheric colors for enhanced visual appeal
 */
export function getAmbientColor(hour: number): { r: number; g: number; b: number } {
  if (hour >= 7 && hour < 17) return { r: 255, g: 255, b: 255 };
  if (hour >= 17 && hour < 18) {
    // Golden hour - warm golden tones
    const t = hour - 17;
    return { 
      r: Math.round(255 - 30 * t), 
      g: Math.round(245 - 50 * t), 
      b: Math.round(230 - 80 * t) 
    };
  }
  if (hour >= 5 && hour < 7) {
    // Dawn - warm orange/pink with more saturation
    const t = (hour - 5) / 2;
    return { 
      r: Math.round(50 + 40 * t), 
      g: Math.round(30 + 25 * t), 
      b: Math.round(60 + 20 * t) 
    };
  }
  if (hour >= 18 && hour < 20) {
    // Dusk - rich purple/magenta sunset
    const t = (hour - 18) / 2;
    return { 
      r: Math.round(70 - 50 * t), 
      g: Math.round(35 - 25 * t), 
      b: Math.round(80 - 35 * t) 
    };
  }
  // Night - deeper blue with slight purple tint
  return { r: 8, g: 12, b: 45 };
}

/**
 * Calculate smooth animated flicker for lights
 */
export function getLightFlicker(seed: number, time: number): number {
  const phase1 = Math.sin(time * LIGHT_FLICKER_SPEED + seed * 1.7) * 0.5 + 0.5;
  const phase2 = Math.sin(time * LIGHT_FLICKER_SPEED * 1.3 + seed * 2.3) * 0.5 + 0.5;
  const phase3 = Math.sin(time * LIGHT_FLICKER_SPEED * 0.7 + seed * 0.9) * 0.5 + 0.5;
  return 0.85 + (phase1 * 0.08 + phase2 * 0.05 + phase3 * 0.02);
}

/**
 * Calculate smooth pulse for ride lights
 */
export function getLightPulse(seed: number, time: number): number {
  const base = Math.sin(time * LIGHT_PULSE_SPEED + seed) * 0.5 + 0.5;
  return 0.7 + base * 0.3;
}

/**
 * Deterministic pseudo-random function for consistent lighting patterns
 */
function pseudoRandom(seed: number, n: number): number {
  const s = Math.sin(seed + n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Convert grid coordinates to screen position
 */
function gridToScreen(gridX: number, gridY: number): { screenX: number; screenY: number } {
  const screenX = (gridX - gridY) * (TILE_WIDTH / 2);
  const screenY = (gridX + gridY) * (TILE_HEIGHT / 2);
  return { screenX, screenY };
}

// =============================================================================
// TYPES
// =============================================================================

interface LightSource {
  x: number;
  y: number;
  type: 'path' | 'building' | 'ride' | 'track' | 'lamp' | 'shop';
  buildingType?: string;
  seed?: number;
  trackHeight?: number;
}

export interface CoasterLightingConfig {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  grid: Tile[][];
  gridSize: number;
  hour: number;
  offset: { x: number; y: number };
  zoom: number;
  canvasWidth: number;
  canvasHeight: number;
  animationTime?: number; // For animated lighting effects
}

// =============================================================================
// LIGHT COLLECTION
// =============================================================================

/**
 * Building types that emit light at night
 */
const LIT_BUILDING_TYPES = new Set([
  // Stations
  'station_wooden_1', 'station_wooden_2', 'station_wooden_3', 'station_wooden_4', 'station_wooden_5',
  'station_steel_1', 'station_steel_2', 'station_steel_3', 'station_steel_4', 'station_steel_5',
  'station_inverted_1', 'station_inverted_2', 'station_inverted_3', 'station_inverted_4', 'station_inverted_5',
  'station_water_1', 'station_water_2', 'station_water_3', 'station_water_4', 'station_water_5',
  'station_mine_1', 'station_mine_2', 'station_mine_3', 'station_mine_4', 'station_mine_5',
  'station_futuristic_1', 'station_futuristic_2', 'station_futuristic_3', 'station_futuristic_4', 'station_futuristic_5',
  // Lamps - emit bright light at night
  'lamp_victorian', 'lamp_modern', 'lamp_themed', 'lamp_double', 'lamp_pathway',
  // Food & shops - illuminate brightly at night
  'food_hotdog', 'food_burger', 'food_icecream', 'food_cotton_candy', 'snack_popcorn',
  'shop_souvenir_1', 'shop_souvenir_2', 'shop_toys', 'shop_photo', 'restroom', 'first_aid',
  // Rides
  'ride_carousel', 'ride_teacups', 'ride_ferris_classic', 'ride_ferris_modern', 'ride_ferris_led',
  'ride_drop_tower', 'ride_swing_ride', 'ride_bumper_cars', 'ride_go_karts', 'ride_haunted_house', 'ride_log_flume',
  // Fountains
  'fountain_classic', 'fountain_modern', 'fountain_tiered', 'dancing_fountain',
  // Infrastructure
  'infra_main_entrance', 'infra_office',
]);

/**
 * Collect light sources from visible tiles
 */
function collectLightSources(
  grid: Tile[][],
  gridSize: number,
  visibleMinSum: number,
  visibleMaxSum: number,
  viewLeft: number,
  viewRight: number,
  viewTop: number,
  viewBottom: number
): LightSource[] {
  const lights: LightSource[] = [];
  
  for (let sum = visibleMinSum; sum <= visibleMaxSum; sum++) {
    for (let x = Math.max(0, sum - gridSize + 1); x <= Math.min(sum, gridSize - 1); x++) {
      const y = sum - x;
      if (y < 0 || y >= gridSize) continue;
      
      const { screenX, screenY } = gridToScreen(x, y);
      
      // Viewport culling
      if (screenX + TILE_WIDTH < viewLeft || screenX > viewRight ||
          screenY + TILE_HEIGHT * 3 < viewTop || screenY > viewBottom) {
        continue;
      }
      
      const tile = grid[y][x];
      const buildingType = tile.building?.type;
      
      // Paths emit light
      if (tile.path) {
        lights.push({ x, y, type: 'path' });
      }
      
      // Track tiles ALL emit light along the rails
      if (tile.hasCoasterTrack && tile.trackPiece) {
        lights.push({ 
          x, y, 
          type: 'track', 
          seed: x * 1000 + y,
          trackHeight: tile.trackPiece.startHeight || 0
        });
      }
      
      // Lamps emit bright focused light
      if (buildingType?.startsWith('lamp_')) {
        lights.push({ x, y, type: 'lamp', buildingType, seed: x * 1000 + y });
      }
      // Shops emit bright warm light
      else if (buildingType?.startsWith('shop_') || buildingType?.startsWith('food_') || buildingType?.startsWith('snack_')) {
        lights.push({ x, y, type: 'shop', buildingType, seed: x * 1000 + y });
      }
      // Other buildings emit light
      else if (buildingType && LIT_BUILDING_TYPES.has(buildingType)) {
        lights.push({ x, y, type: 'building', buildingType, seed: x * 1000 + y });
      }
      
      // Rides emit colored lights
      if (buildingType?.startsWith('ride_')) {
        lights.push({ x, y, type: 'ride', buildingType, seed: x * 1000 + y });
      }
    }
  }
  
  return lights;
}

// =============================================================================
// RENDERING FUNCTIONS
// =============================================================================

const HEIGHT_UNIT = 20;

/**
 * Draw light cutouts to remove darkness around light sources
 * Includes animated flickering and pulsing effects
 */
function drawLightCutouts(
  ctx: CanvasRenderingContext2D,
  lights: LightSource[],
  lightIntensity: number,
  animationTime: number = 0
): void {
  for (const light of lights) {
    const { screenX, screenY } = gridToScreen(light.x, light.y);
    const tileCenterX = screenX + TILE_WIDTH / 2;
    const tileCenterY = screenY + TILE_HEIGHT / 2;
    
    // Calculate animated flicker for this light
    const seed = light.seed ?? (light.x * 1000 + light.y);
    const flicker = getLightFlicker(seed, animationTime);
    const pulse = getLightPulse(seed, animationTime);
    
    if (light.type === 'path') {
      // Path lights - warm street lamps with subtle flicker
      const lightRadius = 34 * flicker;
      const gradient = ctx.createRadialGradient(tileCenterX, tileCenterY - 5, 0, tileCenterX, tileCenterY - 5, lightRadius);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${1.0 * lightIntensity * flicker})`);
      gradient.addColorStop(0.35, `rgba(255, 255, 255, ${0.75 * lightIntensity * flicker})`);
      gradient.addColorStop(0.7, `rgba(255, 255, 255, ${0.35 * lightIntensity})`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(tileCenterX, tileCenterY - 5, lightRadius, 0, Math.PI * 2);
      ctx.fill();
    } else if (light.type === 'track') {
      // Track lights - animated safety lights along coaster
      const trackHeight = light.trackHeight || 0;
      const elevationOffset = trackHeight * HEIGHT_UNIT;
      const lightY = tileCenterY - elevationOffset - 10;
      
      const lightRadius = 32 * pulse;
      const gradient = ctx.createRadialGradient(tileCenterX, lightY, 0, tileCenterX, lightY, lightRadius);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${1.0 * lightIntensity * pulse})`);
      gradient.addColorStop(0.3, `rgba(255, 255, 255, ${0.7 * lightIntensity * pulse})`);
      gradient.addColorStop(0.6, `rgba(255, 255, 255, ${0.35 * lightIntensity})`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(tileCenterX, lightY, lightRadius, 0, Math.PI * 2);
      ctx.fill();
    } else if (light.type === 'lamp') {
      // Lamp lights - bright focused with soft flicker
      const flickerIntensity = 0.95 + (flicker - 1) * 0.15;
      const lightRadius = 58 * flickerIntensity;
      const gradient = ctx.createRadialGradient(tileCenterX, tileCenterY - 20, 0, tileCenterX, tileCenterY - 20, lightRadius);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${1.0 * lightIntensity})`);
      gradient.addColorStop(0.25, `rgba(255, 255, 255, ${0.9 * lightIntensity * flickerIntensity})`);
      gradient.addColorStop(0.55, `rgba(255, 255, 255, ${0.55 * lightIntensity})`);
      gradient.addColorStop(0.8, `rgba(255, 255, 255, ${0.25 * lightIntensity})`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(tileCenterX, tileCenterY - 20, lightRadius, 0, Math.PI * 2);
      ctx.fill();
    } else if (light.type === 'shop') {
      // Shop lights - warm inviting storefront with subtle pulse
      const shopPulse = 0.97 + (pulse - 0.85) * 0.1;
      const lightRadius = 62 * shopPulse;
      const gradient = ctx.createRadialGradient(tileCenterX, tileCenterY - 18, 0, tileCenterX, tileCenterY - 18, lightRadius);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${1.0 * lightIntensity})`);
      gradient.addColorStop(0.3, `rgba(255, 255, 255, ${0.85 * lightIntensity * shopPulse})`);
      gradient.addColorStop(0.6, `rgba(255, 255, 255, ${0.5 * lightIntensity})`);
      gradient.addColorStop(0.85, `rgba(255, 255, 255, ${0.2 * lightIntensity})`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(tileCenterX, tileCenterY - 18, lightRadius, 0, Math.PI * 2);
      ctx.fill();
    } else if (light.type === 'building') {
      // Building lights - windows with ambient glow
      const lightRadius = 50 * flicker;
      const gradient = ctx.createRadialGradient(tileCenterX, tileCenterY - 15, 0, tileCenterX, tileCenterY - 15, lightRadius);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${1.0 * lightIntensity * flicker})`);
      gradient.addColorStop(0.35, `rgba(255, 255, 255, ${0.65 * lightIntensity})`);
      gradient.addColorStop(0.7, `rgba(255, 255, 255, ${0.3 * lightIntensity})`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(tileCenterX, tileCenterY - 15, lightRadius, 0, Math.PI * 2);
      ctx.fill();
    } else if (light.type === 'ride') {
      // Ride lights - animated colorful pulsing lights
      const ridePulse = pulse;
      const lightRadius = 58 * ridePulse;
      const gradient = ctx.createRadialGradient(tileCenterX, tileCenterY - 20, 0, tileCenterX, tileCenterY - 20, lightRadius);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${1.0 * lightIntensity * ridePulse})`);
      gradient.addColorStop(0.3, `rgba(255, 255, 255, ${0.7 * lightIntensity * ridePulse})`);
      gradient.addColorStop(0.6, `rgba(255, 255, 255, ${0.35 * lightIntensity})`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(tileCenterX, tileCenterY - 20, lightRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Draw colored glows for atmosphere (after cutouts)
 * Enhanced with vibrant animated colors for theme park ambiance
 */
function drawColoredGlows(
  ctx: CanvasRenderingContext2D,
  lights: LightSource[],
  lightIntensity: number,
  animationTime: number = 0
): void {
  for (const light of lights) {
    const { screenX, screenY } = gridToScreen(light.x, light.y);
    const tileCenterX = screenX + TILE_WIDTH / 2;
    const tileCenterY = screenY + TILE_HEIGHT / 2;
    
    const seed = light.seed ?? (light.x * 1000 + light.y);
    const flicker = getLightFlicker(seed, animationTime);
    const pulse = getLightPulse(seed, animationTime);
    
    if (light.type === 'path') {
      // Warm golden glow - slightly animated
      const glowRadius = 18 * flicker;
      const gradient = ctx.createRadialGradient(tileCenterX, tileCenterY - 5, 0, tileCenterX, tileCenterY - 5, glowRadius);
      gradient.addColorStop(0, `rgba(255, 225, 160, ${0.22 * lightIntensity * flicker})`);
      gradient.addColorStop(0.5, `rgba(255, 200, 120, ${0.12 * lightIntensity})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(tileCenterX, tileCenterY - 5, glowRadius, 0, Math.PI * 2);
      ctx.fill();
    } else if (light.type === 'track' && light.seed !== undefined) {
      // Animated red/white safety lights alternating
      const trackHeight = light.trackHeight || 0;
      const elevationOffset = trackHeight * HEIGHT_UNIT;
      const lightY = tileCenterY - elevationOffset - 10;
      
      // Alternating red and white based on animation
      const isRed = Math.sin(animationTime * 0.1 + seed * 0.5) > 0;
      const color = isRed 
        ? { r: 255, g: 80, b: 80 } 
        : { r: 255, g: 255, b: 220 };
      
      const glowRadius = 14 * pulse;
      const gradient = ctx.createRadialGradient(tileCenterX, lightY, 0, tileCenterX, lightY, glowRadius);
      gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${0.28 * lightIntensity * pulse})`);
      gradient.addColorStop(0.6, `rgba(${color.r}, ${color.g}, ${color.b}, ${0.1 * lightIntensity})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(tileCenterX, lightY, glowRadius, 0, Math.PI * 2);
      ctx.fill();
    } else if (light.type === 'lamp') {
      // Rich warm golden glow from street lamps
      const glowRadius = 34 * flicker;
      const gradient = ctx.createRadialGradient(tileCenterX, tileCenterY - 20, 0, tileCenterX, tileCenterY - 20, glowRadius);
      gradient.addColorStop(0, `rgba(255, 235, 170, ${0.4 * lightIntensity * flicker})`);
      gradient.addColorStop(0.4, `rgba(255, 215, 130, ${0.25 * lightIntensity})`);
      gradient.addColorStop(0.75, `rgba(255, 195, 100, ${0.1 * lightIntensity})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(tileCenterX, tileCenterY - 20, glowRadius, 0, Math.PI * 2);
      ctx.fill();
    } else if (light.type === 'shop') {
      // Warm inviting storefront glow with subtle pulse
      const shopPulse = 0.95 + (pulse - 0.85) * 0.15;
      const glowRadius = 38 * shopPulse;
      const gradient = ctx.createRadialGradient(tileCenterX, tileCenterY - 18, 0, tileCenterX, tileCenterY - 18, glowRadius);
      gradient.addColorStop(0, `rgba(255, 245, 190, ${0.4 * lightIntensity * shopPulse})`);
      gradient.addColorStop(0.35, `rgba(255, 225, 155, ${0.25 * lightIntensity})`);
      gradient.addColorStop(0.7, `rgba(255, 205, 120, ${0.1 * lightIntensity})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(tileCenterX, tileCenterY - 18, glowRadius, 0, Math.PI * 2);
      ctx.fill();
    } else if (light.type === 'ride' && light.seed !== undefined) {
      // Vibrant animated colorful ride lights
      const colors = [
        { r: 255, g: 80, b: 140 },  // Hot pink
        { r: 80, g: 200, b: 255 },  // Electric blue
        { r: 255, g: 210, b: 80 },  // Gold
        { r: 120, g: 255, b: 140 }, // Neon green
        { r: 200, g: 100, b: 255 }, // Purple
        { r: 255, g: 150, b: 80 },  // Orange
      ];
      
      // Cycle through colors based on animation time
      const colorCycle = (animationTime * 0.02 + seed * 0.1) % colors.length;
      const colorIdx = Math.floor(colorCycle);
      const nextColorIdx = (colorIdx + 1) % colors.length;
      const colorBlend = colorCycle - colorIdx;
      
      // Blend between colors for smooth transitions
      const color1 = colors[colorIdx];
      const color2 = colors[nextColorIdx];
      const color = {
        r: Math.round(color1.r + (color2.r - color1.r) * colorBlend),
        g: Math.round(color1.g + (color2.g - color1.g) * colorBlend),
        b: Math.round(color1.b + (color2.b - color1.b) * colorBlend),
      };
      
      const glowRadius = 30 * pulse;
      const gradient = ctx.createRadialGradient(tileCenterX, tileCenterY - 20, 0, tileCenterX, tileCenterY - 20, glowRadius);
      gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${0.35 * lightIntensity * pulse})`);
      gradient.addColorStop(0.5, `rgba(${color.r}, ${color.g}, ${color.b}, ${0.15 * lightIntensity})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(tileCenterX, tileCenterY - 20, glowRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// =============================================================================
// MAIN HOOK
// =============================================================================

/**
 * Hook for rendering day/night lighting effects in IsoCoaster
 * Enhanced with animated lighting and atmospheric effects
 */
export function useCoasterLightingSystem(config: CoasterLightingConfig): void {
  const {
    canvasRef,
    grid,
    gridSize,
    hour,
    offset,
    zoom,
    canvasWidth,
    canvasHeight,
    animationTime = 0,
  } = config;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const darkness = getDarkness(hour);
    
    // Clear canvas first
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // If it's full daylight, just clear and return
    if (darkness <= 0.01) return;
    
    const ambient = getAmbientColor(hour);
    
    // Apply darkness overlay with gradient from ambient color
    // Creates more atmospheric night sky effect
    const alpha = darkness * 0.28;
    
    // Create a subtle vertical gradient for sky-like effect
    const overlayGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    overlayGradient.addColorStop(0, `rgba(${ambient.r * 0.3}, ${ambient.g * 0.3}, ${ambient.b}, ${alpha * 1.1})`);
    overlayGradient.addColorStop(0.5, `rgba(${Math.floor(ambient.r * 0.2)}, ${Math.floor(ambient.g * 0.2)}, ${Math.floor(ambient.b * 0.8)}, ${alpha})`);
    overlayGradient.addColorStop(1, `rgba(0, 5, 25, ${alpha * 0.9})`);
    ctx.fillStyle = overlayGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Calculate viewport bounds
    const viewWidth = canvas.width / (dpr * zoom);
    const viewHeight = canvas.height / (dpr * zoom);
    const viewLeft = -offset.x / zoom - TILE_WIDTH * 2;
    const viewTop = -offset.y / zoom - TILE_HEIGHT * 4;
    const viewRight = viewWidth - offset.x / zoom + TILE_WIDTH * 2;
    const viewBottom = viewHeight - offset.y / zoom + TILE_HEIGHT * 4;
    
    // Calculate visible diagonal range
    const visibleMinSum = Math.max(0, Math.floor((viewTop - TILE_HEIGHT * 6) * 2 / TILE_HEIGHT));
    const visibleMaxSum = Math.min(gridSize * 2 - 2, Math.ceil((viewBottom + TILE_HEIGHT) * 2 / TILE_HEIGHT));
    
    const lightIntensity = Math.min(1, darkness * 1.35);
    
    // Collect light sources
    const lights = collectLightSources(
      grid,
      gridSize,
      visibleMinSum,
      visibleMaxSum,
      viewLeft,
      viewRight,
      viewTop,
      viewBottom
    );
    
    // Draw light cutouts (destination-out to remove darkness)
    ctx.globalCompositeOperation = 'destination-out';
    ctx.save();
    ctx.scale(dpr * zoom, dpr * zoom);
    ctx.translate(offset.x / zoom, offset.y / zoom);
    
    drawLightCutouts(ctx, lights, lightIntensity, animationTime);
    
    ctx.restore();
    
    // Draw colored glows (source-over for atmosphere)
    ctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.scale(dpr * zoom, dpr * zoom);
    ctx.translate(offset.x / zoom, offset.y / zoom);
    
    drawColoredGlows(ctx, lights, lightIntensity, animationTime);
    
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    
  }, [canvasRef, grid, gridSize, hour, offset, zoom, canvasWidth, canvasHeight, animationTime]);
}
