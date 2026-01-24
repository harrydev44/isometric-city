// Multiplayer types for IsoCoaster co-op gameplay

import { Tool, GameState, ParkSettings, CoasterType } from '@/games/coaster/types';

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
  | (BaseAction & { type: 'startCoasterBuild'; coasterId: string; coasterType: CoasterType })
  | (BaseAction & { type: 'finishCoasterBuild' })
  | (BaseAction & { type: 'cancelCoasterBuild' })
  | (BaseAction & { type: 'fullState'; state: GameState });

// Action input types (without timestamp and playerId, which are added automatically)
export type CoasterPlaceAction = { type: 'place'; x: number; y: number; tool: Tool };
export type CoasterPlaceBatchAction = { type: 'placeBatch'; placements: Array<{ x: number; y: number; tool: Tool }> };
export type CoasterBulldozeAction = { type: 'bulldoze'; x: number; y: number };
export type CoasterSetSpeedAction = { type: 'setSpeed'; speed: 0 | 1 | 2 | 3 };
export type CoasterSetParkSettingsAction = { type: 'setParkSettings'; settings: Partial<ParkSettings> };
export type CoasterStartCoasterBuildAction = { type: 'startCoasterBuild'; coasterId: string; coasterType: CoasterType };
export type CoasterFinishCoasterBuildAction = { type: 'finishCoasterBuild' };
export type CoasterCancelCoasterBuildAction = { type: 'cancelCoasterBuild' };
export type CoasterFullStateAction = { type: 'fullState'; state: GameState };

export type CoasterGameActionInput =
  | CoasterPlaceAction
  | CoasterPlaceBatchAction
  | CoasterBulldozeAction
  | CoasterSetSpeedAction
  | CoasterSetParkSettingsAction
  | CoasterStartCoasterBuildAction
  | CoasterFinishCoasterBuildAction
  | CoasterCancelCoasterBuildAction
  | CoasterFullStateAction;

// Connection states
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

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
  selectedTool?: Tool;
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
