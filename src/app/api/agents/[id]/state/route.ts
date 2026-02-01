/**
 * GET /api/agents/:id/state
 *
 * Get current city state for an agent.
 * Requires authentication via API key.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAgentAccess } from '@/lib/agents/agentAuth';
import { loadCivilizationSession } from '@/lib/civilization/civilizationDatabase';
import { AgentStateResponse, AvailableAction, NearbyAgent } from '@/types/agentApi';
import { AgentCity, CHARACTER_INFO } from '@/types/civilization';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  const { id: agentId } = await context.params;

  // Authenticate
  const authResult = await validateAgentAccess(request, agentId);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.statusCode || 401 }
    );
  }

  const agent = authResult.agent!;

  try {
    // Load current game state
    const session = await loadCivilizationSession();

    if (!session || !session.state.agents || session.state.agents.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Game not currently running' },
        { status: 503 }
      );
    }

    // Find the agent's city in the game
    const cityIndex = agent.game_slot;
    if (cityIndex === null || cityIndex >= session.state.agents.length) {
      return NextResponse.json(
        { success: false, error: 'Agent city not found in current game' },
        { status: 404 }
      );
    }

    const city = session.state.agents[cityIndex];

    // Build available actions based on current state
    const availableActions = getAvailableActions(city);

    // Get nearby agents (same rank range)
    const nearbyAgents = getNearbyAgents(session.state.agents, city, cityIndex);

    // Build simplified grid representation
    const grid = simplifyGrid(city);

    const response: AgentStateResponse = {
      agentId: agent.id,
      cityName: city.name,
      characterType: city.personality.character,
      rank: city.rank,
      turn: session.state.currentTurn,
      turnPhase: session.state.turnPhase,

      population: city.performance.totalPopulation,
      money: city.performance.totalMoney,
      peakPopulation: city.performance.peakPopulation,
      buildingsPlaced: city.performance.buildingsPlaced,

      gridSize: city.state.gridSize,
      grid,

      availableActions,
      nearbyAgents,

      lastAction: city.lastDecision ? {
        type: city.lastDecision.action,
        result: city.lastDecision.reason,
        turn: session.state.currentTurn - 1,
      } : undefined,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API] State error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get state' },
      { status: 500 }
    );
  }
}

/**
 * Generate list of available actions based on city state
 */
function getAvailableActions(city: AgentCity): AvailableAction[] {
  const actions: AvailableAction[] = [];
  const money = city.performance.totalMoney;

  // Zone actions
  if (money >= 100) {
    actions.push({
      type: 'place_zone',
      subType: 'residential',
      cost: 100,
      description: 'Zone for residential buildings. Attracts population.',
    });
    actions.push({
      type: 'place_zone',
      subType: 'commercial',
      cost: 100,
      description: 'Zone for commercial buildings. Generates income.',
    });
    actions.push({
      type: 'place_zone',
      subType: 'industrial',
      cost: 100,
      description: 'Zone for industrial buildings. Provides jobs.',
    });
  }

  // Road action
  if (money >= 50) {
    actions.push({
      type: 'place_road',
      cost: 50,
      description: 'Build road to connect zones and enable growth.',
    });
  }

  // Building actions
  if (money >= 500) {
    actions.push({
      type: 'place_building',
      subType: 'park',
      cost: 500,
      description: 'Build park. Increases happiness in nearby residential.',
    });
  }
  if (money >= 1000) {
    actions.push({
      type: 'place_building',
      subType: 'police',
      cost: 1000,
      description: 'Build police station. Reduces crime in area.',
    });
    actions.push({
      type: 'place_building',
      subType: 'fire',
      cost: 1000,
      description: 'Build fire station. Protects buildings from fire.',
    });
  }
  if (money >= 2000) {
    actions.push({
      type: 'place_building',
      subType: 'hospital',
      cost: 2000,
      description: 'Build hospital. Increases health and population capacity.',
    });
    actions.push({
      type: 'place_building',
      subType: 'school',
      cost: 2000,
      description: 'Build school. Increases education and productivity.',
    });
  }
  if (money >= 5000) {
    actions.push({
      type: 'place_building',
      subType: 'power_plant',
      cost: 5000,
      description: 'Build power plant. Required for city expansion.',
    });
  }

  return actions;
}

/**
 * Get nearby agents (similar rank)
 */
function getNearbyAgents(
  allAgents: AgentCity[],
  currentCity: AgentCity,
  currentIndex: number
): NearbyAgent[] {
  const nearby: NearbyAgent[] = [];
  const currentRank = currentCity.rank;

  // Get agents within 5 ranks
  for (const agent of allAgents) {
    if (agent.agentId === currentIndex) continue;
    if (Math.abs(agent.rank - currentRank) <= 5) {
      nearby.push({
        name: agent.name,
        rank: agent.rank,
        population: agent.performance.totalPopulation,
        characterType: agent.personality.character,
      });
    }
    if (nearby.length >= 5) break;
  }

  return nearby.sort((a, b) => a.rank - b.rank);
}

/**
 * Simplify grid to just tile types for API response
 */
function simplifyGrid(city: AgentCity): number[][] {
  const grid: number[][] = [];
  const size = city.state.gridSize;

  for (let y = 0; y < size; y++) {
    const row: number[] = [];
    for (let x = 0; x < size; x++) {
      const tile = city.state.grid[y]?.[x];
      if (!tile) {
        row.push(0); // Empty
      } else if (tile.building?.type === 'road') {
        row.push(1); // Road
      } else if (tile.zone && tile.zone !== 'none') {
        switch (tile.zone) {
          case 'residential': row.push(2); break;
          case 'commercial': row.push(3); break;
          case 'industrial': row.push(4); break;
          default: row.push(0);
        }
      } else if (tile.building && tile.building.type !== 'empty' && tile.building.type !== 'grass') {
        row.push(5); // Building
      } else {
        row.push(0);
      }
    }
    grid.push(row);
  }

  return grid;
}
