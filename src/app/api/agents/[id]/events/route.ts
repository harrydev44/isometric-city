/**
 * GET /api/agents/:id/events
 *
 * Get recent events affecting an agent.
 * Requires authentication via API key.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAgentAccess } from '@/lib/agents/agentAuth';
import { getActionsSinceTurn } from '@/lib/agents/agentDatabase';
import { loadCivilizationSession } from '@/lib/civilization/civilizationDatabase';
import { AgentEventsResponse, AgentEventData } from '@/types/agentApi';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse<AgentEventsResponse | { success: false; error: string }>> {
  const { id: agentId } = await context.params;

  // Authenticate
  const authResult = await validateAgentAccess(request, agentId);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error || 'Unauthorized' },
      { status: authResult.statusCode || 401 }
    );
  }

  const agent = authResult.agent!;

  try {
    // Get query params
    const { searchParams } = new URL(request.url);
    const sinceTurn = parseInt(searchParams.get('since_turn') || '0', 10);

    // Load current game state
    const session = await loadCivilizationSession();
    if (!session || !session.state.agents) {
      return NextResponse.json(
        { success: false, error: 'Game not currently running' },
        { status: 503 }
      );
    }

    const cityIndex = agent.game_slot;
    if (cityIndex === null || cityIndex >= session.state.agents.length) {
      return NextResponse.json(
        { success: false, error: 'Agent city not found in current game' },
        { status: 404 }
      );
    }

    const city = session.state.agents[cityIndex];
    const currentTurn = session.state.currentTurn;
    const events: AgentEventData[] = [];

    // Get events from session state that affect this agent
    for (const event of session.state.events || []) {
      if (event.agentId === cityIndex && event.turn > sinceTurn) {
        events.push({
          id: event.id,
          turn: event.turn,
          type: mapEventType(event.type),
          message: event.message,
          emoji: event.emoji,
          timestamp: event.timestamp,
        });
      }
    }

    // Get action results since the specified turn
    const actions = await getActionsSinceTurn(agentId, sinceTurn);
    for (const action of actions) {
      events.push({
        id: action.id,
        turn: action.turn_number,
        type: 'game_event',
        message: action.result_message || `Action: ${action.action_type}`,
        data: {
          actionType: action.action_type,
          success: action.success,
          populationChange: (action.population_after || 0) - (action.population_before || 0),
          moneyChange: (action.money_after || 0) - (action.money_before || 0),
        },
        timestamp: new Date(action.created_at).getTime(),
      });
    }

    // Check for rank changes, milestones, etc.
    // These could be calculated by comparing to previous state
    if (city.rank === 1 && sinceTurn < currentTurn) {
      events.push({
        id: `leader-${currentTurn}`,
        turn: currentTurn,
        type: 'new_leader',
        message: `${city.name} is now the #1 city!`,
        emoji: '👑',
        timestamp: Date.now(),
      });
    }

    // Sort by turn descending
    events.sort((a, b) => b.turn - a.turn);

    return NextResponse.json({
      agentId,
      currentTurn,
      events: events.slice(0, 50), // Limit to 50 events
    });
  } catch (error) {
    console.error('[API] Events error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get events' },
      { status: 500 }
    );
  }
}

/**
 * Map civilization event types to API event types
 */
function mapEventType(type: string): AgentEventData['type'] {
  switch (type) {
    case 'population_milestone':
      return 'population_milestone';
    case 'rank_change':
      return 'rank_change';
    case 'building_milestone':
      return 'building_milestone';
    case 'new_leader':
      return 'new_leader';
    default:
      return 'game_event';
  }
}
