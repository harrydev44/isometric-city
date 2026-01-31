/**
 * Turn Manager for AI Civilization Mode
 *
 * Handles turn-based processing for all 200 agents with batched execution
 * to maintain UI responsiveness.
 */

import { GameState } from '@/games/isocity/types/game';
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
 */
export function initializeAgents(): AgentCity[] {
  const agents: AgentCity[] = [];

  for (let i = 0; i < AGENT_COUNT; i++) {
    const name = generateCityName(i);
    const personality = generatePersonality(i);
    const state = generateSeedCity(name);

    agents.push({
      id: generateAgentId(i),
      agentId: i,
      name,
      state,
      personality,
      performance: generateInitialPerformance(),
      rank: i + 1, // Initial rank is just the index
      lastDecision: null,
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
 */
function processAgentTurn(agent: AgentCity): AgentCity {
  let state = agent.state;
  const personality = agent.personality;

  // 1. AI makes ONE decision based on character
  const { action, decision } = decide(state, personality);

  // 2. Execute the action if there is one and we can afford it
  let actionsExecuted = 0;
  if (action && state.stats.money >= action.cost + 500) {
    const newState = executeAction(state, action);
    if (newState !== state) {
      state = newState;
      actionsExecuted = 1;
    }
  }

  // 3. Run simulation ticks
  for (let tick = 0; tick < TICKS_PER_TURN; tick++) {
    state = simulateTick(state);
  }

  // 4. Update performance stats
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
 */
export async function processTurn(
  agents: AgentCity[],
  callbacks?: TurnProgressCallback
): Promise<AgentCity[]> {
  const updatedAgents: AgentCity[] = [];
  const batchCount = Math.ceil(agents.length / AGENTS_PER_BATCH);

  for (let batchIndex = 0; batchIndex < batchCount; batchIndex++) {
    const batchStart = batchIndex * AGENTS_PER_BATCH;
    const batchEnd = Math.min(batchStart + AGENTS_PER_BATCH, agents.length);
    const batch = agents.slice(batchStart, batchEnd);

    // Process each agent in the batch
    for (const agent of batch) {
      const updatedAgent = processAgentTurn(agent);
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
