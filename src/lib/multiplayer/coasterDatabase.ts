// Supabase database functions for coaster multiplayer game state persistence
// Uses the same game_rooms table but with a different room_code prefix to distinguish from city games

import { createClient } from '@supabase/supabase-js';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { GameState as CoasterGameState } from '@/games/coaster/types/game';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Lazy init: only create client when Supabase is configured
const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

// Maximum park size limit for Supabase storage (20MB)
const MAX_PARK_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

// Prefix for coaster room codes to distinguish from city games
const COASTER_ROOM_PREFIX = 'C-';

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
 * Get the full room code with prefix
 */
export function getCoasterRoomCode(code: string): string {
  const upperCode = code.toUpperCase();
  return upperCode.startsWith(COASTER_ROOM_PREFIX) ? upperCode : `${COASTER_ROOM_PREFIX}${upperCode}`;
}

/**
 * Get the display code without prefix
 */
export function getDisplayCode(fullCode: string): string {
  const upperCode = fullCode.toUpperCase();
  return upperCode.startsWith(COASTER_ROOM_PREFIX) ? upperCode.slice(COASTER_ROOM_PREFIX.length) : upperCode;
}

export interface CoasterGameRoomRow {
  room_code: string;
  city_name: string; // Using city_name column for park_name for compatibility
  game_state: string; // Compressed
  created_at: string;
  updated_at: string;
  player_count: number;
}

/**
 * Compress game state for storage
 */
function compressState(state: CoasterGameState): string {
  return compressToEncodedURIComponent(JSON.stringify(state));
}

/**
 * Create a new coaster game room in the database
 * @throws ParkSizeLimitError if the park size exceeds the maximum allowed size
 */
export async function createCoasterGameRoom(
  roomCode: string,
  parkName: string,
  gameState: CoasterGameState
): Promise<boolean> {
  if (!supabase) return false;
  try {
    const compressed = compressState(gameState);
    
    // Check if park size exceeds limit before saving
    checkParkSize(compressed);
    
    const fullRoomCode = getCoasterRoomCode(roomCode);
    
    const { error } = await supabase
      .from('game_rooms')
      .insert({
        room_code: fullRoomCode,
        city_name: parkName, // Using city_name column for park_name
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
export async function loadCoasterGameRoom(
  roomCode: string
): Promise<{ gameState: CoasterGameState; parkName: string } | null> {
  if (!supabase) return null;
  try {
    const fullRoomCode = getCoasterRoomCode(roomCode);
    
    const { data, error } = await supabase
      .from('game_rooms')
      .select('game_state, city_name')
      .eq('room_code', fullRoomCode)
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

    const gameState = JSON.parse(decompressed) as CoasterGameState;
    return { gameState, parkName: data.city_name };
  } catch (e) {
    console.error('[CoasterDatabase] Error loading room:', e);
    return null;
  }
}

/**
 * Update game state in a coaster room
 * @throws ParkSizeLimitError if the park size exceeds the maximum allowed size
 */
export async function updateCoasterGameRoom(
  roomCode: string,
  gameState: CoasterGameState
): Promise<boolean> {
  if (!supabase) return false;
  try {
    const compressed = compressState(gameState);
    
    // Check if park size exceeds limit before saving
    checkParkSize(compressed);
    
    const fullRoomCode = getCoasterRoomCode(roomCode);
    
    const { error } = await supabase
      .from('game_rooms')
      .update({ game_state: compressed })
      .eq('room_code', fullRoomCode);

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
    const fullRoomCode = getCoasterRoomCode(roomCode);
    
    const { data, error } = await supabase
      .from('game_rooms')
      .select('room_code')
      .eq('room_code', fullRoomCode)
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
    const fullRoomCode = getCoasterRoomCode(roomCode);
    
    await supabase
      .from('game_rooms')
      .update({ player_count: count })
      .eq('room_code', fullRoomCode);
  } catch (e) {
    console.error('[CoasterDatabase] Error updating player count:', e);
  }
}
