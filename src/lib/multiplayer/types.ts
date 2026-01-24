// Multiplayer types for co-op gameplay

import { Tool as CityTool, GameState as CityGameState, Budget } from '@/types/game';
import { Tool as CoasterTool, GameState as CoasterGameState } from '@/games/coaster/types';
import { ParkSettings } from '@/games/coaster/types/economy';
import { BuildingType } from '@/games/coaster/types/buildings';

// Base action properties
interface BaseAction {
  timestamp: number;
  playerId: string;
}

export type MultiplayerGameState = CityGameState | CoasterGameState;
export type MultiplayerTool = CityTool | CoasterTool;

// Game actions that get synced via Supabase Realtime
export type GameAction =
  | (BaseAction & { type: 'place'; x: number; y: number; tool: CityTool })
  | (BaseAction & { type: 'placeBatch'; placements: Array<{ x: number; y: number; tool: CityTool }> })
  | (BaseAction & { type: 'bulldoze'; x: number; y: number })
  | (BaseAction & { type: 'setTaxRate'; rate: number })
  | (BaseAction & { type: 'setBudget'; key: keyof Budget; funding: number })
  | (BaseAction & { type: 'setSpeed'; speed: 0 | 1 | 2 | 3 })
  | (BaseAction & { type: 'setDisasters'; enabled: boolean })
  | (BaseAction & { type: 'createBridges'; pathTiles: Array<{ x: number; y: number }>; trackType: 'road' | 'rail' })
  | (BaseAction & { type: 'fullState'; state: MultiplayerGameState })
  | (BaseAction & { type: 'tick'; tickData: TickData })
  | (BaseAction & { type: 'coasterPlace'; x: number; y: number; tool: CoasterTool; coasterId?: string; buildingType?: BuildingType })
  | (BaseAction & { type: 'coasterPlaceBatch'; placements: Array<{ x: number; y: number; tool: CoasterTool; coasterId?: string; buildingType?: BuildingType }> })
  | (BaseAction & { type: 'coasterBulldoze'; x: number; y: number })
  | (BaseAction & { type: 'coasterBuildStart'; coasterType: string; coasterId: string })
  | (BaseAction & { type: 'coasterBuildFinish' })
  | (BaseAction & { type: 'coasterBuildCancel' })
  | (BaseAction & { type: 'coasterSetSpeed'; speed: 0 | 1 | 2 | 3 })
  | (BaseAction & { type: 'coasterSetParkSettings'; settings: Partial<ParkSettings> })
  | (BaseAction & { type: 'coasterAddMoney'; amount: number })
  | (BaseAction & { type: 'coasterClearGuests' });

// Action input types (without timestamp and playerId, which are added automatically)
export type PlaceAction = { type: 'place'; x: number; y: number; tool: CityTool };
export type PlaceBatchAction = { type: 'placeBatch'; placements: Array<{ x: number; y: number; tool: CityTool }> };
export type BulldozeAction = { type: 'bulldoze'; x: number; y: number };
export type SetTaxRateAction = { type: 'setTaxRate'; rate: number };
export type SetBudgetAction = { type: 'setBudget'; key: keyof Budget; funding: number };
export type SetSpeedAction = { type: 'setSpeed'; speed: 0 | 1 | 2 | 3 };
export type SetDisastersAction = { type: 'setDisasters'; enabled: boolean };
export type CreateBridgesAction = { type: 'createBridges'; pathTiles: Array<{ x: number; y: number }>; trackType: 'road' | 'rail' };
export type FullStateAction = { type: 'fullState'; state: MultiplayerGameState };
export type TickAction = { type: 'tick'; tickData: TickData };

export type CoasterPlaceAction = { type: 'coasterPlace'; x: number; y: number; tool: CoasterTool; coasterId?: string; buildingType?: BuildingType };
export type CoasterPlaceBatchAction = { type: 'coasterPlaceBatch'; placements: Array<{ x: number; y: number; tool: CoasterTool; coasterId?: string; buildingType?: BuildingType }> };
export type CoasterBulldozeAction = { type: 'coasterBulldoze'; x: number; y: number };
export type CoasterBuildStartAction = { type: 'coasterBuildStart'; coasterType: string; coasterId: string };
export type CoasterBuildFinishAction = { type: 'coasterBuildFinish' };
export type CoasterBuildCancelAction = { type: 'coasterBuildCancel' };
export type CoasterSetSpeedAction = { type: 'coasterSetSpeed'; speed: 0 | 1 | 2 | 3 };
export type CoasterSetParkSettingsAction = { type: 'coasterSetParkSettings'; settings: Partial<ParkSettings> };
export type CoasterAddMoneyAction = { type: 'coasterAddMoney'; amount: number };
export type CoasterClearGuestsAction = { type: 'coasterClearGuests' };

export type GameActionInput = 
  | PlaceAction
  | PlaceBatchAction
  | BulldozeAction
  | SetTaxRateAction
  | SetBudgetAction
  | SetSpeedAction
  | SetDisastersAction
  | CreateBridgesAction
  | FullStateAction
  | TickAction
  | CoasterPlaceAction
  | CoasterPlaceBatchAction
  | CoasterBulldozeAction
  | CoasterBuildStartAction
  | CoasterBuildFinishAction
  | CoasterBuildCancelAction
  | CoasterSetSpeedAction
  | CoasterSetParkSettingsAction
  | CoasterAddMoneyAction
  | CoasterClearGuestsAction;

// Minimal tick data sent from host to guests
export interface TickData {
  year: number;
  month: number;
  day: number;
  hour: number;
  tick: number;
  stats: CityGameState['stats'];
  // Only send changed tiles to minimize bandwidth
  changedTiles?: Array<{
    x: number;
    y: number;
    tile: CityGameState['grid'][0][0];
  }>;
}

// Connection states
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

// Player roles
export type PlayerRole = 'host' | 'guest' | 'solo';

// Connected player info
export interface Player {
  id: string;
  name: string;
  color: string;
  joinedAt: number;
  isHost: boolean;
}

// Room metadata stored in KV
export interface RoomData {
  code: string;
  hostId: string;
  cityName: string;
  createdAt: number;
  playerCount: number;
}

// Awareness state for each player (used in Supabase Presence)
export interface AwarenessState {
  player: Player;
  cursor?: { x: number; y: number };
  selectedTool?: MultiplayerTool;
}

// Word lists for random name generation
const ADJECTIVES = [
  'Red', 'Blue', 'Green', 'Golden', 'Silver', 'Purple', 'Orange', 'Pink',
  'Swift', 'Brave', 'Clever', 'Happy', 'Lucky', 'Cosmic', 'Mighty', 'Gentle',
  'Wild', 'Calm', 'Bold', 'Bright', 'Fluffy', 'Speedy', 'Tiny', 'Giant',
];

const ANIMALS = [
  'Panda', 'Fox', 'Wolf', 'Bear', 'Eagle', 'Owl', 'Tiger', 'Lion',
  'Falcon', 'Dolphin', 'Otter', 'Koala', 'Penguin', 'Rabbit', 'Deer', 'Hawk',
  'Lynx', 'Raven', 'Cobra', 'Crane', 'Shark', 'Whale', 'Badger', 'Moose',
];

// Generate a random player name (e.g., "SwiftPanda", "BlueFox")
export function generatePlayerName(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adjective}${animal}`;
}

// Generate a random player color
export function generatePlayerColor(): string {
  const colors = [
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#14b8a6', // teal
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#ec4899', // pink
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Generate a random 5-character room code
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars like 0/O, 1/I
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Generate a player ID
export function generatePlayerId(): string {
  return `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
