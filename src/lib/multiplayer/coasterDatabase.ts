// Supabase database functions for IsoCoaster multiplayer game state persistence
// 
// Uses the same game_rooms table as IsoCity but with room codes prefixed with "P"
// to differentiate park rooms from city rooms

import { createClient } from '@supabase/supabase-js';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { GameState } from '@/games/coaster/types';
import { serializeAndCompressForDBAsync } from '@/lib/saveWorkerManager';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Lazy init: only create client when Supabase is configured
const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

// Maximum park size limit for Supabase storage (20MB)
const MAX_PARK_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

// Room code prefix for coaster parks to differentiate from cities
const COASTER_ROOM_PREFIX = 'P';

export class ParkSizeLimitError extends Error {
  public readonly sizeBytes: number;
  public readonly limitBytes: number;
  
  constructor(sizeBytes: number, limitBytes: number = MAX_PARK_SIZE_BYTES) {
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
    const limitMB = (limitBytes / (1024 * 1024)).toFixed(0);
    super(`Park size (${sizeMB}MB) exceeds maximum allowed size (${limitMB}MB)`);
    this.name = 'ParkSizeLimitError';
    this.sizeBytes = sizeBytes;
    this.limitBytes = limitBytes;
  }
}

/**
 * Check if compressed data exceeds the size limit
 * @throws ParkSizeLimitError if size exceeds limit
 */
function checkParkSize(compressed: string): void {
  const sizeBytes = compressed.length;
  if (sizeBytes > MAX_PARK_SIZE_BYTES) {
    throw new ParkSizeLimitError(sizeBytes);
  }
}

/**
 * Generate a room code for coaster parks (prefixed with P)
 */
export function generateCoasterRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = COASTER_ROOM_PREFIX;
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export interface CoasterRoomRow {
  room_code: string;
  city_name: string; // Used as park_name for coaster
  game_state: string; // Compressed
  created_at: string;
  updated_at: string;
  player_count: number;
}

/**
 * Create a new game room in the database for a coaster park
 * PERF: Uses Web Worker for serialization + compression
 * @throws ParkSizeLimitError if the park size exceeds the maximum allowed size
 */
export async function createCoasterRoom(
  roomCode: string,
  parkName: string,
  gameState: GameState
): Promise<boolean> {
  if (!supabase) return false;
  try {
    const compressed = await serializeAndCompressForDBAsync(gameState);
    
    checkParkSize(compressed);
    
    const { error } = await supabase
      .from('game_rooms')
      .insert({
        room_code: roomCode.toUpperCase(),
        city_name: parkName, // Reusing city_name column for park_name
        game_state: compressed,
        player_count: 1,
      });

    if (error) {
      console.error('[CoasterDatabase] Failed to create room:', error);
      return false;
    }

    return true;
  } catch (e) {
    if (e instanceof ParkSizeLimitError) {
      throw e;
    }
    console.error('[CoasterDatabase] Error creating room:', e);
    return false;
  }
}

/**
 * Load game state from a coaster room
 */
export async function loadCoasterRoom(
  roomCode: string
): Promise<{ gameState: GameState; parkName: string } | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('game_rooms')
      .select('game_state, city_name')
      .eq('room_code', roomCode.toUpperCase())
      .single();

    if (error || !data) {
      console.error('[CoasterDatabase] Failed to load room:', error);
      return null;
    }

    const decompressed = decompressFromEncodedURIComponent(data.game_state);
    if (!decompressed) {
      console.error('[CoasterDatabase] Failed to decompress state');
      return null;
    }

    const gameState = JSON.parse(decompressed) as GameState;
    return { gameState, parkName: data.city_name };
  } catch (e) {
    console.error('[CoasterDatabase] Error loading room:', e);
    return null;
  }
}

/**
 * Update game state in a coaster room
 * PERF: Uses Web Worker for serialization + compression
 * @throws ParkSizeLimitError if the park size exceeds the maximum allowed size
 */
export async function updateCoasterRoom(
  roomCode: string,
  gameState: GameState
): Promise<boolean> {
  if (!supabase) return false;
  try {
    const compressed = await serializeAndCompressForDBAsync(gameState);
    
    checkParkSize(compressed);
    
    const { error } = await supabase
      .from('game_rooms')
      .update({ game_state: compressed })
      .eq('room_code', roomCode.toUpperCase());

    if (error) {
      console.error('[CoasterDatabase] Failed to update room:', error);
      return false;
    }

    return true;
  } catch (e) {
    if (e instanceof ParkSizeLimitError) {
      throw e;
    }
    console.error('[CoasterDatabase] Error updating room:', e);
    return false;
  }
}

/**
 * Check if a coaster room exists
 */
export async function coasterRoomExists(roomCode: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase
      .from('game_rooms')
      .select('room_code')
      .eq('room_code', roomCode.toUpperCase())
      .single();

    return !error && !!data;
  } catch {
    return false;
  }
}

/**
 * Update player count for a coaster room
 */
export async function updateCoasterPlayerCount(
  roomCode: string,
  count: number
): Promise<void> {
  if (!supabase) return;
  try {
    await supabase
      .from('game_rooms')
      .update({ player_count: count })
      .eq('room_code', roomCode.toUpperCase());
  } catch (e) {
    console.error('[CoasterDatabase] Error updating player count:', e);
  }
}
