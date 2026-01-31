/**
 * Type definitions for 200 AI Agents Civilization Mode
 */

import { GameState } from '@/games/isocity/types/game';
import { BuildingType } from '@/games/isocity/types/buildings';
import { ZoneType } from '@/games/isocity/types/zones';

// ============================================================================
// CONSTANTS
// ============================================================================

export const CIVILIZATION_CONSTANTS = {
  AGENT_COUNT: 200,
  GRID_SIZE: 30,
  TURN_DURATION_MS: 30000, // 30 seconds per turn
  TICKS_PER_TURN: 5, // Simulation ticks per turn (slow growth)
  CAMERA_CYCLE_MS: 5000, // 5 seconds per city view
  AGENTS_PER_BATCH: 20, // Process 20 agents at a time
  BATCH_DELAY_MS: 50, // Yield between batches
  STARTING_MONEY: 10000,
  TOP_LEADERBOARD_COUNT: 20,
} as const;

// ============================================================================
// AGENT TYPES
// ============================================================================

export interface AgentPersonality {
  aggressiveness: number; // 0-1: expansion speed
  industrialFocus: number; // 0-1: industry vs commercial preference
  densityPreference: number; // 0-1: dense vs sprawl
  environmentFocus: number; // 0-1: parks and green spaces
}

export interface AgentPerformance {
  totalPopulation: number;
  totalMoney: number;
  peakPopulation: number;
  turnsAlive: number;
  buildingsPlaced: number;
}

export interface AgentCity {
  id: string;
  agentId: number; // 0-199
  name: string;
  state: GameState;
  personality: AgentPersonality;
  performance: AgentPerformance;
  rank: number;
}

// ============================================================================
// AI ACTION TYPES
// ============================================================================

export interface AIAction {
  type: 'place_building' | 'place_zone' | 'place_road';
  buildingType?: BuildingType;
  zoneType?: ZoneType;
  x: number;
  y: number;
  priority: number;
  cost: number;
  reason?: string;
}

export interface AIDecisionResult {
  actions: AIAction[];
  totalCost: number;
  remainingBudget: number;
}

// ============================================================================
// CIVILIZATION STATE
// ============================================================================

export type TurnPhase = 'thinking' | 'executing' | 'idle';

export interface CivilizationState {
  agents: AgentCity[];
  currentTurn: number;
  currentViewIndex: number;
  turnPhase: TurnPhase;
  turnStartTime: number;
  autoAdvance: boolean;
  autoCycleCamera: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const CITY_PREFIXES = [
  'New', 'Old', 'East', 'West', 'North', 'South', 'Upper', 'Lower', 'Greater', 'Little',
  'Port', 'Fort', 'Lake', 'River', 'Mount', 'Bay', 'Green', 'Crystal', 'Golden', 'Silver',
];

const CITY_NAMES = [
  'Haven', 'Vista', 'Ridge', 'Valley', 'Springs', 'Grove', 'Falls', 'Plains', 'Heights', 'Shores',
  'Meadow', 'Brook', 'Creek', 'Oaks', 'Pines', 'Hills', 'Fields', 'Point', 'Harbor', 'Gardens',
  'Wood', 'Dale', 'Glen', 'Cove', 'Bay', 'Crossing', 'Landing', 'Junction', 'Center', 'Town',
];

const CITY_SUFFIXES = [
  'ville', 'ton', 'burg', 'ford', 'dale', 'land', 'view', 'wood', 'field', 'bridge',
  '', '', '', '', '', // Empty suffixes for variety
];

/**
 * Generate a random city name
 */
export function generateCityName(index: number): string {
  // Use index for deterministic but varied names
  const seed = index * 17 + 31;

  const prefixIndex = (seed * 7) % CITY_PREFIXES.length;
  const nameIndex = (seed * 13) % CITY_NAMES.length;
  const suffixIndex = (seed * 23) % CITY_SUFFIXES.length;

  const usePrefix = (seed % 3) !== 0;
  const useSuffix = (seed % 4) !== 0;

  let name = CITY_NAMES[nameIndex];

  if (usePrefix) {
    name = `${CITY_PREFIXES[prefixIndex]} ${name}`;
  }

  if (useSuffix && CITY_SUFFIXES[suffixIndex]) {
    // If already has prefix, don't add suffix
    if (!usePrefix) {
      name = `${name}${CITY_SUFFIXES[suffixIndex]}`;
    }
  }

  return name;
}

/**
 * Generate a random personality for an agent
 */
export function generatePersonality(index: number): AgentPersonality {
  // Use index for deterministic but varied personalities
  const seed = index * 37 + 41;

  // Pseudo-random function based on seed
  const rand = (offset: number) => {
    const n = ((seed + offset) * 1103515245 + 12345) & 0x7fffffff;
    return (n / 0x7fffffff);
  };

  return {
    aggressiveness: 0.2 + rand(1) * 0.6, // 0.2-0.8
    industrialFocus: 0.2 + rand(2) * 0.6, // 0.2-0.8
    densityPreference: 0.3 + rand(3) * 0.5, // 0.3-0.8
    environmentFocus: 0.2 + rand(4) * 0.6, // 0.2-0.8
  };
}

/**
 * Generate initial performance stats
 */
export function generateInitialPerformance(): AgentPerformance {
  return {
    totalPopulation: 0,
    totalMoney: CIVILIZATION_CONSTANTS.STARTING_MONEY,
    peakPopulation: 0,
    turnsAlive: 0,
    buildingsPlaced: 0,
  };
}

/**
 * Generate a unique agent ID
 */
export function generateAgentId(index: number): string {
  return `agent-${index}-${Date.now().toString(36)}`;
}
