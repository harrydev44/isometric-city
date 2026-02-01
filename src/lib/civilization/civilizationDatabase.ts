/**
 * Civilization Database Operations
 *
 * Handles persistence of shared AI Civilization state to Supabase.
 *
 * Required Supabase table schema (run in Supabase SQL editor):
 *
 * CREATE TABLE civilization_sessions (
 *   session_id TEXT PRIMARY KEY DEFAULT 'MAIN',
 *   current_turn INTEGER NOT NULL DEFAULT 0,
 *   turn_phase TEXT NOT NULL DEFAULT 'idle',
 *   leader_id TEXT,
 *   leader_heartbeat TIMESTAMP WITH TIME ZONE,
 *   state_compressed TEXT NOT NULL,
 *   updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 *   viewer_count INTEGER DEFAULT 0
 * );
 *
 * ALTER TABLE civilization_sessions ENABLE ROW LEVEL SECURITY;
 *
 * CREATE POLICY "Allow public access" ON civilization_sessions
 *   FOR ALL USING (true) WITH CHECK (true);
 *
 * -- Auto-update updated_at
 * CREATE OR REPLACE FUNCTION update_civilization_updated_at()
 * RETURNS TRIGGER AS $$
 * BEGIN
 *   NEW.updated_at = NOW();
 *   RETURN NEW;
 * END;
 * $$ LANGUAGE plpgsql;
 *
 * CREATE TRIGGER civilization_sessions_updated_at
 *   BEFORE UPDATE ON civilization_sessions
 *   FOR EACH ROW
 *   EXECUTE FUNCTION update_civilization_updated_at();
 */

import { createClient } from '@supabase/supabase-js';
import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from 'lz-string';
import { AgentCity, TurnPhase, CivilizationEvent, CharacterAward } from '@/types/civilization';
import { CivilizationStats, CharacterStats } from '@/lib/turnManager';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Lazy init: only create client when Supabase is configured
// Check for non-empty strings, not just truthy values
export const supabase =
  supabaseUrl && supabaseKey && supabaseUrl.length > 0 && supabaseKey.length > 0
    ? createClient(supabaseUrl, supabaseKey)
    : null;

if (!supabase) {
  console.log('[CivDB] Supabase not configured - civilization sync will use local mode');
}

// Session ID for the single shared simulation
export const SESSION_ID = 'MAIN';

// ============================================================================
// TYPES
// ============================================================================

export interface CivilizationSessionRow {
  session_id: string;
  current_turn: number;
  turn_phase: string;
  leader_id: string | null;
  leader_heartbeat: string | null;
  state_compressed: string;
  updated_at: string;
  viewer_count: number;
}

export interface CivilizationSessionState {
  agents: AgentCity[];
  currentTurn: number;
  turnPhase: TurnPhase;
  currentViewIndex: number; // Synced camera position
  events: CivilizationEvent[];
  awards: CharacterAward[];
  characterStats: CharacterStats[];
  stats: CivilizationStats;
}

// ============================================================================
// COMPRESSION
// ============================================================================

function compressState(state: CivilizationSessionState): string {
  return compressToEncodedURIComponent(JSON.stringify(state));
}

function decompressState(compressed: string): CivilizationSessionState | null {
  try {
    const decompressed = decompressFromEncodedURIComponent(compressed);
    if (!decompressed) return null;
    return JSON.parse(decompressed) as CivilizationSessionState;
  } catch {
    return null;
  }
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Load the civilization session from database
 * Returns null if no session exists or table doesn't exist (graceful fallback)
 */
export async function loadCivilizationSession(): Promise<{
  state: CivilizationSessionState;
  leaderId: string | null;
  leaderHeartbeat: Date | null;
} | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('civilization_sessions')
      .select('*')
      .eq('session_id', SESSION_ID)
      .single();

    if (error) {
      // Table might not exist or no session - this is fine, return null
      console.log('[CivDB] No existing session found:', error.message);
      return null;
    }

    if (!data) {
      return null;
    }

    const row = data as CivilizationSessionRow;
    const state = decompressState(row.state_compressed);

    if (!state) {
      console.error('[CivDB] Failed to decompress state');
      return null;
    }

    return {
      state,
      leaderId: row.leader_id,
      leaderHeartbeat: row.leader_heartbeat
        ? new Date(row.leader_heartbeat)
        : null,
    };
  } catch (e) {
    // Any error - return null to allow fresh start
    console.log('[CivDB] Error loading session (will start fresh):', e);
    return null;
  }
}

/**
 * Create or update the civilization session
 */
export async function saveCivilizationSession(
  state: CivilizationSessionState,
  leaderId: string | null = null
): Promise<boolean> {
  if (!supabase) return false;

  try {
    const compressed = compressState(state);

    const { error } = await supabase.from('civilization_sessions').upsert(
      {
        session_id: SESSION_ID,
        current_turn: state.currentTurn,
        turn_phase: state.turnPhase,
        leader_id: leaderId,
        leader_heartbeat: leaderId ? new Date().toISOString() : null,
        state_compressed: compressed,
      },
      { onConflict: 'session_id' }
    );

    if (error) {
      console.error('[CivDB] Failed to save session:', error);
      return false;
    }

    return true;
  } catch (e) {
    console.error('[CivDB] Error saving session:', e);
    return false;
  }
}

/**
 * Update leader heartbeat
 */
export async function updateLeaderHeartbeat(leaderId: string): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('civilization_sessions')
      .update({
        leader_id: leaderId,
        leader_heartbeat: new Date().toISOString(),
      })
      .eq('session_id', SESSION_ID);

    if (error) {
      console.error('[CivDB] Failed to update heartbeat:', error);
      return false;
    }

    return true;
  } catch (e) {
    console.error('[CivDB] Error updating heartbeat:', e);
    return false;
  }
}

/**
 * Claim leadership (only if no current leader or leader is stale)
 */
export async function claimLeadership(
  viewerId: string,
  leaderTimeoutMs: number
): Promise<boolean> {
  if (!supabase) return false;

  try {
    // First check if there's a current leader with valid heartbeat
    const { data: current } = await supabase
      .from('civilization_sessions')
      .select('leader_id, leader_heartbeat')
      .eq('session_id', SESSION_ID)
      .single();

    if (current) {
      const heartbeat = current.leader_heartbeat
        ? new Date(current.leader_heartbeat).getTime()
        : 0;
      const now = Date.now();
      const isLeaderAlive = now - heartbeat < leaderTimeoutMs;

      if (isLeaderAlive && current.leader_id !== viewerId) {
        // Another leader is alive
        return false;
      }
    }

    // Claim leadership
    const { error } = await supabase
      .from('civilization_sessions')
      .update({
        leader_id: viewerId,
        leader_heartbeat: new Date().toISOString(),
      })
      .eq('session_id', SESSION_ID);

    if (error) {
      console.error('[CivDB] Failed to claim leadership:', error);
      return false;
    }

    return true;
  } catch (e) {
    console.error('[CivDB] Error claiming leadership:', e);
    return false;
  }
}

/**
 * Update viewer count
 */
export async function updateViewerCount(count: number): Promise<void> {
  if (!supabase) return;

  try {
    await supabase
      .from('civilization_sessions')
      .update({ viewer_count: count })
      .eq('session_id', SESSION_ID);
  } catch (e) {
    console.error('[CivDB] Error updating viewer count:', e);
  }
}

/**
 * Clear leadership (when a leader disconnects gracefully)
 */
export async function clearLeadership(leaderId: string): Promise<void> {
  if (!supabase) return;

  try {
    await supabase
      .from('civilization_sessions')
      .update({
        leader_id: null,
        leader_heartbeat: null,
      })
      .eq('session_id', SESSION_ID)
      .eq('leader_id', leaderId); // Only clear if we're still the leader
  } catch (e) {
    console.error('[CivDB] Error clearing leadership:', e);
  }
}
