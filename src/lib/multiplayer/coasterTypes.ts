// Multiplayer types for IsoCoaster co-op gameplay

import { Tool, GameState, ParkSettings, CoasterType, TrackDirection } from '@/games/coaster/types';

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
  | (BaseAction & { type: 'setSpeed'; speed: 0 | 1 | 2 | 3 })
  | (BaseAction & { type: 'setParkSettings'; settings: Partial<ParkSettings> })
  | (BaseAction & { type: 'startCoasterBuild'; coasterType: CoasterType })
  | (BaseAction & { type: 'addCoasterTrack'; x: number; y: number })
  | (BaseAction & { type: 'finishCoasterBuild' })
  | (BaseAction & { type: 'cancelCoasterBuild' })
  | (BaseAction & { type: 'placeTrackLine'; tiles: Array<{ x: number; y: number }> })
  | (BaseAction & { type: 'fullState'; state: GameState })
  | (BaseAction & { type: 'tick'; tickData: CoasterTickData });

// Action input types (without timestamp and playerId, which are added automatically)
export type PlaceAction = { type: 'place'; x: number; y: number; tool: Tool };
export type PlaceBatchAction = { type: 'placeBatch'; placements: Array<{ x: number; y: number; tool: Tool }> };
export type BulldozeAction = { type: 'bulldoze'; x: number; y: number };
export type SetSpeedAction = { type: 'setSpeed'; speed: 0 | 1 | 2 | 3 };
export type SetParkSettingsAction = { type: 'setParkSettings'; settings: Partial<ParkSettings> };
export type StartCoasterBuildAction = { type: 'startCoasterBuild'; coasterType: CoasterType };
export type AddCoasterTrackAction = { type: 'addCoasterTrack'; x: number; y: number };
export type FinishCoasterBuildAction = { type: 'finishCoasterBuild' };
export type CancelCoasterBuildAction = { type: 'cancelCoasterBuild' };
export type PlaceTrackLineAction = { type: 'placeTrackLine'; tiles: Array<{ x: number; y: number }> };
export type FullStateAction = { type: 'fullState'; state: GameState };
export type TickAction = { type: 'tick'; tickData: CoasterTickData };

export type CoasterGameActionInput = 
  | PlaceAction
  | PlaceBatchAction
  | BulldozeAction
  | SetSpeedAction
  | SetParkSettingsAction
  | StartCoasterBuildAction
  | AddCoasterTrackAction
  | FinishCoasterBuildAction
  | CancelCoasterBuildAction
  | PlaceTrackLineAction
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
  stats: GameState['stats'];
  finances: GameState['finances'];
}

// Re-export common types from the city multiplayer
export type {
  ConnectionState,
  Player,
  RoomData,
  AwarenessState,
} from './types';

export {
  generatePlayerName,
  generatePlayerColor,
  generateRoomCode,
  generatePlayerId,
} from './types';
