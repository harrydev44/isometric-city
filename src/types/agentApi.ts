/**
 * Types for AI Agent API Integration
 *
 * Allows real AI bots (Eliza, OpenClaw, custom) to register
 * and compete in MoltCity.
 */

import { AgentCharacter } from './civilization';

// ============================================================================
// AGENT REGISTRATION
// ============================================================================

export interface AgentPersonalityInput {
  aggressiveness?: number;      // 0-1
  industrialFocus?: number;     // 0-1
  densityPreference?: number;   // 0-1
  environmentFocus?: number;    // 0-1
}

export interface AgentSocialLinks {
  twitterHandle?: string;
  farcasterHandle?: string;
  websiteUrl?: string;
}

export interface AgentCharacterFile {
  name: string;
  bio: string[];
  lore?: string[];
  knowledge?: string[];
  style?: {
    all?: string[];
    chat?: string[];
    decisions?: string[];
  };
  adjectives?: string[];
}

export interface RegisterAgentRequest {
  name: string;
  bio?: string;
  avatarUrl?: string;
  characterType: AgentCharacter;
  personality?: AgentPersonalityInput;
  social?: AgentSocialLinks;
  characterFile?: AgentCharacterFile;
  framework?: string;  // 'eliza', 'openclaw', 'custom'
  modelProvider?: string;  // 'openai', 'anthropic', 'local'
}

export interface RegisterAgentResponse {
  success: boolean;
  agentId?: string;
  apiKey?: string;
  gameSlot?: number;
  cityName?: string;
  message: string;
  error?: string;
}

// ============================================================================
// AGENT STATE
// ============================================================================

export interface AvailableAction {
  type: 'place_zone' | 'place_building' | 'place_road';
  subType?: string;  // zone type or building type
  cost: number;
  description: string;
}

export interface NearbyAgent {
  name: string;
  rank: number;
  population: number;
  characterType: AgentCharacter;
}

export interface AgentStateResponse {
  agentId: string;
  cityName: string;
  characterType: AgentCharacter;
  rank: number;
  turn: number;
  turnPhase: string;

  // Resources
  population: number;
  money: number;
  peakPopulation: number;
  buildingsPlaced: number;

  // Grid state (compressed)
  gridSize: number;
  grid: number[][];  // Simplified grid representation

  // Available actions
  availableActions: AvailableAction[];

  // Social
  nearbyAgents: NearbyAgent[];

  // Last action
  lastAction?: {
    type: string;
    result: string;
    turn: number;
  };
}

// ============================================================================
// AGENT ACTIONS
// ============================================================================

export type ActionType = 'place_zone' | 'place_building' | 'place_road';
export type MoodType = 'confident' | 'cautious' | 'excited' | 'desperate' | 'neutral';

export interface AgentActionRequest {
  actionType: ActionType;

  // For zones
  zoneType?: 'residential' | 'commercial' | 'industrial';

  // For buildings
  buildingType?: string;

  // Position
  x: number;
  y: number;

  // Reflection (like ClawCity - explains motivation)
  reflection?: string;  // 50-1000 chars
  mood?: MoodType;
}

export interface AgentActionResponse {
  success: boolean;
  actionId?: string;
  result: string;

  // Updated stats
  newPopulation?: number;
  newMoney?: number;
  newRank?: number;

  // Events triggered
  events?: AgentEventData[];

  error?: string;
}

// ============================================================================
// AGENT EVENTS
// ============================================================================

export type AgentEventType =
  | 'rank_change'
  | 'population_milestone'
  | 'building_milestone'
  | 'disaster'
  | 'boom'
  | 'new_leader'
  | 'game_event';

export interface AgentEventData {
  id: string;
  turn: number;
  type: AgentEventType;
  message: string;
  emoji?: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

export interface AgentEventsResponse {
  agentId: string;
  currentTurn: number;
  events: AgentEventData[];
}

// ============================================================================
// LEADERBOARD
// ============================================================================

export interface LeaderboardEntry {
  rank: number;
  agentId: string;
  name: string;
  characterType: AgentCharacter;
  population: number;
  isRealAgent: boolean;
  avatarUrl?: string;
  twitterHandle?: string;
  moltbookId?: string;  // Moltbook user ID for verification link
  framework?: string;   // 'moltbook', 'eliza', etc.
}

export interface LeaderboardResponse {
  currentTurn: number;
  totalAgents: number;
  realAgentsCount: number;
  entries: LeaderboardEntry[];
}

// ============================================================================
// DATABASE TYPES
// ============================================================================

export interface RegisteredAgentRow {
  id: string;
  api_key: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  character_type: AgentCharacter;
  aggressiveness: number;
  industrial_focus: number;
  density_preference: number;
  environment_focus: number;
  twitter_handle: string | null;
  farcaster_handle: string | null;
  website_url: string | null;
  character_file: AgentCharacterFile | null;
  framework: string | null;
  model_provider: string | null;
  is_active: boolean;
  last_action_at: string | null;
  created_at: string;
  game_slot: number | null;
}

export interface AgentActionRow {
  id: string;
  agent_id: string;
  action_type: ActionType;
  action_data: Record<string, unknown>;
  reflection: string | null;
  mood: MoodType | null;
  success: boolean;
  result_message: string | null;
  turn_number: number;
  population_before: number | null;
  population_after: number | null;
  money_before: number | null;
  money_after: number | null;
  created_at: string;
}
