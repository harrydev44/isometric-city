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
  TURN_DURATION_MS: 10000, // 10 seconds per turn - fast paced!
  TICKS_PER_TURN: 5, // Simulation ticks per turn (slow growth)
  CAMERA_CYCLE_MS: 2000, // 2 seconds per city view
  AGENTS_PER_BATCH: 20, // Process 20 agents at a time
  BATCH_DELAY_MS: 50, // Yield between batches
  STARTING_MONEY: 10000,
  TOP_LEADERBOARD_COUNT: 20,
  // Speed multipliers for turn duration
  SPEED_OPTIONS: [1, 2, 4] as const,
} as const;

// ============================================================================
// EVENT SYSTEM
// ============================================================================

export type CivilizationEventType =
  | 'population_milestone'
  | 'rank_change'
  | 'building_milestone'
  | 'character_achievement'
  | 'new_leader';

export interface CivilizationEvent {
  id: string;
  type: CivilizationEventType;
  message: string;
  emoji: string;
  agentId: number;
  cityName: string;
  timestamp: number;
  turn: number;
}

// ============================================================================
// CHARACTER AWARDS
// ============================================================================

export interface CharacterAward {
  id: string;
  name: string;
  emoji: string;
  description: string;
  winnerId: number | null;
  winnerName: string;
  value: number;
}

export type AwardCategory =
  | 'greenest'      // Most parks (Environmentalist goal)
  | 'industrial'    // Most industrial buildings (Industrialist goal)
  | 'richest'       // Most money (Capitalist goal)
  | 'largest'       // Most road tiles (Expansionist goal)
  | 'balanced'      // Best happiness (Planner goal)
  | 'populous';     // Highest population (Universal)

// ============================================================================
// AGENT CHARACTER TYPES
// ============================================================================

export type AgentCharacter =
  | 'industrialist'   // Factories first, ignores pollution
  | 'environmentalist' // Parks, green spaces, low density
  | 'capitalist'      // Commercial focus, maximizes income
  | 'expansionist'    // Always building roads outward
  | 'planner'         // Balanced, waits for demand
  | 'gambler';        // Random risky decisions

export const CHARACTER_INFO: Record<AgentCharacter, { name: string; emoji: string; description: string }> = {
  industrialist: { name: 'Industrialist', emoji: '🏭', description: 'Factories first, growth at any cost' },
  environmentalist: { name: 'Environmentalist', emoji: '🌲', description: 'Parks and green spaces priority' },
  capitalist: { name: 'Capitalist', emoji: '💰', description: 'Commercial focus, maximizes income' },
  expansionist: { name: 'Expansionist', emoji: '🛣️', description: 'Always building roads outward' },
  planner: { name: 'Planner', emoji: '📋', description: 'Balanced growth, follows demand' },
  gambler: { name: 'Gambler', emoji: '🎲', description: 'Takes risks, unpredictable choices' },
};

export interface AgentPersonality {
  character: AgentCharacter;
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

export interface AgentDecision {
  action: string;        // What was done: "Built road", "Zoned residential", etc.
  reason: string;        // Why: "expanding city", "high demand", etc.
  success: boolean;      // Did it work?
}

export interface AgentCity {
  id: string;
  agentId: number; // 0-199
  name: string;
  state: GameState;
  personality: AgentPersonality;
  performance: AgentPerformance;
  rank: number;
  lastDecision: AgentDecision | null;

  // Real agent info (if this is a registered bot, not simulated)
  isRealAgent?: boolean;
  moltbookId?: string;      // Moltbook user ID for verification link
  twitterHandle?: string;
  framework?: string;        // 'moltbook', 'eliza', 'custom', etc.
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

  // Assign character type based on index distribution
  const characters: AgentCharacter[] = [
    'industrialist',
    'environmentalist',
    'capitalist',
    'expansionist',
    'planner',
    'gambler',
  ];
  const characterIndex = Math.floor(rand(0) * characters.length);
  const character = characters[characterIndex];

  // Set personality values based on character type
  let aggressiveness = 0.5;
  let industrialFocus = 0.5;
  let densityPreference = 0.5;
  let environmentFocus = 0.5;

  switch (character) {
    case 'industrialist':
      industrialFocus = 0.8 + rand(1) * 0.2;
      aggressiveness = 0.6 + rand(2) * 0.3;
      environmentFocus = 0.1 + rand(3) * 0.2;
      break;
    case 'environmentalist':
      environmentFocus = 0.8 + rand(1) * 0.2;
      industrialFocus = 0.1 + rand(2) * 0.2;
      densityPreference = 0.2 + rand(3) * 0.3;
      break;
    case 'capitalist':
      industrialFocus = 0.3 + rand(1) * 0.2; // Prefers commercial
      aggressiveness = 0.5 + rand(2) * 0.3;
      densityPreference = 0.6 + rand(3) * 0.3;
      break;
    case 'expansionist':
      aggressiveness = 0.8 + rand(1) * 0.2;
      densityPreference = 0.2 + rand(2) * 0.3;
      break;
    case 'planner':
      aggressiveness = 0.3 + rand(1) * 0.3;
      densityPreference = 0.4 + rand(2) * 0.3;
      environmentFocus = 0.4 + rand(3) * 0.3;
      break;
    case 'gambler':
      aggressiveness = rand(1);
      industrialFocus = rand(2);
      densityPreference = rand(3);
      environmentFocus = rand(4);
      break;
  }

  return {
    character,
    aggressiveness,
    industrialFocus,
    densityPreference,
    environmentFocus,
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
