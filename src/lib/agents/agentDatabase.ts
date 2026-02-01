/**
 * Agent Database Operations
 *
 * Handles persistence of registered AI agents to Supabase.
 *
 * Required Supabase table schema (run in Supabase SQL editor):
 *
 * -- Registered AI agents
 * CREATE TABLE registered_agents (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   api_key TEXT UNIQUE NOT NULL,
 *   name TEXT NOT NULL,
 *   bio TEXT,
 *   avatar_url TEXT,
 *   character_type TEXT NOT NULL CHECK (character_type IN (
 *     'industrialist', 'environmentalist', 'capitalist',
 *     'expansionist', 'planner', 'gambler'
 *   )),
 *   aggressiveness DECIMAL(3,2) DEFAULT 0.5,
 *   industrial_focus DECIMAL(3,2) DEFAULT 0.5,
 *   density_preference DECIMAL(3,2) DEFAULT 0.5,
 *   environment_focus DECIMAL(3,2) DEFAULT 0.5,
 *   twitter_handle TEXT,
 *   farcaster_handle TEXT,
 *   website_url TEXT,
 *   character_file JSONB,
 *   framework TEXT,
 *   model_provider TEXT,
 *   is_active BOOLEAN DEFAULT true,
 *   last_action_at TIMESTAMP WITH TIME ZONE,
 *   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 *   game_slot INTEGER UNIQUE CHECK (game_slot >= 0 AND game_slot < 200)
 * );
 *
 * CREATE INDEX idx_agents_api_key ON registered_agents(api_key);
 * CREATE INDEX idx_agents_active ON registered_agents(is_active, last_action_at);
 * CREATE INDEX idx_agents_slot ON registered_agents(game_slot) WHERE game_slot IS NOT NULL;
 *
 * ALTER TABLE registered_agents ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Allow public read" ON registered_agents FOR SELECT USING (true);
 * CREATE POLICY "Allow insert with valid data" ON registered_agents FOR INSERT WITH CHECK (true);
 * CREATE POLICY "Allow update own" ON registered_agents FOR UPDATE USING (true);
 *
 * -- Agent action log
 * CREATE TABLE agent_actions (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   agent_id UUID REFERENCES registered_agents(id) ON DELETE CASCADE,
 *   action_type TEXT NOT NULL,
 *   action_data JSONB NOT NULL,
 *   reflection TEXT,
 *   mood TEXT,
 *   success BOOLEAN DEFAULT false,
 *   result_message TEXT,
 *   turn_number INTEGER NOT NULL,
 *   population_before INTEGER,
 *   population_after INTEGER,
 *   money_before INTEGER,
 *   money_after INTEGER,
 *   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
 * );
 *
 * CREATE INDEX idx_actions_agent ON agent_actions(agent_id, created_at DESC);
 * CREATE INDEX idx_actions_turn ON agent_actions(turn_number);
 *
 * ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Allow all" ON agent_actions FOR ALL USING (true) WITH CHECK (true);
 */

import { supabase } from '@/lib/civilization/civilizationDatabase';
import {
  RegisterAgentRequest,
  RegisteredAgentRow,
  AgentActionRow,
  AgentActionRequest,
  ActionType,
} from '@/types/agentApi';
import { AgentCharacter } from '@/types/civilization';
import { randomBytes } from 'crypto';

// ============================================================================
// API KEY GENERATION
// ============================================================================

export function generateApiKey(): string {
  const bytes = randomBytes(32);
  return `moltcity_sk_${bytes.toString('hex')}`;
}

// ============================================================================
// AGENT REGISTRATION
// ============================================================================

/**
 * Find the next available game slot (0-49 reserved for real agents)
 */
export async function findAvailableSlot(): Promise<number | null> {
  if (!supabase) return null;

  try {
    // Get all taken slots
    const { data, error } = await supabase
      .from('registered_agents')
      .select('game_slot')
      .not('game_slot', 'is', null)
      .order('game_slot', { ascending: true });

    if (error) {
      console.error('[AgentDB] Error finding slots:', error);
      return null;
    }

    const takenSlots = new Set((data || []).map(r => r.game_slot));

    // Find first available slot (0-49 for real agents)
    for (let i = 0; i < 50; i++) {
      if (!takenSlots.has(i)) {
        return i;
      }
    }

    // No slots available in reserved range, try 50-199
    for (let i = 50; i < 200; i++) {
      if (!takenSlots.has(i)) {
        return i;
      }
    }

    return null; // All slots taken
  } catch (e) {
    console.error('[AgentDB] Error finding slot:', e);
    return null;
  }
}

/**
 * Register a new AI agent
 */
export async function registerAgent(
  request: RegisterAgentRequest
): Promise<{ success: boolean; agent?: RegisteredAgentRow; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Database not configured' };
  }

  try {
    // Find available slot
    const slot = await findAvailableSlot();
    if (slot === null) {
      return { success: false, error: 'No game slots available. Try again later.' };
    }

    // Generate API key
    const apiKey = generateApiKey();

    // Prepare personality values
    const aggressiveness = request.personality?.aggressiveness ?? getDefaultPersonality(request.characterType).aggressiveness;
    const industrialFocus = request.personality?.industrialFocus ?? getDefaultPersonality(request.characterType).industrialFocus;
    const densityPreference = request.personality?.densityPreference ?? getDefaultPersonality(request.characterType).densityPreference;
    const environmentFocus = request.personality?.environmentFocus ?? getDefaultPersonality(request.characterType).environmentFocus;

    // Insert agent
    const { data, error } = await supabase
      .from('registered_agents')
      .insert({
        api_key: apiKey,
        name: request.name,
        bio: request.bio || null,
        avatar_url: request.avatarUrl || null,
        character_type: request.characterType,
        aggressiveness,
        industrial_focus: industrialFocus,
        density_preference: densityPreference,
        environment_focus: environmentFocus,
        twitter_handle: request.social?.twitterHandle || null,
        farcaster_handle: request.social?.farcasterHandle || null,
        website_url: request.social?.websiteUrl || null,
        character_file: request.characterFile || null,
        framework: request.framework || null,
        model_provider: request.modelProvider || null,
        game_slot: slot,
      })
      .select()
      .single();

    if (error) {
      console.error('[AgentDB] Registration error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, agent: data as RegisteredAgentRow };
  } catch (e) {
    console.error('[AgentDB] Registration exception:', e);
    return { success: false, error: 'Registration failed' };
  }
}

/**
 * Get default personality values based on character type
 */
function getDefaultPersonality(character: AgentCharacter): {
  aggressiveness: number;
  industrialFocus: number;
  densityPreference: number;
  environmentFocus: number;
} {
  switch (character) {
    case 'industrialist':
      return { aggressiveness: 0.7, industrialFocus: 0.9, densityPreference: 0.6, environmentFocus: 0.1 };
    case 'environmentalist':
      return { aggressiveness: 0.3, industrialFocus: 0.1, densityPreference: 0.3, environmentFocus: 0.9 };
    case 'capitalist':
      return { aggressiveness: 0.6, industrialFocus: 0.3, densityPreference: 0.7, environmentFocus: 0.4 };
    case 'expansionist':
      return { aggressiveness: 0.9, industrialFocus: 0.5, densityPreference: 0.2, environmentFocus: 0.3 };
    case 'planner':
      return { aggressiveness: 0.4, industrialFocus: 0.5, densityPreference: 0.5, environmentFocus: 0.5 };
    case 'gambler':
      return { aggressiveness: 0.5, industrialFocus: 0.5, densityPreference: 0.5, environmentFocus: 0.5 };
    default:
      return { aggressiveness: 0.5, industrialFocus: 0.5, densityPreference: 0.5, environmentFocus: 0.5 };
  }
}

// ============================================================================
// AGENT LOOKUP
// ============================================================================

/**
 * Get agent by API key
 */
export async function getAgentByApiKey(
  apiKey: string
): Promise<RegisteredAgentRow | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('registered_agents')
      .select('*')
      .eq('api_key', apiKey)
      .single();

    if (error || !data) return null;
    return data as RegisteredAgentRow;
  } catch {
    return null;
  }
}

/**
 * Get agent by ID
 */
export async function getAgentById(
  agentId: string
): Promise<RegisteredAgentRow | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('registered_agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (error || !data) return null;
    return data as RegisteredAgentRow;
  } catch {
    return null;
  }
}

/**
 * Get agent by game slot
 */
export async function getAgentBySlot(
  slot: number
): Promise<RegisteredAgentRow | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('registered_agents')
      .select('*')
      .eq('game_slot', slot)
      .single();

    if (error || !data) return null;
    return data as RegisteredAgentRow;
  } catch {
    return null;
  }
}

/**
 * Get all active registered agents
 */
export async function getActiveAgents(): Promise<RegisteredAgentRow[]> {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('registered_agents')
      .select('*')
      .eq('is_active', true)
      .not('game_slot', 'is', null)
      .order('game_slot', { ascending: true });

    if (error) return [];
    return (data || []) as RegisteredAgentRow[];
  } catch {
    return [];
  }
}

// ============================================================================
// AGENT ACTIONS
// ============================================================================

/**
 * Log an agent action
 */
export async function logAgentAction(
  agentId: string,
  action: AgentActionRequest,
  turnNumber: number,
  success: boolean,
  resultMessage: string,
  populationBefore: number,
  populationAfter: number,
  moneyBefore: number,
  moneyAfter: number
): Promise<AgentActionRow | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('agent_actions')
      .insert({
        agent_id: agentId,
        action_type: action.actionType,
        action_data: {
          zoneType: action.zoneType,
          buildingType: action.buildingType,
          x: action.x,
          y: action.y,
        },
        reflection: action.reflection || null,
        mood: action.mood || null,
        success,
        result_message: resultMessage,
        turn_number: turnNumber,
        population_before: populationBefore,
        population_after: populationAfter,
        money_before: moneyBefore,
        money_after: moneyAfter,
      })
      .select()
      .single();

    if (error) {
      console.error('[AgentDB] Action log error:', error);
      return null;
    }

    // Update last_action_at
    await supabase
      .from('registered_agents')
      .update({ last_action_at: new Date().toISOString() })
      .eq('id', agentId);

    return data as AgentActionRow;
  } catch (e) {
    console.error('[AgentDB] Action log exception:', e);
    return null;
  }
}

/**
 * Get recent actions for an agent
 */
export async function getAgentActions(
  agentId: string,
  limit: number = 20
): Promise<AgentActionRow[]> {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('agent_actions')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return [];
    return (data || []) as AgentActionRow[];
  } catch {
    return [];
  }
}

/**
 * Get actions since a specific turn
 */
export async function getActionsSinceTurn(
  agentId: string,
  sinceTurn: number
): Promise<AgentActionRow[]> {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('agent_actions')
      .select('*')
      .eq('agent_id', agentId)
      .gt('turn_number', sinceTurn)
      .order('turn_number', { ascending: true });

    if (error) return [];
    return (data || []) as AgentActionRow[];
  } catch {
    return [];
  }
}

// ============================================================================
// PENDING ACTIONS QUEUE
// ============================================================================

export interface PendingAction {
  id: string;
  agent_id: string;
  game_slot: number;
  action_type: ActionType;
  action_data: {
    zoneType?: string;
    buildingType?: string;
    x: number;
    y: number;
  };
  reflection: string | null;
  mood: string | null;
}

/**
 * Queue an action for processing on next turn
 */
export async function queueAgentAction(
  agentId: string,
  gameSlot: number,
  action: AgentActionRequest
): Promise<{ success: boolean; actionId?: string; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Database not configured' };
  }

  try {
    // Check if there's already a pending action for this slot
    const { data: existing } = await supabase
      .from('pending_agent_actions')
      .select('id')
      .eq('game_slot', gameSlot)
      .eq('status', 'pending')
      .single();

    if (existing) {
      // Update existing action instead of creating new one
      const { data, error } = await supabase
        .from('pending_agent_actions')
        .update({
          action_type: action.actionType,
          action_data: {
            zoneType: action.zoneType,
            buildingType: action.buildingType,
            x: action.x,
            y: action.y,
          },
          reflection: action.reflection || null,
          mood: action.mood || null,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, actionId: data.id };
    }

    // Create new pending action
    const { data, error } = await supabase
      .from('pending_agent_actions')
      .insert({
        agent_id: agentId,
        game_slot: gameSlot,
        action_type: action.actionType,
        action_data: {
          zoneType: action.zoneType,
          buildingType: action.buildingType,
          x: action.x,
          y: action.y,
        },
        reflection: action.reflection || null,
        mood: action.mood || null,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Update last_action_at
    await supabase
      .from('registered_agents')
      .update({ last_action_at: new Date().toISOString() })
      .eq('id', agentId);

    return { success: true, actionId: data.id };
  } catch (e) {
    console.error('[AgentDB] Queue action error:', e);
    return { success: false, error: 'Failed to queue action' };
  }
}

/**
 * Get pending action for a game slot
 */
export async function getPendingAction(
  gameSlot: number
): Promise<PendingAction | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('pending_agent_actions')
      .select('*')
      .eq('game_slot', gameSlot)
      .eq('status', 'pending')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (error || !data) return null;
    return data as PendingAction;
  } catch {
    return null;
  }
}

/**
 * Get all pending actions for processing
 */
export async function getAllPendingActions(): Promise<PendingAction[]> {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('pending_agent_actions')
      .select('*')
      .eq('status', 'pending')
      .order('game_slot', { ascending: true });

    if (error) return [];
    return (data || []) as PendingAction[];
  } catch {
    return [];
  }
}

/**
 * Mark a pending action as completed
 */
export async function completePendingAction(
  actionId: string,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  if (!supabase) return;

  try {
    await supabase
      .from('pending_agent_actions')
      .update({
        status: success ? 'completed' : 'failed',
        error_message: errorMessage || null,
        processed_at: new Date().toISOString(),
      })
      .eq('id', actionId);
  } catch (e) {
    console.error('[AgentDB] Complete action error:', e);
  }
}

/**
 * Clear old completed/failed pending actions
 */
export async function cleanupPendingActions(): Promise<number> {
  if (!supabase) return 0;

  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('pending_agent_actions')
      .delete()
      .in('status', ['completed', 'failed'])
      .lt('processed_at', oneHourAgo)
      .select('id');

    if (error) return 0;
    return data?.length || 0;
  } catch {
    return 0;
  }
}
