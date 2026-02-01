/**
 * Agent Action Processor
 *
 * Processes pending actions from real AI agents during turn processing.
 * Integrates with the game's turn system to execute queued actions.
 */

import { AgentCity } from '@/types/civilization';
import { GameState } from '@/games/isocity/types/game';
import {
  getAllPendingActions,
  completePendingAction,
  logAgentAction,
  PendingAction,
} from './agentDatabase';

// ============================================================================
// TYPES
// ============================================================================

export interface ActionResult {
  success: boolean;
  message: string;
  populationChange?: number;
  moneyChange?: number;
}

// ============================================================================
// ACTION EXECUTION
// ============================================================================

/**
 * Process all pending actions for real agents
 * Called during turn processing
 */
export async function processRealAgentActions(
  agents: AgentCity[],
  currentTurn: number
): Promise<AgentCity[]> {
  // Get all pending actions
  const pendingActions = await getAllPendingActions();

  if (pendingActions.length === 0) {
    return agents;
  }

  console.log(`[AgentProcessor] Processing ${pendingActions.length} pending actions`);

  // Create a mutable copy of agents
  const updatedAgents = [...agents];

  // Process each pending action
  for (const pending of pendingActions) {
    const agentIndex = pending.game_slot;

    if (agentIndex < 0 || agentIndex >= updatedAgents.length) {
      await completePendingAction(pending.id, false, 'Invalid game slot');
      continue;
    }

    const agent = updatedAgents[agentIndex];
    const result = await executeAction(agent, pending, currentTurn);

    // Update agent state if action succeeded
    if (result.success) {
      updatedAgents[agentIndex] = {
        ...agent,
        lastDecision: {
          action: `${pending.action_type}: ${pending.action_data.zoneType || pending.action_data.buildingType || 'road'}`,
          reason: pending.reflection || 'No reflection provided',
          success: true,
        },
      };
    }

    // Mark action as completed
    await completePendingAction(pending.id, result.success, result.success ? undefined : result.message);

    // Log the action for history
    await logAgentAction(
      pending.agent_id,
      {
        actionType: pending.action_type,
        zoneType: pending.action_data.zoneType as 'residential' | 'commercial' | 'industrial' | undefined,
        buildingType: pending.action_data.buildingType,
        x: pending.action_data.x,
        y: pending.action_data.y,
        reflection: pending.reflection || undefined,
        mood: pending.mood as 'confident' | 'cautious' | 'excited' | 'desperate' | 'neutral' | undefined,
      },
      currentTurn,
      result.success,
      result.message,
      agent.performance.totalPopulation,
      agent.performance.totalPopulation + (result.populationChange || 0),
      agent.performance.totalMoney,
      agent.performance.totalMoney + (result.moneyChange || 0)
    );
  }

  return updatedAgents;
}

/**
 * Execute a single action for an agent
 */
async function executeAction(
  agent: AgentCity,
  pending: PendingAction,
  currentTurn: number
): Promise<ActionResult> {
  const { action_type, action_data } = pending;
  const { x, y } = action_data;

  // Validate position
  if (x < 0 || y < 0 || x >= agent.state.gridSize || y >= agent.state.gridSize) {
    return {
      success: false,
      message: `Position (${x}, ${y}) is out of bounds`,
    };
  }

  // Get the tile
  const tile = agent.state.grid[y]?.[x];
  if (!tile) {
    return {
      success: false,
      message: `Invalid tile at (${x}, ${y})`,
    };
  }

  switch (action_type) {
    case 'place_zone':
      return executeZoneAction(agent, tile, action_data, x, y);

    case 'place_road':
      return executeRoadAction(agent, tile, x, y);

    case 'place_building':
      return executeBuildingAction(agent, tile, action_data, x, y);

    default:
      return {
        success: false,
        message: `Unknown action type: ${action_type}`,
      };
  }
}

/**
 * Execute zone placement
 */
function executeZoneAction(
  agent: AgentCity,
  tile: GameState['grid'][0][0],
  action_data: PendingAction['action_data'],
  x: number,
  y: number
): ActionResult {
  const { zoneType } = action_data;
  const cost = 100;

  // Check if tile is empty (no zone set and no significant building)
  const hasBuilding = tile.building && tile.building.type !== 'empty' && tile.building.type !== 'grass';
  const hasZone = tile.zone && tile.zone !== 'none';
  if (hasZone || hasBuilding) {
    return {
      success: false,
      message: `Tile at (${x}, ${y}) is not empty`,
    };
  }

  // Check money
  if (agent.performance.totalMoney < cost) {
    return {
      success: false,
      message: `Not enough money. Need $${cost}, have $${agent.performance.totalMoney}`,
    };
  }

  // Execute the zone placement
  // Note: In a real implementation, this would modify the game state
  // For now, we just validate and log

  return {
    success: true,
    message: `Zoned ${zoneType} at (${x}, ${y})`,
    moneyChange: -cost,
  };
}

/**
 * Execute road placement
 */
function executeRoadAction(
  agent: AgentCity,
  tile: GameState['grid'][0][0],
  x: number,
  y: number
): ActionResult {
  const cost = 50;

  // Check if tile is empty
  const hasBuilding = tile.building && tile.building.type !== 'empty' && tile.building.type !== 'grass';
  const hasZone = tile.zone && tile.zone !== 'none';
  if (hasZone || hasBuilding) {
    return {
      success: false,
      message: `Tile at (${x}, ${y}) is not empty`,
    };
  }

  // Check money
  if (agent.performance.totalMoney < cost) {
    return {
      success: false,
      message: `Not enough money. Need $${cost}, have $${agent.performance.totalMoney}`,
    };
  }

  return {
    success: true,
    message: `Built road at (${x}, ${y})`,
    moneyChange: -cost,
  };
}

/**
 * Execute building placement
 */
function executeBuildingAction(
  agent: AgentCity,
  tile: GameState['grid'][0][0],
  action_data: PendingAction['action_data'],
  x: number,
  y: number
): ActionResult {
  const { buildingType } = action_data;

  // Building costs
  const buildingCosts: Record<string, number> = {
    park: 500,
    police: 1000,
    fire: 1000,
    hospital: 2000,
    school: 2000,
    power_plant: 5000,
    water_tower: 3000,
  };

  const cost = buildingCosts[buildingType || ''] || 1000;

  // Check if tile is empty or has appropriate zone
  const hasBuilding = tile.building && tile.building.type !== 'empty' && tile.building.type !== 'grass';
  if (hasBuilding) {
    return {
      success: false,
      message: `Cannot place building at (${x}, ${y}) - tile is occupied`,
    };
  }

  // Check money
  if (agent.performance.totalMoney < cost) {
    return {
      success: false,
      message: `Not enough money. Need $${cost}, have $${agent.performance.totalMoney}`,
    };
  }

  return {
    success: true,
    message: `Built ${buildingType} at (${x}, ${y})`,
    moneyChange: -cost,
  };
}

/**
 * Check if a slot has a real agent
 */
export async function isRealAgentSlot(slot: number): Promise<boolean> {
  const { getAgentBySlot } = await import('./agentDatabase');
  const agent = await getAgentBySlot(slot);
  return agent !== null;
}

/**
 * Get decision info for a real agent (for display)
 */
export async function getRealAgentDecision(
  slot: number
): Promise<{ reflection: string; mood: string } | null> {
  const { getPendingAction } = await import('./agentDatabase');
  const pending = await getPendingAction(slot);

  if (!pending) return null;

  return {
    reflection: pending.reflection || 'Thinking...',
    mood: pending.mood || 'neutral',
  };
}
