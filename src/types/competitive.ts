// Competitive game mode types for RTS-style gameplay

export type PlayerId = 'player' | 'ai1' | 'ai2' | 'ai3';

export type MilitaryUnitType = 'infantry' | 'tank' | 'military_helicopter';

export interface MilitaryUnit {
  id: number;
  type: MilitaryUnitType;
  ownerId: PlayerId;
  // Position in screen coordinates
  x: number;
  y: number;
  // Tile position for pathfinding
  tileX: number;
  tileY: number;
  // Movement
  targetX: number | null;
  targetY: number | null;
  path: { x: number; y: number }[];
  pathIndex: number;
  speed: number;
  // Combat
  health: number;
  maxHealth: number;
  damage: number;
  attackRange: number;
  attackCooldown: number;
  currentCooldown: number;
  // State
  state: 'idle' | 'moving' | 'attacking' | 'dead';
  targetUnitId: number | null;
  targetBuildingX: number | null;
  targetBuildingY: number | null;
  // Visual
  direction: 'north' | 'east' | 'south' | 'west';
  animationFrame: number;
  selected: boolean;
}

export interface AIPlayer {
  id: PlayerId;
  name: string;
  color: string;
  // Territory info
  cityX: number;
  cityY: number;
  cityRadius: number;
  // Resources
  money: number;
  score: number;
  // State
  eliminated: boolean;
  eliminatedAt: number | null;
  // AI behavior
  aggressiveness: number; // 0-1, how likely to attack
  expansionRate: number; // 0-1, how fast to build
  lastActionTime: number;
  unitProductionTimer: number;
}

export interface CompetitiveState {
  enabled: boolean;
  // Map settings
  mapSize: number;
  // Players
  players: AIPlayer[];
  humanPlayerId: PlayerId;
  // Fog of war - which tiles the player has explored
  exploredTiles: boolean[][];
  visibleTiles: boolean[][]; // Currently visible (near units/buildings)
  // Military units
  units: MilitaryUnit[];
  nextUnitId: number;
  // Selection
  selectedUnitIds: number[];
  selectionBox: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    active: boolean;
  } | null;
  // Game state
  gameOver: boolean;
  winnerId: PlayerId | null;
  // Production
  barracksQueue: { type: MilitaryUnitType; progress: number; ownerId: PlayerId }[];
}

export const MILITARY_UNIT_STATS: Record<MilitaryUnitType, {
  name: string;
  cost: number;
  health: number;
  damage: number;
  speed: number;
  range: number;
  buildTime: number; // seconds
  description: string;
}> = {
  infantry: {
    name: 'Infantry',
    cost: 100,
    health: 100,
    damage: 15,
    speed: 40,
    range: 50,
    buildTime: 5,
    description: 'Basic ground unit. Good against buildings.',
  },
  tank: {
    name: 'Tank',
    cost: 400,
    health: 300,
    damage: 50,
    speed: 60,
    range: 80,
    buildTime: 12,
    description: 'Heavy armored unit. Strong against all targets.',
  },
  military_helicopter: {
    name: 'Attack Helicopter',
    cost: 600,
    health: 150,
    damage: 40,
    speed: 100,
    range: 100,
    buildTime: 15,
    description: 'Fast air unit. Can attack from above.',
  },
};

// Player colors for competitive mode
export const PLAYER_COLORS: Record<PlayerId, { primary: string; secondary: string; name: string }> = {
  player: { primary: '#3b82f6', secondary: '#1d4ed8', name: 'Blue' },
  ai1: { primary: '#ef4444', secondary: '#b91c1c', name: 'Red' },
  ai2: { primary: '#22c55e', secondary: '#15803d', name: 'Green' },
  ai3: { primary: '#f59e0b', secondary: '#d97706', name: 'Orange' },
};

// AI city names
export const AI_CITY_NAMES = [
  'Ironhold',
  'Crimson Keep',
  'Shadowmere',
  'Dragonspire',
  'Frostgate',
  'Stormwind',
  'Blackrock',
  'Goldshire',
];

// Competitive game settings
export const COMPETITIVE_SETTINGS = {
  startingMoney: 5000, // Less than normal game
  mapSize: 100, // Larger map
  aiCount: 3, // Number of AI opponents
  fogOfWarRadius: 8, // Vision radius for buildings
  unitVisionRadius: 5, // Vision radius for units
  aiUpdateInterval: 2000, // How often AI makes decisions (ms)
  scorePerBuilding: 10,
  scorePerUnit: 5,
  scorePerKill: 20,
  eliminationThreshold: 0, // Eliminated when score drops to 0 and no units/buildings
};

// Initial competitive game state
export function createInitialCompetitiveState(mapSize: number, aiCount: number): CompetitiveState {
  const exploredTiles: boolean[][] = [];
  const visibleTiles: boolean[][] = [];
  
  for (let y = 0; y < mapSize; y++) {
    exploredTiles[y] = [];
    visibleTiles[y] = [];
    for (let x = 0; x < mapSize; x++) {
      exploredTiles[y][x] = false;
      visibleTiles[y][x] = false;
    }
  }
  
  return {
    enabled: true,
    mapSize,
    players: [],
    humanPlayerId: 'player',
    exploredTiles,
    visibleTiles,
    units: [],
    nextUnitId: 1,
    selectedUnitIds: [],
    selectionBox: null,
    gameOver: false,
    winnerId: null,
    barracksQueue: [],
  };
}
