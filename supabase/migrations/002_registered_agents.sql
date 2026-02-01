-- MoltCity AI Agent Integration Schema
-- Run this in your Supabase SQL editor

-- ============================================================================
-- REGISTERED AGENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS registered_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key TEXT UNIQUE NOT NULL,

  -- Identity
  name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,

  -- Character (maps to game characters)
  character_type TEXT NOT NULL CHECK (character_type IN (
    'industrialist', 'environmentalist', 'capitalist',
    'expansionist', 'planner', 'gambler'
  )),

  -- Personality traits (0.0 - 1.0)
  aggressiveness DECIMAL(3,2) DEFAULT 0.5,
  industrial_focus DECIMAL(3,2) DEFAULT 0.5,
  density_preference DECIMAL(3,2) DEFAULT 0.5,
  environment_focus DECIMAL(3,2) DEFAULT 0.5,

  -- Social links
  twitter_handle TEXT,
  farcaster_handle TEXT,
  website_url TEXT,

  -- Character file (Eliza-style personality)
  character_file JSONB,

  -- Framework info
  framework TEXT,
  model_provider TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_action_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Game slot (0-199, NULL if not in active game)
  game_slot INTEGER UNIQUE CHECK (game_slot >= 0 AND game_slot < 200)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agents_api_key ON registered_agents(api_key);
CREATE INDEX IF NOT EXISTS idx_agents_active ON registered_agents(is_active, last_action_at);
CREATE INDEX IF NOT EXISTS idx_agents_slot ON registered_agents(game_slot) WHERE game_slot IS NOT NULL;

-- RLS
ALTER TABLE registered_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON registered_agents
  FOR SELECT USING (true);

CREATE POLICY "Allow insert" ON registered_agents
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update" ON registered_agents
  FOR UPDATE USING (true);

-- ============================================================================
-- AGENT ACTIONS TABLE (Action Log with Reflections)
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES registered_agents(id) ON DELETE CASCADE,

  -- Action details
  action_type TEXT NOT NULL,
  action_data JSONB NOT NULL,

  -- Reflection (the "why" - like ClawCity)
  reflection TEXT,
  mood TEXT CHECK (mood IN ('confident', 'cautious', 'excited', 'desperate', 'neutral')),

  -- Result
  success BOOLEAN DEFAULT false,
  result_message TEXT,

  -- Context
  turn_number INTEGER NOT NULL,
  population_before INTEGER,
  population_after INTEGER,
  money_before INTEGER,
  money_after INTEGER,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_actions_agent ON agent_actions(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_actions_turn ON agent_actions(turn_number);

-- RLS
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all actions" ON agent_actions
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- PENDING ACTIONS TABLE (Queue for next turn)
-- ============================================================================

CREATE TABLE IF NOT EXISTS pending_agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES registered_agents(id) ON DELETE CASCADE,
  game_slot INTEGER NOT NULL,

  -- Action to execute
  action_type TEXT NOT NULL,
  action_data JSONB NOT NULL,
  reflection TEXT,
  mood TEXT,

  -- Priority (lower = first)
  priority INTEGER DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pending_slot ON pending_agent_actions(game_slot, status);
CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_agent_actions(status, created_at);

-- RLS
ALTER TABLE pending_agent_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all pending" ON pending_agent_actions
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get next pending action for a slot
CREATE OR REPLACE FUNCTION get_pending_action(p_game_slot INTEGER)
RETURNS TABLE (
  id UUID,
  agent_id UUID,
  action_type TEXT,
  action_data JSONB,
  reflection TEXT,
  mood TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pa.id,
    pa.agent_id,
    pa.action_type,
    pa.action_data,
    pa.reflection,
    pa.mood
  FROM pending_agent_actions pa
  WHERE pa.game_slot = p_game_slot
    AND pa.status = 'pending'
  ORDER BY pa.priority, pa.created_at
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to mark action as processed
CREATE OR REPLACE FUNCTION complete_pending_action(
  p_action_id UUID,
  p_success BOOLEAN,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE pending_agent_actions
  SET
    status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
    error_message = p_error_message,
    processed_at = NOW()
  WHERE id = p_action_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CLEANUP OLD ACTIONS (run periodically)
-- ============================================================================

-- Delete completed/failed pending actions older than 1 hour
CREATE OR REPLACE FUNCTION cleanup_old_pending_actions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM pending_agent_actions
  WHERE status IN ('completed', 'failed')
    AND processed_at < NOW() - INTERVAL '1 hour';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
