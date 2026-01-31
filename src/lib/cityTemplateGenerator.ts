/**
 * City Template Generator for AI Civilization Mode
 *
 * Creates cities with a proper GRID LAYOUT:
 * - Roads forming rectangular blocks
 * - Infrastructure (power plant, water tower)
 * - Zoned plots within the blocks
 *
 * The grid pattern creates a realistic urban structure.
 */

import { GameState, Tile } from '@/games/isocity/types/game';
import { Building, BuildingType } from '@/games/isocity/types/buildings';
import { ZoneType } from '@/games/isocity/types/zones';
import { CIVILIZATION_CONSTANTS } from '@/types/civilization';

const GRID_SIZE = CIVILIZATION_CONSTANTS.GRID_SIZE; // 30x30
const BLOCK_SIZE = 4; // Size of each city block (tiles between roads)
const ROAD_SPACING = BLOCK_SIZE + 1; // Distance between parallel roads

/**
 * Create a building
 */
function createBuilding(type: BuildingType, population: number = 0, jobs: number = 0): Building {
  return {
    type,
    level: type === 'grass' || type === 'empty' || type === 'water' ? 0 : 1,
    population,
    jobs,
    powered: type === 'grass' || type === 'water' ? false : true,
    watered: type === 'grass' || type === 'water' ? false : true,
    onFire: false,
    fireProgress: 0,
    age: 0,
    constructionProgress: 100,
    abandoned: false,
  };
}

/**
 * Create an empty tile
 */
function createTile(x: number, y: number): Tile {
  return {
    x,
    y,
    zone: 'none',
    building: createBuilding('grass'),
    landValue: 10,
    pollution: 0,
    crime: 0,
    traffic: 0,
    hasSubway: false,
  };
}

/**
 * Create service coverage arrays
 */
function createServiceCoverage(size: number) {
  return {
    police: Array.from({ length: size }, () => Array(size).fill(0)),
    fire: Array.from({ length: size }, () => Array(size).fill(0)),
    health: Array.from({ length: size }, () => Array(size).fill(0)),
    education: Array.from({ length: size }, () => Array(size).fill(0)),
    power: Array.from({ length: size }, () => Array(size).fill(false)),
    water: Array.from({ length: size }, () => Array(size).fill(false)),
  };
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `city-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a city with a proper grid road network
 *
 * Layout example (3x3 blocks):
 *
 *   ═══════════════════════
 *   ║     ║     ║     ║
 *   ║  R  ║  C  ║  R  ║
 *   ║     ║     ║     ║
 *   ═══════════════════════
 *   ║     ║     ║     ║
 *   ║  I  ║  P  ║  C  ║
 *   ║     ║     ║     ║
 *   ═══════════════════════
 *   ║     ║     ║     ║
 *   ║  R  ║  R  ║  R  ║
 *   ║     ║     ║     ║
 *   ═══════════════════════
 *
 * R = Residential, C = Commercial, I = Industrial, P = Park/Services
 */
export function generateSeedCity(cityName: string): GameState {
  // Create empty grid (all grass)
  const grid: Tile[][] = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      row.push(createTile(x, y));
    }
    grid.push(row);
  }

  const centerX = Math.floor(GRID_SIZE / 2); // 15
  const centerY = Math.floor(GRID_SIZE / 2); // 15

  // === CREATE GRID ROAD NETWORK ===
  // We'll create a 3x3 grid of blocks centered on the map

  // Calculate starting position for the grid (centered)
  const gridWidth = 3 * ROAD_SPACING + 1; // 3 blocks = 16 tiles wide
  const startX = centerX - Math.floor(gridWidth / 2); // Start X
  const startY = centerY - Math.floor(gridWidth / 2); // Start Y

  // Horizontal roads (4 roads for 3 blocks)
  for (let roadIndex = 0; roadIndex <= 3; roadIndex++) {
    const roadY = startY + roadIndex * ROAD_SPACING;
    if (roadY >= 0 && roadY < GRID_SIZE) {
      for (let x = startX; x <= startX + gridWidth - 1 && x < GRID_SIZE; x++) {
        if (x >= 0) {
          grid[roadY][x].building = createBuilding('road');
        }
      }
    }
  }

  // Vertical roads (4 roads for 3 blocks)
  for (let roadIndex = 0; roadIndex <= 3; roadIndex++) {
    const roadX = startX + roadIndex * ROAD_SPACING;
    if (roadX >= 0 && roadX < GRID_SIZE) {
      for (let y = startY; y <= startY + gridWidth - 1 && y < GRID_SIZE; y++) {
        if (y >= 0) {
          grid[y][roadX].building = createBuilding('road');
        }
      }
    }
  }

  // === ZONE THE BLOCKS ===
  // Block positions (top-left corner of each block interior)
  const blocks: { x: number; y: number; zone: ZoneType }[] = [
    // Row 1
    { x: startX + 1, y: startY + 1, zone: 'residential' },
    { x: startX + 1 + ROAD_SPACING, y: startY + 1, zone: 'commercial' },
    { x: startX + 1 + 2 * ROAD_SPACING, y: startY + 1, zone: 'residential' },
    // Row 2
    { x: startX + 1, y: startY + 1 + ROAD_SPACING, zone: 'industrial' },
    { x: startX + 1 + ROAD_SPACING, y: startY + 1 + ROAD_SPACING, zone: 'none' }, // Center block for services
    { x: startX + 1 + 2 * ROAD_SPACING, y: startY + 1 + ROAD_SPACING, zone: 'commercial' },
    // Row 3
    { x: startX + 1, y: startY + 1 + 2 * ROAD_SPACING, zone: 'residential' },
    { x: startX + 1 + ROAD_SPACING, y: startY + 1 + 2 * ROAD_SPACING, zone: 'residential' },
    { x: startX + 1 + 2 * ROAD_SPACING, y: startY + 1 + 2 * ROAD_SPACING, zone: 'residential' },
  ];

  // Apply zones to blocks
  for (const block of blocks) {
    if (block.zone === 'none') continue; // Skip center block

    for (let dy = 0; dy < BLOCK_SIZE; dy++) {
      for (let dx = 0; dx < BLOCK_SIZE; dx++) {
        const x = block.x + dx;
        const y = block.y + dy;
        if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
          if (grid[y][x].building.type === 'grass') {
            grid[y][x].zone = block.zone;
          }
        }
      }
    }
  }

  // === INFRASTRUCTURE ===
  // Place power plant in the center block (2x2)
  const centerBlockX = startX + 1 + ROAD_SPACING;
  const centerBlockY = startY + 1 + ROAD_SPACING;

  grid[centerBlockY][centerBlockX].building = createBuilding('power_plant');
  grid[centerBlockY][centerBlockX + 1].building = createBuilding('empty');
  grid[centerBlockY + 1][centerBlockX].building = createBuilding('empty');
  grid[centerBlockY + 1][centerBlockX + 1].building = createBuilding('empty');

  // Water tower in center block
  grid[centerBlockY + 2][centerBlockX + 2].building = createBuilding('water_tower');

  // === CREATE GAME STATE ===
  const state: GameState = {
    id: generateId(),
    grid,
    gridSize: GRID_SIZE,
    cityName,
    year: 2024,
    month: 1,
    day: 1,
    hour: 12,
    tick: 0,
    speed: 1,
    selectedTool: 'select',
    taxRate: 9,
    effectiveTaxRate: 9,
    stats: {
      population: 0,
      jobs: 0,
      money: CIVILIZATION_CONSTANTS.STARTING_MONEY,
      income: 0,
      expenses: 100,
      happiness: 50,
      health: 50,
      education: 50,
      safety: 50,
      environment: 70,
      demand: {
        residential: 100,
        commercial: 80,
        industrial: 60,
      },
    },
    budget: {
      police: { name: 'Police', funding: 100, cost: 0 },
      fire: { name: 'Fire', funding: 100, cost: 0 },
      health: { name: 'Health', funding: 100, cost: 0 },
      education: { name: 'Education', funding: 100, cost: 0 },
      transportation: { name: 'Transportation', funding: 100, cost: 50 },
      parks: { name: 'Parks', funding: 100, cost: 0 },
      power: { name: 'Power', funding: 100, cost: 50 },
      water: { name: 'Water', funding: 100, cost: 30 },
    },
    services: createServiceCoverage(GRID_SIZE),
    notifications: [],
    advisorMessages: [],
    history: [],
    activePanel: 'none',
    disastersEnabled: false,
    adjacentCities: [],
    waterBodies: [],
    gameVersion: 0,
    cities: [{
      id: generateId(),
      name: cityName,
      bounds: { minX: 0, minY: 0, maxX: GRID_SIZE - 1, maxY: GRID_SIZE - 1 },
      economy: {
        population: 0,
        jobs: 0,
        income: 0,
        expenses: 100,
        happiness: 50,
        lastCalculated: 0,
      },
      color: '#3b82f6',
    }],
  };

  return state;
}

/**
 * Generate a city with variations based on seed
 * Varies: grid size (2x2 to 4x4), zone distribution, infrastructure placement
 */
export function generateRandomizedCity(cityName: string, seed: number): GameState {
  // Create empty grid (all grass)
  const grid: Tile[][] = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      row.push(createTile(x, y));
    }
    grid.push(row);
  }

  // Seeded random function
  const rng = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  // Determine grid size (2x2 to 4x4 blocks)
  const numBlocks = 2 + Math.floor(rng() * 3); // 2, 3, or 4
  const blockSize = 3 + Math.floor(rng() * 2); // 3 or 4 tiles per block
  const roadSpacing = blockSize + 1;

  const centerX = Math.floor(GRID_SIZE / 2);
  const centerY = Math.floor(GRID_SIZE / 2);

  // Calculate grid dimensions
  const gridWidth = numBlocks * roadSpacing + 1;
  const startX = centerX - Math.floor(gridWidth / 2);
  const startY = centerY - Math.floor(gridWidth / 2);

  // === CREATE ROAD GRID ===
  // Horizontal roads
  for (let roadIndex = 0; roadIndex <= numBlocks; roadIndex++) {
    const roadY = startY + roadIndex * roadSpacing;
    if (roadY >= 0 && roadY < GRID_SIZE) {
      for (let x = Math.max(0, startX); x <= Math.min(startX + gridWidth - 1, GRID_SIZE - 1); x++) {
        grid[roadY][x].building = createBuilding('road');
      }
    }
  }

  // Vertical roads
  for (let roadIndex = 0; roadIndex <= numBlocks; roadIndex++) {
    const roadX = startX + roadIndex * roadSpacing;
    if (roadX >= 0 && roadX < GRID_SIZE) {
      for (let y = Math.max(0, startY); y <= Math.min(startY + gridWidth - 1, GRID_SIZE - 1); y++) {
        grid[y][roadX].building = createBuilding('road');
      }
    }
  }

  // === ZONE THE BLOCKS ===
  // Different zone patterns based on seed
  const zonePatterns: ZoneType[][] = [
    ['residential', 'commercial', 'residential', 'industrial'],
    ['residential', 'residential', 'commercial', 'industrial'],
    ['commercial', 'residential', 'residential', 'residential'],
    ['industrial', 'commercial', 'residential', 'residential'],
  ];
  const patternIndex = Math.floor(rng() * zonePatterns.length);
  const basePattern = zonePatterns[patternIndex];

  let blockIndex = 0;
  for (let blockRow = 0; blockRow < numBlocks; blockRow++) {
    for (let blockCol = 0; blockCol < numBlocks; blockCol++) {
      const blockX = startX + 1 + blockCol * roadSpacing;
      const blockY = startY + 1 + blockRow * roadSpacing;

      // Determine zone for this block
      let zone: ZoneType;

      // Center block(s) reserved for infrastructure
      const isCenterRow = blockRow === Math.floor(numBlocks / 2);
      const isCenterCol = blockCol === Math.floor(numBlocks / 2);

      if (isCenterRow && isCenterCol) {
        zone = 'none'; // Infrastructure block
      } else {
        zone = basePattern[blockIndex % basePattern.length];
        blockIndex++;
      }

      // Apply zone to all tiles in block
      if (zone !== 'none') {
        for (let dy = 0; dy < blockSize; dy++) {
          for (let dx = 0; dx < blockSize; dx++) {
            const x = blockX + dx;
            const y = blockY + dy;
            if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
              if (grid[y][x].building.type === 'grass') {
                grid[y][x].zone = zone;
              }
            }
          }
        }
      }
    }
  }

  // === INFRASTRUCTURE ===
  // Power plant in center block
  const centerBlockX = startX + 1 + Math.floor(numBlocks / 2) * roadSpacing;
  const centerBlockY = startY + 1 + Math.floor(numBlocks / 2) * roadSpacing;

  if (centerBlockX >= 0 && centerBlockX + 1 < GRID_SIZE &&
      centerBlockY >= 0 && centerBlockY + 1 < GRID_SIZE) {
    grid[centerBlockY][centerBlockX].building = createBuilding('power_plant');
    grid[centerBlockY][centerBlockX + 1].building = createBuilding('empty');
    grid[centerBlockY + 1][centerBlockX].building = createBuilding('empty');
    grid[centerBlockY + 1][centerBlockX + 1].building = createBuilding('empty');
  }

  // Water tower
  const wtX = centerBlockX + Math.min(blockSize - 1, 2);
  const wtY = centerBlockY + Math.min(blockSize - 1, 2);
  if (wtX >= 0 && wtX < GRID_SIZE && wtY >= 0 && wtY < GRID_SIZE) {
    if (grid[wtY][wtX].building.type === 'grass' || grid[wtY][wtX].building.type === 'empty') {
      grid[wtY][wtX].building = createBuilding('water_tower');
    }
  }

  // === CREATE GAME STATE ===
  const state: GameState = {
    id: generateId(),
    grid,
    gridSize: GRID_SIZE,
    cityName,
    year: 2024,
    month: 1,
    day: 1,
    hour: 12,
    tick: 0,
    speed: 1,
    selectedTool: 'select',
    taxRate: 9,
    effectiveTaxRate: 9,
    stats: {
      population: 0,
      jobs: 0,
      money: CIVILIZATION_CONSTANTS.STARTING_MONEY,
      income: 0,
      expenses: 100,
      happiness: 50,
      health: 50,
      education: 50,
      safety: 50,
      environment: 70,
      demand: {
        residential: 100,
        commercial: 80,
        industrial: 60,
      },
    },
    budget: {
      police: { name: 'Police', funding: 100, cost: 0 },
      fire: { name: 'Fire', funding: 100, cost: 0 },
      health: { name: 'Health', funding: 100, cost: 0 },
      education: { name: 'Education', funding: 100, cost: 0 },
      transportation: { name: 'Transportation', funding: 100, cost: 50 },
      parks: { name: 'Parks', funding: 100, cost: 0 },
      power: { name: 'Power', funding: 100, cost: 50 },
      water: { name: 'Water', funding: 100, cost: 30 },
    },
    services: createServiceCoverage(GRID_SIZE),
    notifications: [],
    advisorMessages: [],
    history: [],
    activePanel: 'none',
    disastersEnabled: false,
    adjacentCities: [],
    waterBodies: [],
    gameVersion: 0,
    cities: [{
      id: generateId(),
      name: cityName,
      bounds: { minX: 0, minY: 0, maxX: GRID_SIZE - 1, maxY: GRID_SIZE - 1 },
      economy: {
        population: 0,
        jobs: 0,
        income: 0,
        expenses: 100,
        happiness: 50,
        lastCalculated: 0,
      },
      color: '#3b82f6',
    }],
  };

  return state;
}
