/**
 * Turn Manager for AI Civilization Mode
 *
 * Handles turn-based processing for all 200 agents with batched execution
 * to maintain UI responsiveness.
 *
 * Supports both simulated AI agents and real registered AI bots.
 */

import { GameState } from '@/games/isocity/types/game';
import { BuildingType } from '@/games/isocity/types/buildings';
import { simulateTick } from '@/lib/simulation';
import { decide, executeAction } from '@/lib/agentAI';
import { generateSeedCity } from '@/lib/cityTemplateGenerator';
import {
  AgentCity,
  AgentPersonality,
  CIVILIZATION_CONSTANTS,
  generateCityName,
  generatePersonality,
  generateInitialPerformance,
  generateAgentId,
} from '@/types/civilization';
import {
  getPendingAction,
  completePendingAction,
  logAgentAction,
  getAgentBySlot,
  getActiveAgents,
} from '@/lib/agents/agentDatabase';

const {
  AGENT_COUNT,
  TICKS_PER_TURN,
  AGENTS_PER_BATCH,
  BATCH_DELAY_MS,
} = CIVILIZATION_CONSTANTS;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize all agent cities
 * Fetches registered real agents and enriches them with Moltbook/social info
 */
export async function initializeAgents(): Promise<AgentCity[]> {
  const agents: AgentCity[] = [];

  // Fetch registered real agents from database
  const realAgents = await getActiveAgents();
  const realAgentsBySlot = new Map(
    realAgents.map(a => [a.game_slot, a])
  );

  for (let i = 0; i < AGENT_COUNT; i++) {
    const realAgent = realAgentsBySlot.get(i);

    // Use real agent's name if available, otherwise generate
    const name = realAgent?.name || generateCityName(i);

    // Use real agent's personality if available
    const personality = realAgent
      ? {
          character: realAgent.character_type,
          aggressiveness: realAgent.aggressiveness,
          industrialFocus: realAgent.industrial_focus,
          densityPreference: realAgent.density_preference,
          environmentFocus: realAgent.environment_focus,
        }
      : generatePersonality(i);

    const state = generateSeedCity(name);

    // Extract Moltbook username from farcaster_handle if present (format: "moltbook:{username}")
    const moltbookId = realAgent?.farcaster_handle?.startsWith('moltbook:')
      ? realAgent.farcaster_handle.replace('moltbook:', '')
      : (realAgent?.framework === 'moltbook' ? realAgent.name : undefined);

    agents.push({
      id: generateAgentId(i),
      agentId: i,
      name,
      state,
      personality,
      performance: generateInitialPerformance(),
      rank: i + 1, // Initial rank is just the index
      lastDecision: null,

      // Real agent info
      isRealAgent: !!realAgent,
      moltbookId,
      twitterHandle: realAgent?.twitter_handle || undefined,
      framework: realAgent?.framework || undefined,
    });
  }

  return agents;
}

// ============================================================================
// TURN PROCESSING
// ============================================================================

export interface TurnProgressCallback {
  onBatchComplete: (processedCount: number, totalCount: number) => void;
  onAgentProcessed?: (agentId: number, actions: number) => void;
}

/**
 * Process a single agent's turn
 * Each agent makes ONE decision per turn based on their character type
 *
 * For real registered agents (slots 0-49), checks for pending actions first.
 * Falls back to simulated AI if no pending action.
 */
async function processAgentTurn(
  agent: AgentCity,
  currentTurn: number
): Promise<AgentCity> {
  let state = agent.state;
  const personality = agent.personality;
  let decision = null;
  let actionsExecuted = 0;

  // Check if this is a real registered agent with a pending action
  const pendingAction = await getPendingAction(agent.agentId);
  const realAgent = pendingAction ? await getAgentBySlot(agent.agentId) : null;

  if (pendingAction && realAgent) {
    // Real agent with pending action - use their action
    const { action_type, action_data, reflection, mood } = pendingAction;

    // Try to execute the real agent's action
    let actionSuccess = false;
    let resultMessage = '';

    try {
      // Map action to game action format
      if (action_type === 'place_zone' && action_data.zoneType) {
        const gameAction = {
          type: 'place_zone' as const,
          zoneType: action_data.zoneType as 'residential' | 'commercial' | 'industrial',
          x: action_data.x,
          y: action_data.y,
          cost: 100,
          description: `Zone ${action_data.zoneType}`,
          reason: reflection || 'Real AI agent action',
        };
        const newState = executeAction(state, gameAction);
        if (newState !== state) {
          state = newState;
          actionsExecuted = 1;
          actionSuccess = true;
          resultMessage = `Zoned ${action_data.zoneType} at (${action_data.x}, ${action_data.y})`;
        } else {
          resultMessage = 'Zone placement failed - tile may be occupied';
        }
      } else if (action_type === 'place_road') {
        const gameAction = {
          type: 'place_building' as const,
          buildingType: 'road' as const,
          x: action_data.x,
          y: action_data.y,
          cost: 50,
          description: 'Build road',
          reason: reflection || 'Real AI agent action',
        };
        const newState = executeAction(state, gameAction);
        if (newState !== state) {
          state = newState;
          actionsExecuted = 1;
          actionSuccess = true;
          resultMessage = `Built road at (${action_data.x}, ${action_data.y})`;
        } else {
          resultMessage = 'Road placement failed - tile may be occupied';
        }
      } else if (action_type === 'place_building' && action_data.buildingType) {
        const gameAction = {
          type: 'place_building' as const,
          buildingType: action_data.buildingType as BuildingType,
          x: action_data.x,
          y: action_data.y,
          cost: 500,
          description: `Build ${action_data.buildingType}`,
          reason: reflection || 'Real AI agent action',
        };
        const newState = executeAction(state, gameAction);
        if (newState !== state) {
          state = newState;
          actionsExecuted = 1;
          actionSuccess = true;
          resultMessage = `Built ${action_data.buildingType} at (${action_data.x}, ${action_data.y})`;
        } else {
          resultMessage = 'Building placement failed - tile may be occupied';
        }
      }
    } catch (e) {
      resultMessage = 'Action execution error';
      console.error('[TurnManager] Real agent action error:', e);
    }

    // Mark pending action as completed
    await completePendingAction(pendingAction.id, actionSuccess, actionSuccess ? undefined : resultMessage);

    // Log the action
    await logAgentAction(
      realAgent.id,
      {
        actionType: action_type,
        zoneType: action_data.zoneType as 'residential' | 'commercial' | 'industrial' | undefined,
        buildingType: action_data.buildingType,
        x: action_data.x,
        y: action_data.y,
        reflection: reflection || undefined,
        mood: mood as 'confident' | 'cautious' | 'excited' | 'desperate' | 'neutral' | undefined,
      },
      currentTurn,
      actionSuccess,
      resultMessage,
      agent.performance.totalPopulation,
      state.stats.population,
      agent.performance.totalMoney,
      state.stats.money
    );

    decision = {
      action: `${action_type}: ${action_data.zoneType || action_data.buildingType || 'road'}`,
      reason: reflection || 'Real AI agent action',
      success: actionSuccess,
    };
  } else {
    // Simulated AI agent - use built-in AI
    const aiResult = decide(state, personality);

    if (aiResult.action && state.stats.money >= aiResult.action.cost + 500) {
      const newState = executeAction(state, aiResult.action);
      if (newState !== state) {
        state = newState;
        actionsExecuted = 1;
      }
    }

    decision = aiResult.decision;
  }

  // Run simulation ticks
  for (let tick = 0; tick < TICKS_PER_TURN; tick++) {
    state = simulateTick(state);
  }

  // Update performance stats
  const performance = {
    totalPopulation: state.stats.population,
    totalMoney: state.stats.money,
    peakPopulation: Math.max(agent.performance.peakPopulation, state.stats.population),
    turnsAlive: agent.performance.turnsAlive + 1,
    buildingsPlaced: agent.performance.buildingsPlaced + actionsExecuted,
  };

  return {
    ...agent,
    state,
    performance,
    lastDecision: decision,
  };
}

/**
 * Process a turn for all agents in batches
 *
 * @param agents - All agent cities
 * @param callbacks - Progress callbacks
 * @param currentTurn - Current turn number (for logging real agent actions)
 */
export async function processTurn(
  agents: AgentCity[],
  callbacks?: TurnProgressCallback,
  currentTurn: number = 0
): Promise<AgentCity[]> {
  const updatedAgents: AgentCity[] = [];
  const batchCount = Math.ceil(agents.length / AGENTS_PER_BATCH);

  for (let batchIndex = 0; batchIndex < batchCount; batchIndex++) {
    const batchStart = batchIndex * AGENTS_PER_BATCH;
    const batchEnd = Math.min(batchStart + AGENTS_PER_BATCH, agents.length);
    const batch = agents.slice(batchStart, batchEnd);

    // Process each agent in the batch
    for (const agent of batch) {
      const updatedAgent = await processAgentTurn(agent, currentTurn);
      updatedAgents.push(updatedAgent);

      if (callbacks?.onAgentProcessed) {
        callbacks.onAgentProcessed(
          agent.agentId,
          updatedAgent.performance.buildingsPlaced - agent.performance.buildingsPlaced
        );
      }
    }

    // Report batch progress
    if (callbacks?.onBatchComplete) {
      callbacks.onBatchComplete(batchEnd, agents.length);
    }

    // Yield to UI between batches
    if (batchIndex < batchCount - 1) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  return updatedAgents;
}

// ============================================================================
// RANKING
// ============================================================================

/**
 * Update agent rankings based on population
 */
export function updateRankings(agents: AgentCity[]): AgentCity[] {
  // Sort by population (descending)
  const sorted = [...agents].sort(
    (a, b) => b.performance.totalPopulation - a.performance.totalPopulation
  );

  // Assign ranks
  return sorted.map((agent, index) => ({
    ...agent,
    rank: index + 1,
  }));
}

/**
 * Get top N agents by population
 */
export function getTopAgents(agents: AgentCity[], count: number = CIVILIZATION_CONSTANTS.TOP_LEADERBOARD_COUNT): AgentCity[] {
  return [...agents]
    .sort((a, b) => b.performance.totalPopulation - a.performance.totalPopulation)
    .slice(0, count);
}

// ============================================================================
// STATS
// ============================================================================

export interface CivilizationStats {
  totalPopulation: number;
  totalMoney: number;
  averagePopulation: number;
  maxPopulation: number;
  minPopulation: number;
  totalBuildingsPlaced: number;
}

export interface CharacterStats {
  character: AgentCharacter;
  count: number;
  avgPopulation: number;
  avgMoney: number;
  totalPopulation: number;
}

import { AgentCharacter, CHARACTER_INFO, CivilizationEvent, CharacterAward, AwardCategory } from '@/types/civilization';

/**
 * Calculate aggregate statistics across all agents
 */
export function calculateStats(agents: AgentCity[]): CivilizationStats {
  if (agents.length === 0) {
    return {
      totalPopulation: 0,
      totalMoney: 0,
      averagePopulation: 0,
      maxPopulation: 0,
      minPopulation: 0,
      totalBuildingsPlaced: 0,
    };
  }

  let totalPopulation = 0;
  let totalMoney = 0;
  let maxPopulation = 0;
  let minPopulation = Infinity;
  let totalBuildingsPlaced = 0;

  for (const agent of agents) {
    const pop = agent.performance.totalPopulation;
    totalPopulation += pop;
    totalMoney += agent.performance.totalMoney;
    maxPopulation = Math.max(maxPopulation, pop);
    minPopulation = Math.min(minPopulation, pop);
    totalBuildingsPlaced += agent.performance.buildingsPlaced;
  }

  return {
    totalPopulation,
    totalMoney,
    averagePopulation: Math.round(totalPopulation / agents.length),
    maxPopulation,
    minPopulation: minPopulation === Infinity ? 0 : minPopulation,
    totalBuildingsPlaced,
  };
}

// ============================================================================
// CHARACTER STATS
// ============================================================================

/**
 * Calculate statistics grouped by character type
 */
export function calculateCharacterStats(agents: AgentCity[]): CharacterStats[] {
  const characterGroups: Record<AgentCharacter, AgentCity[]> = {
    industrialist: [],
    environmentalist: [],
    capitalist: [],
    expansionist: [],
    planner: [],
    gambler: [],
  };

  // Group agents by character
  for (const agent of agents) {
    characterGroups[agent.personality.character].push(agent);
  }

  // Calculate stats for each character type
  const stats: CharacterStats[] = [];
  for (const [character, group] of Object.entries(characterGroups) as [AgentCharacter, AgentCity[]][]) {
    if (group.length === 0) continue;

    const totalPop = group.reduce((sum, a) => sum + a.performance.totalPopulation, 0);
    const totalMoney = group.reduce((sum, a) => sum + a.performance.totalMoney, 0);

    stats.push({
      character,
      count: group.length,
      avgPopulation: Math.round(totalPop / group.length),
      avgMoney: Math.round(totalMoney / group.length),
      totalPopulation: totalPop,
    });
  }

  // Sort by average population
  return stats.sort((a, b) => b.avgPopulation - a.avgPopulation);
}

// ============================================================================
// AWARDS
// ============================================================================

/**
 * Calculate character awards based on city performance
 */
export function calculateAwards(agents: AgentCity[]): CharacterAward[] {
  // Count specific metrics per city
  const cityMetrics = agents.map(agent => {
    const grid = agent.state.grid;
    let parks = 0;
    let industrial = 0;
    let roads = 0;

    for (const row of grid) {
      for (const tile of row) {
        const type = tile.building.type;
        if (type === 'park') parks++;
        if (type === 'road') roads++;
        if (tile.zone === 'industrial' && type !== 'grass' && type !== 'tree') industrial++;
      }
    }

    return {
      agent,
      parks,
      industrial,
      roads,
      money: agent.performance.totalMoney,
      happiness: agent.state.stats.happiness,
      population: agent.performance.totalPopulation,
    };
  });

  const awards: CharacterAward[] = [];

  // Greenest City (most parks)
  const greenest = [...cityMetrics].sort((a, b) => b.parks - a.parks)[0];
  awards.push({
    id: 'greenest',
    name: 'Greenest City',
    emoji: '🌲',
    description: 'Most parks',
    winnerId: greenest?.agent.agentId ?? null,
    winnerName: greenest?.agent.name ?? 'None',
    value: greenest?.parks ?? 0,
  });

  // Industrial Powerhouse (most industrial buildings)
  const industrial = [...cityMetrics].sort((a, b) => b.industrial - a.industrial)[0];
  awards.push({
    id: 'industrial',
    name: 'Industrial Powerhouse',
    emoji: '🏭',
    description: 'Most factories',
    winnerId: industrial?.agent.agentId ?? null,
    winnerName: industrial?.agent.name ?? 'None',
    value: industrial?.industrial ?? 0,
  });

  // Richest City (most money)
  const richest = [...cityMetrics].sort((a, b) => b.money - a.money)[0];
  awards.push({
    id: 'richest',
    name: 'Richest City',
    emoji: '💰',
    description: 'Highest treasury',
    winnerId: richest?.agent.agentId ?? null,
    winnerName: richest?.agent.name ?? 'None',
    value: richest?.money ?? 0,
  });

  // Largest Network (most roads)
  const largest = [...cityMetrics].sort((a, b) => b.roads - a.roads)[0];
  awards.push({
    id: 'largest',
    name: 'Largest Network',
    emoji: '🛣️',
    description: 'Most road tiles',
    winnerId: largest?.agent.agentId ?? null,
    winnerName: largest?.agent.name ?? 'None',
    value: largest?.roads ?? 0,
  });

  // Happiest Citizens (highest happiness)
  const happiest = [...cityMetrics].sort((a, b) => b.happiness - a.happiness)[0];
  awards.push({
    id: 'balanced',
    name: 'Happiest Citizens',
    emoji: '😊',
    description: 'Best quality of life',
    winnerId: happiest?.agent.agentId ?? null,
    winnerName: happiest?.agent.name ?? 'None',
    value: Math.round(happiest?.happiness ?? 0),
  });

  // Most Populous (highest population)
  const populous = [...cityMetrics].sort((a, b) => b.population - a.population)[0];
  awards.push({
    id: 'populous',
    name: 'Most Populous',
    emoji: '👥',
    description: 'Highest population',
    winnerId: populous?.agent.agentId ?? null,
    winnerName: populous?.agent.name ?? 'None',
    value: populous?.population ?? 0,
  });

  return awards;
}

// ============================================================================
// EVENTS
// ============================================================================

const POPULATION_MILESTONES = [100, 250, 500, 750, 1000, 1500, 2000, 3000, 5000, 10000];

/**
 * Generate events by comparing old and new agent states
 */
export function generateEvents(
  oldAgents: AgentCity[],
  newAgents: AgentCity[],
  currentTurn: number
): CivilizationEvent[] {
  const events: CivilizationEvent[] = [];
  const timestamp = Date.now();

  // Create lookup for old agents
  const oldAgentMap = new Map(oldAgents.map(a => [a.agentId, a]));

  for (const newAgent of newAgents) {
    const oldAgent = oldAgentMap.get(newAgent.agentId);
    if (!oldAgent) continue;

    const oldPop = oldAgent.performance.totalPopulation;
    const newPop = newAgent.performance.totalPopulation;

    // Check population milestones
    for (const milestone of POPULATION_MILESTONES) {
      if (oldPop < milestone && newPop >= milestone) {
        events.push({
          id: `pop-${newAgent.agentId}-${milestone}-${timestamp}`,
          type: 'population_milestone',
          message: `${newAgent.name} reached ${milestone.toLocaleString()} citizens!`,
          emoji: '🎉',
          agentId: newAgent.agentId,
          cityName: newAgent.name,
          timestamp,
          turn: currentTurn,
        });
      }
    }

    // Check rank changes (big jumps)
    const rankChange = oldAgent.rank - newAgent.rank;
    if (rankChange >= 5) {
      events.push({
        id: `rank-${newAgent.agentId}-${timestamp}`,
        type: 'rank_change',
        message: `${newAgent.name} jumped ${rankChange} ranks to #${newAgent.rank}!`,
        emoji: '📈',
        agentId: newAgent.agentId,
        cityName: newAgent.name,
        timestamp,
        turn: currentTurn,
      });
    }

    // Check for new #1
    if (oldAgent.rank !== 1 && newAgent.rank === 1) {
      events.push({
        id: `leader-${newAgent.agentId}-${timestamp}`,
        type: 'new_leader',
        message: `${newAgent.name} is the new #1 city!`,
        emoji: '👑',
        agentId: newAgent.agentId,
        cityName: newAgent.name,
        timestamp,
        turn: currentTurn,
      });
    }
  }

  return events;
}
