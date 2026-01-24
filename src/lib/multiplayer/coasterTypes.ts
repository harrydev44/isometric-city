// Multiplayer types for co-op gameplay in IsoCoaster

import { Tool } from '@/games/coaster/types';
import { GameState as CoasterGameState } from '@/games/coaster/types/game';
import { ParkSettings } from '@/games/coaster/types/economy';

// Base action properties
interface BaseAction {
  timestamp: number;
  playerId: string;
}

// Game actions that get synced via Supabase Realtime
export type CoasterGameAction =
  | (BaseAction & { type: 'place'; x: number; y: number; tool: Tool })
  | (BaseAction & { type: 'placeBatch'; placements: Array<{ x: number; y: number; tool: Tool }> })
  | (BaseAction & { type: 'bulldoze'; x: number; y: number })
  | (BaseAction & { type: 'placeTrackLine'; tiles: Array<{ x: number; y: number }> })
  | (BaseAction & { type: 'setSpeed'; speed: 0 | 1 | 2 | 3 })
  | (BaseAction & { type: 'setParkSettings'; settings: Partial<ParkSettings> })
  | (BaseAction & { type: 'startCoasterBuild'; coasterType: string })
  | (BaseAction & { type: 'finishCoasterBuild' })
  | (BaseAction & { type: 'cancelCoasterBuild' })
  | (BaseAction & { type: 'fullState'; state: CoasterGameState })
  | (BaseAction & { type: 'tick'; tickData: CoasterTickData });

// Action input types (without timestamp and playerId, which are added automatically)
export type PlaceAction = { type: 'place'; x: number; y: number; tool: Tool };
export type PlaceBatchAction = { type: 'placeBatch'; placements: Array<{ x: number; y: number; tool: Tool }> };
export type BulldozeAction = { type: 'bulldoze'; x: number; y: number };
export type PlaceTrackLineAction = { type: 'placeTrackLine'; tiles: Array<{ x: number; y: number }> };
export type SetSpeedAction = { type: 'setSpeed'; speed: 0 | 1 | 2 | 3 };
export type SetParkSettingsAction = { type: 'setParkSettings'; settings: Partial<ParkSettings> };
export type StartCoasterBuildAction = { type: 'startCoasterBuild'; coasterType: string };
export type FinishCoasterBuildAction = { type: 'finishCoasterBuild' };
export type CancelCoasterBuildAction = { type: 'cancelCoasterBuild' };
export type FullStateAction = { type: 'fullState'; state: CoasterGameState };
export type TickAction = { type: 'tick'; tickData: CoasterTickData };

export type CoasterGameActionInput = 
  | PlaceAction
  | PlaceBatchAction
  | BulldozeAction
  | PlaceTrackLineAction
  | SetSpeedAction
  | SetParkSettingsAction
  | StartCoasterBuildAction
  | FinishCoasterBuildAction
  | CancelCoasterBuildAction
  | FullStateAction
  | TickAction;

// Minimal tick data sent from host to guests
export interface CoasterTickData {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  tick: number;
  finances: CoasterGameState['finances'];
  stats: CoasterGameState['stats'];
}

// Re-export common types from the main multiplayer types
export { 
  generatePlayerName, 
  generatePlayerColor, 
  generateRoomCode, 
  generatePlayerId 
} from './types';

export type { 
  ConnectionState, 
  PlayerRole, 
  Player, 
  RoomData, 
  AwarenessState 
} from './types';
