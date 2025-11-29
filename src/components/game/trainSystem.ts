/**
 * Train System - Multi-carriage trains on rail tracks (freight and passenger)
 */

import { Tile } from '@/types/game';
import { TILE_WIDTH, TILE_HEIGHT } from './types';
import { getAdjacentRails } from './railSystem';

// ============================================================================
// Types
// ============================================================================

export type TrainDirection = 'north' | 'east' | 'south' | 'west';

export type TrainType = 'passenger' | 'freight';

export interface TrainCarriage {
  // Relative position from the front of the train
  offsetProgress: number; // How many tiles behind the front carriage
  type: 'engine' | 'passenger' | 'freight_box' | 'freight_tank' | 'freight_flat' | 'caboose';
}

export interface Train {
  id: number;
  type: TrainType;
  tileX: number;
  tileY: number;
  direction: TrainDirection;
  progress: number; // 0-1 progress through current tile
  speed: number; // Tiles per second
  age: number;
  maxAge: number;
  color: string; // Main color of the train
  accentColor: string; // Secondary color
  carriages: TrainCarriage[]; // List of carriages including engine
  length: number; // Total length in tiles
}

// ============================================================================
// Constants
// ============================================================================

export const TRAIN_COLORS = {
  PASSENGER: [
    { main: '#dc2626', accent: '#fbbf24' }, // Red with yellow stripe
    { main: '#2563eb', accent: '#ffffff' }, // Blue with white stripe
    { main: '#16a34a', accent: '#fbbf24' }, // Green with yellow stripe
    { main: '#7c3aed', accent: '#ffffff' }, // Purple with white stripe
  ],
  FREIGHT: [
    { main: '#78350f', accent: '#fbbf24' }, // Brown with yellow stripe
    { main: '#1f2937', accent: '#f97316' }, // Dark gray with orange stripe
    { main: '#4b5563', accent: '#ef4444' }, // Gray with red stripe
    { main: '#065f46', accent: '#fbbf24' }, // Dark green with yellow stripe
  ],
};

export const TRAIN_CONFIG = {
  PASSENGER_SPEED: 0.4, // Tiles per second
  FREIGHT_SPEED: 0.25, // Tiles per second (slower)
  PASSENGER_LENGTH: 5, // 1 engine + 4 passenger cars
  FREIGHT_LENGTH: 8, // 1 engine + 6 freight cars + 1 caboose
  CARRIAGE_SPACING: 0.15, // Space between carriages in tiles
  MIN_RAILS_FOR_TRAINS: 20, // Minimum rail tiles before spawning trains
};

// ============================================================================
// Train Movement Helpers
// ============================================================================

/**
 * Check if a tile is a rail
 */
function isRail(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  return grid[y][x].building.type === 'rail';
}

/**
 * Get valid directions from a rail tile
 */
export function getRailDirectionOptions(
  grid: Tile[][],
  gridSize: number,
  tileX: number,
  tileY: number
): TrainDirection[] {
  const options: TrainDirection[] = [];
  const adj = getAdjacentRails(grid, gridSize, tileX, tileY);

  if (adj.north) options.push('north');
  if (adj.east) options.push('east');
  if (adj.south) options.push('south');
  if (adj.west) options.push('west');

  return options;
}

/**
 * Pick next direction for train to avoid going backwards
 */
export function pickNextTrainDirection(
  currentDirection: TrainDirection,
  grid: Tile[][],
  gridSize: number,
  tileX: number,
  tileY: number
): TrainDirection | null {
  const options = getRailDirectionOptions(grid, gridSize, tileX, tileY);
  
  if (options.length === 0) return null;
  if (options.length === 1) return options[0];

  // Prefer to go straight
  if (options.includes(currentDirection)) {
    return currentDirection;
  }

  // Avoid going backwards
  const opposite: Record<TrainDirection, TrainDirection> = {
    north: 'south',
    east: 'west',
    south: 'north',
    west: 'east',
  };

  const validOptions = options.filter(d => d !== opposite[currentDirection]);
  
  if (validOptions.length > 0) {
    return validOptions[Math.floor(Math.random() * validOptions.length)];
  }

  // If no choice but to reverse, do it
  return options[0];
}

/**
 * Direction metadata for movement
 */
export const TRAIN_DIRECTION_META: Record<TrainDirection, { step: { x: number; y: number }; angle: number }> = {
  north: { step: { x: -1, y: 0 }, angle: -Math.PI * 0.75 },
  east: { step: { x: 0, y: -1 }, angle: -Math.PI * 0.25 },
  south: { step: { x: 1, y: 0 }, angle: Math.PI * 0.25 },
  west: { step: { x: 0, y: 1 }, angle: Math.PI * 0.75 },
};

// ============================================================================
// Train Creation
// ============================================================================

/**
 * Create carriages for a passenger train
 */
function createPassengerCarriages(): TrainCarriage[] {
  const carriages: TrainCarriage[] = [];
  
  // Engine at front
  carriages.push({ offsetProgress: 0, type: 'engine' });
  
  // Passenger cars (spaced slightly apart)
  for (let i = 1; i < TRAIN_CONFIG.PASSENGER_LENGTH; i++) {
    carriages.push({
      offsetProgress: i * (1 + TRAIN_CONFIG.CARRIAGE_SPACING),
      type: 'passenger',
    });
  }
  
  return carriages;
}

/**
 * Create carriages for a freight train
 */
function createFreightCarriages(): TrainCarriage[] {
  const carriages: TrainCarriage[] = [];
  
  // Engine at front
  carriages.push({ offsetProgress: 0, type: 'engine' });
  
  // Mix of freight car types
  const freightTypes: ('freight_box' | 'freight_tank' | 'freight_flat')[] = [
    'freight_box',
    'freight_tank',
    'freight_flat',
  ];
  
  for (let i = 1; i < TRAIN_CONFIG.FREIGHT_LENGTH - 1; i++) {
    const type = freightTypes[Math.floor(Math.random() * freightTypes.length)];
    carriages.push({
      offsetProgress: i * (1 + TRAIN_CONFIG.CARRIAGE_SPACING),
      type,
    });
  }
  
  // Caboose at end
  carriages.push({
    offsetProgress: (TRAIN_CONFIG.FREIGHT_LENGTH - 1) * (1 + TRAIN_CONFIG.CARRIAGE_SPACING),
    type: 'caboose',
  });
  
  return carriages;
}

/**
 * Create a new train
 */
export function createTrain(
  id: number,
  type: TrainType,
  tileX: number,
  tileY: number,
  direction: TrainDirection
): Train {
  const colorPalette = type === 'passenger' ? TRAIN_COLORS.PASSENGER : TRAIN_COLORS.FREIGHT;
  const colors = colorPalette[Math.floor(Math.random() * colorPalette.length)];
  
  const carriages = type === 'passenger' 
    ? createPassengerCarriages()
    : createFreightCarriages();
  
  const length = carriages[carriages.length - 1].offsetProgress + 1;
  
  return {
    id,
    type,
    tileX,
    tileY,
    direction,
    progress: Math.random() * 0.5,
    speed: type === 'passenger' ? TRAIN_CONFIG.PASSENGER_SPEED : TRAIN_CONFIG.FREIGHT_SPEED,
    age: 0,
    maxAge: 30 + Math.random() * 30, // 30-60 seconds
    color: colors.main,
    accentColor: colors.accent,
    carriages,
    length,
  };
}

// ============================================================================
// Train Spawning
// ============================================================================

/**
 * Find a random rail tile to spawn a train
 */
export function findRandomRailTile(
  grid: Tile[][],
  gridSize: number
): { x: number; y: number; direction: TrainDirection } | null {
  const railTiles: { x: number; y: number }[] = [];
  
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (grid[y][x].building.type === 'rail') {
        railTiles.push({ x, y });
      }
    }
  }
  
  if (railTiles.length < TRAIN_CONFIG.MIN_RAILS_FOR_TRAINS) {
    return null;
  }
  
  // Try to find a suitable spawn point
  for (let attempt = 0; attempt < 20; attempt++) {
    const tile = railTiles[Math.floor(Math.random() * railTiles.length)];
    const options = getRailDirectionOptions(grid, gridSize, tile.x, tile.y);
    
    if (options.length > 0) {
      const direction = options[Math.floor(Math.random() * options.length)];
      return { x: tile.x, y: tile.y, direction };
    }
  }
  
  return null;
}

// ============================================================================
// Train Rendering Helpers
// ============================================================================

/**
 * Get position in isometric screen space for a train carriage
 */
export function getTrainCarriagePosition(
  train: Train,
  carriage: TrainCarriage,
  grid: Tile[][],
  gridSize: number
): { screenX: number; screenY: number; angle: number } | null {
  // Calculate the tile position for this carriage by walking backwards from the front
  let currentX = train.tileX;
  let currentY = train.tileY;
  let currentDirection = train.direction;
  let remainingOffset = train.progress + carriage.offsetProgress;
  
  // Walk backwards along the track
  const opposite: Record<TrainDirection, TrainDirection> = {
    north: 'south',
    east: 'west',
    south: 'north',
    west: 'east',
  };
  
  const maxSteps = 50; // Prevent infinite loops
  let steps = 0;
  
  while (remainingOffset > 1 && steps < maxSteps) {
    steps++;
    remainingOffset -= 1;
    
    // Move backwards one tile
    const backwardDir = opposite[currentDirection];
    const meta = TRAIN_DIRECTION_META[backwardDir];
    currentX += meta.step.x;
    currentY += meta.step.y;
    
    // Check if still on rails
    if (!isRail(grid, gridSize, currentX, currentY)) {
      return null; // Carriage is off the tracks
    }
    
    // Update direction based on available rails
    const options = getRailDirectionOptions(grid, gridSize, currentX, currentY);
    if (options.length === 0) return null;
    
    // Try to continue in the same direction
    if (options.includes(currentDirection)) {
      // Keep same direction
    } else {
      // Pick a new direction (avoid the one we just came from)
      const validOptions = options.filter(d => d !== backwardDir);
      if (validOptions.length > 0) {
        currentDirection = validOptions[0];
      } else {
        currentDirection = options[0];
      }
    }
  }
  
  // Now we have the tile position, calculate screen position
  const progress = 1 - remainingOffset; // Progress within the current tile
  
  const meta = TRAIN_DIRECTION_META[currentDirection];
  const tileScreenX = currentX * TILE_WIDTH / 2 + currentY * TILE_WIDTH / 2;
  const tileScreenY = currentX * TILE_HEIGHT / 2 - currentY * TILE_HEIGHT / 2;
  
  const centerX = tileScreenX + TILE_WIDTH / 2;
  const centerY = tileScreenY + TILE_HEIGHT / 2;
  
  // Movement vector for this direction
  const dx = meta.step.x * TILE_WIDTH / 2 + meta.step.y * TILE_WIDTH / 2;
  const dy = meta.step.x * TILE_HEIGHT / 2 - meta.step.y * TILE_HEIGHT / 2;
  
  const screenX = centerX + dx * progress;
  const screenY = centerY + dy * progress;
  
  return {
    screenX,
    screenY,
    angle: meta.angle,
  };
}
