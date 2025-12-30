/**
 * Rise of Nations - Unit Types
 * 
 * SIMPLIFIED SYSTEM: Each military building produces ONE unit type that scales with age.
 * - Barracks -> Infantry (scales from militia to assault infantry)
 * - Stable -> Cavalry (scales from light cavalry to tanks)
 * - Siege Workshop -> Siege (scales from catapult to artillery)
 * - Archery Range -> Ranged (scales from archers to skirmishers)
 * - Dock -> Naval (scales from galley to destroyer)
 * - Airfield -> Air (scales from biplane to fighter)
 */

import { Age } from './ages';
import { Resources } from './resources';

export type UnitCategory = 
  | 'civilian'    // Citizens, workers
  | 'infantry'    // Foot soldiers
  | 'ranged'      // Archers, riflemen
  | 'cavalry'     // Mounted units (horses, vehicles)
  | 'siege'       // Siege weapons
  | 'naval'       // Ships
  | 'air';        // Aircraft

// Simplified unit types - one main type per category that scales with age
export type UnitType =
  // Civilian
  | 'citizen'     // Basic worker, gathers resources, builds
  // Military - ONE per building, scales with age
  | 'infantry'    // Barracks: militia -> rifleman -> assault infantry
  | 'ranged'      // Archery Range: archer -> crossbow -> skirmisher
  | 'cavalry'     // Stable: light cavalry -> knight -> tank
  | 'siege'       // Siege Workshop: catapult -> cannon -> artillery
  | 'naval'       // Dock: galley -> frigate -> destroyer
  | 'air'         // Airfield: biplane -> fighter
  | 'fishing_boat'; // Special - dock can also make these

export interface UnitStats {
  category: UnitCategory;
  cost: Partial<Resources>;
  health: number;
  attack: number;
  defense: number;
  speed: number;        // Movement speed (tiles per second)
  range: number;        // Attack range in tiles
  buildTime: number;    // Ticks to produce
  minAge: Age;
  visionRange: number;
  // Special abilities
  canBuild?: boolean;
  canGather?: boolean;
  canHeal?: boolean;
  antiAir?: boolean;    // Can attack air units
  isAir?: boolean;      // Is an air unit
  isNaval?: boolean;    // Is a naval unit
  carriesUnits?: number; // Can transport other units
}

// Age-based stat multipliers for military units
const AGE_MULTIPLIERS: Record<Age, { health: number; attack: number; cost: number }> = {
  'classical': { health: 1.0, attack: 1.0, cost: 1.0 },
  'medieval': { health: 1.4, attack: 1.3, cost: 1.3 },
  'enlightenment': { health: 1.8, attack: 1.7, cost: 1.6 },
  'industrial': { health: 2.5, attack: 2.5, cost: 2.0 },
  'modern': { health: 3.5, attack: 3.5, cost: 2.5 },
};

// Age-based unit names for display/drawing
export const UNIT_AGE_NAMES: Record<UnitType, Partial<Record<Age, string>>> = {
  'citizen': {},
  'infantry': {
    'classical': 'Militia',
    'medieval': 'Pikeman',
    'enlightenment': 'Musketeer',
    'industrial': 'Rifleman',
    'modern': 'Assault Infantry',
  },
  'ranged': {
    'classical': 'Archer',
    'medieval': 'Crossbowman',
    'enlightenment': 'Skirmisher',
    'industrial': 'Sharpshooter',
    'modern': 'Marksman',
  },
  'cavalry': {
    'classical': 'Light Cavalry',
    'medieval': 'Knight',
    'enlightenment': 'Dragoon',
    'industrial': 'Armored Car',
    'modern': 'Tank',
  },
  'siege': {
    'classical': 'Catapult',
    'medieval': 'Trebuchet',
    'enlightenment': 'Cannon',
    'industrial': 'Howitzer',
    'modern': 'Artillery',
  },
  'naval': {
    'classical': 'Galley',
    'medieval': 'Carrack',
    'enlightenment': 'Frigate',
    'industrial': 'Ironclad',
    'modern': 'Destroyer',
  },
  'air': {
    'industrial': 'Biplane',
    'modern': 'Fighter',
  },
  'fishing_boat': {},
};

// Base stats (classical age) - these get multiplied by age
export const UNIT_STATS: Record<UnitType, UnitStats> = {
  // Civilians - don't scale with age
  citizen: {
    category: 'civilian',
    cost: { food: 60 },
    health: 30,
    attack: 2,
    defense: 0,
    speed: 1.5,
    range: 1,
    buildTime: 45,
    minAge: 'classical',
    visionRange: 4,
    canBuild: true,
    canGather: true,
  },

  // Infantry - Barracks unit (scales with age)
  // Classical: Militia, Medieval: Pikeman, Enlightenment: Musketeer, Industrial: Rifleman, Modern: Assault Infantry
  infantry: {
    category: 'infantry',
    cost: { food: 40, wood: 20 },
    health: 60,
    attack: 10,
    defense: 3,
    speed: 1.2,
    range: 1, // Increases in enlightenment+ (guns)
    buildTime: 20,
    minAge: 'classical',
    visionRange: 4,
  },

  // Ranged - Archery Range unit (scales with age)
  // Classical: Archer, Medieval: Crossbowman, Enlightenment: Skirmisher
  ranged: {
    category: 'ranged',
    cost: { food: 35, wood: 25 },
    health: 40,
    attack: 8,
    defense: 1,
    speed: 1.2,
    range: 5,
    buildTime: 18,
    minAge: 'classical',
    visionRange: 6,
  },

  // Cavalry - Stable unit (scales with age)
  // Classical: Light Cavalry, Medieval: Knight, Enlightenment: Dragoon, Industrial: Armored Car, Modern: Tank
  cavalry: {
    category: 'cavalry',
    cost: { food: 60, gold: 40 },
    health: 80,
    attack: 12,
    defense: 4,
    speed: 2.5,
    range: 1,
    buildTime: 25,
    minAge: 'classical',
    visionRange: 6,
  },

  // Siege - Siege Workshop unit (scales with age)
  // Classical: Catapult, Medieval: Trebuchet, Enlightenment: Cannon, Industrial: Howitzer, Modern: Artillery
  siege: {
    category: 'siege',
    cost: { wood: 100, metal: 50 },
    health: 80,
    attack: 50,
    defense: 2,
    speed: 0.5,
    range: 10,
    buildTime: 40,
    minAge: 'classical',
    visionRange: 8,
  },

  // Naval - Dock military unit (scales with age)
  // Classical: Galley, Medieval: Carrack, Enlightenment: Frigate, Industrial: Ironclad, Modern: Destroyer
  naval: {
    category: 'naval',
    cost: { wood: 100, gold: 50 },
    health: 120,
    attack: 20,
    defense: 8,
    speed: 2,
    range: 4,
    buildTime: 35,
    minAge: 'classical',
    visionRange: 7,
    isNaval: true,
  },

  // Fishing boat - special civilian naval unit
  fishing_boat: {
    category: 'naval',
    cost: { wood: 50 },
    health: 40,
    attack: 0,
    defense: 0,
    speed: 2,
    range: 0,
    buildTime: 20,
    minAge: 'classical',
    visionRange: 5,
    isNaval: true,
    canGather: true,
  },

  // Air - Airfield unit (only available industrial+)
  // Industrial: Biplane, Modern: Fighter
  air: {
    category: 'air',
    cost: { metal: 150, gold: 100, oil: 40 },
    health: 100,
    attack: 40,
    defense: 10,
    speed: 5,
    range: 6,
    buildTime: 40,
    minAge: 'industrial',
    visionRange: 12,
    isAir: true,
    antiAir: true,
  },
};

/**
 * Get the actual stats for a unit based on the player's current age
 * Stats scale up as the player advances through ages
 */
export function getUnitStatsForAge(unitType: UnitType, age: Age): UnitStats {
  const baseStats = UNIT_STATS[unitType];
  
  // Civilians don't scale
  if (baseStats.category === 'civilian' || unitType === 'fishing_boat') {
    return baseStats;
  }
  
  const multiplier = AGE_MULTIPLIERS[age];
  
  // Calculate scaled stats
  const scaledStats: UnitStats = {
    ...baseStats,
    health: Math.round(baseStats.health * multiplier.health),
    attack: Math.round(baseStats.attack * multiplier.attack),
    cost: {},
  };
  
  // Scale costs
  for (const [resource, amount] of Object.entries(baseStats.cost)) {
    if (amount) {
      scaledStats.cost[resource as keyof Resources] = Math.round(amount * multiplier.cost);
    }
  }
  
  // Adjust range for gunpowder units (enlightenment+)
  if (unitType === 'infantry' && (age === 'enlightenment' || age === 'industrial' || age === 'modern')) {
    scaledStats.range = 4; // Guns have range
  }
  
  // Add oil cost for modern units
  if (age === 'modern' || age === 'industrial') {
    if (unitType === 'cavalry' || unitType === 'siege') {
      scaledStats.cost.oil = Math.round(20 * multiplier.cost);
    }
  }
  
  return scaledStats;
}

/**
 * Get the display name for a unit based on age
 */
export function getUnitDisplayName(unitType: UnitType, age: Age): string {
  const ageNames = UNIT_AGE_NAMES[unitType];
  return ageNames[age] || unitType.charAt(0).toUpperCase() + unitType.slice(1);
}

// Unit instance (an actual unit in the game)
export interface Unit {
  id: string;
  type: UnitType;
  ownerId: string;
  x: number;           // World position X
  y: number;           // World position Y
  health: number;
  maxHealth: number;
  
  // Track what age the unit was created in (for stats/appearance)
  createdAtAge?: Age;
  
  // State
  isSelected: boolean;
  isMoving: boolean;
  targetX?: number;
  targetY?: number;
  path?: { x: number; y: number }[];
  
  // Tasks
  task?: UnitTask;
  taskTarget?: { x: number; y: number } | string; // Position or building/unit ID
  idleSince?: number; // Tick when unit became idle (for auto-work assignment)
  
  // Combat
  attackCooldown: number;
  lastAttackTime: number;
  isAttacking: boolean; // True when unit is actively attacking (for animation)
  
  // Cargo (for transport units)
  carriedUnits?: string[];

  // Flee reaction (tick when enemy was first spotted)
  enemySpottedAt?: number;
}

export type UnitTask =
  | 'idle'
  | 'move'
  | 'gather_food'
  | 'gather_wood'
  | 'gather_metal'
  | 'gather_gold'
  | 'gather_oil'
  | 'gather_knowledge'
  | 'gather_fish'
  | 'build'
  | 'repair'
  | 'attack'
  | 'patrol'
  | 'garrison'
  | 'flee';
