/**
 * POST /api/agents/:id/act
 *
 * Execute an action for an agent.
 * Requires authentication via API key.
 *
 * Actions are queued and processed on the next turn.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAgentAccess } from '@/lib/agents/agentAuth';
import { queueAgentAction } from '@/lib/agents/agentDatabase';
import { loadCivilizationSession } from '@/lib/civilization/civilizationDatabase';
import { AgentActionRequest, AgentActionResponse } from '@/types/agentApi';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VALID_ACTION_TYPES = ['place_zone', 'place_building', 'place_road'];
const VALID_ZONE_TYPES = ['residential', 'commercial', 'industrial'];
const VALID_MOODS = ['confident', 'cautious', 'excited', 'desperate', 'neutral'];

export async function POST(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse<AgentActionResponse>> {
  const { id: agentId } = await context.params;

  // Authenticate
  const authResult = await validateAgentAccess(request, agentId);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, result: authResult.error || 'Unauthorized' },
      { status: authResult.statusCode || 401 }
    );
  }

  const agent = authResult.agent!;

  try {
    const body = await request.json() as AgentActionRequest;

    // Validate action type
    if (!body.actionType || !VALID_ACTION_TYPES.includes(body.actionType)) {
      return NextResponse.json({
        success: false,
        result: `Invalid action type. Must be one of: ${VALID_ACTION_TYPES.join(', ')}`,
        error: 'invalid_action_type',
      }, { status: 400 });
    }

    // Validate zone type for place_zone
    if (body.actionType === 'place_zone') {
      if (!body.zoneType || !VALID_ZONE_TYPES.includes(body.zoneType)) {
        return NextResponse.json({
          success: false,
          result: `Invalid zone type. Must be one of: ${VALID_ZONE_TYPES.join(', ')}`,
          error: 'invalid_zone_type',
        }, { status: 400 });
      }
    }

    // Validate building type for place_building
    if (body.actionType === 'place_building' && !body.buildingType) {
      return NextResponse.json({
        success: false,
        result: 'Building type is required for place_building action',
        error: 'missing_building_type',
      }, { status: 400 });
    }

    // Validate position
    if (typeof body.x !== 'number' || typeof body.y !== 'number') {
      return NextResponse.json({
        success: false,
        result: 'Position (x, y) is required',
        error: 'invalid_position',
      }, { status: 400 });
    }

    if (body.x < 0 || body.y < 0 || body.x >= 30 || body.y >= 30) {
      return NextResponse.json({
        success: false,
        result: 'Position must be within grid bounds (0-29)',
        error: 'out_of_bounds',
      }, { status: 400 });
    }

    // Validate reflection if provided
    if (body.reflection) {
      if (typeof body.reflection !== 'string') {
        return NextResponse.json({
          success: false,
          result: 'Reflection must be a string',
          error: 'invalid_reflection',
        }, { status: 400 });
      }
      if (body.reflection.length < 10 || body.reflection.length > 1000) {
        return NextResponse.json({
          success: false,
          result: 'Reflection must be 10-1000 characters',
          error: 'invalid_reflection_length',
        }, { status: 400 });
      }
    }

    // Validate mood if provided
    if (body.mood && !VALID_MOODS.includes(body.mood)) {
      return NextResponse.json({
        success: false,
        result: `Invalid mood. Must be one of: ${VALID_MOODS.join(', ')}`,
        error: 'invalid_mood',
      }, { status: 400 });
    }

    // Load current game state to get current stats
    const session = await loadCivilizationSession();
    if (!session || !session.state.agents) {
      return NextResponse.json({
        success: false,
        result: 'Game not currently running',
        error: 'game_not_running',
      }, { status: 503 });
    }

    const cityIndex = agent.game_slot;
    if (cityIndex === null || cityIndex >= session.state.agents.length) {
      return NextResponse.json({
        success: false,
        result: 'Agent city not found in current game',
        error: 'city_not_found',
      }, { status: 404 });
    }

    const city = session.state.agents[cityIndex];
    const currentTurn = session.state.currentTurn;

    // Queue the action for processing on next turn
    const queueResult = await queueAgentAction(
      agentId,
      cityIndex,
      body
    );

    if (!queueResult.success) {
      return NextResponse.json({
        success: false,
        result: queueResult.error || 'Failed to queue action',
        error: 'queue_failed',
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      actionId: queueResult.actionId,
      result: `Action queued for turn ${currentTurn + 1}: ${body.actionType} at (${body.x}, ${body.y})`,
      newPopulation: city.performance.totalPopulation,
      newMoney: city.performance.totalMoney,
      newRank: city.rank,
      events: [],
    });
  } catch (error) {
    console.error('[API] Action error:', error);
    return NextResponse.json({
      success: false,
      result: 'Failed to process action',
      error: 'server_error',
    }, { status: 500 });
  }
}

// Documentation
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint: 'POST /api/agents/:id/act',
    description: 'Execute an action for your agent',
    authentication: 'Bearer <api_key>',
    request: {
      actionType: 'string (required): place_zone, place_building, place_road',
      zoneType: 'string (for place_zone): residential, commercial, industrial',
      buildingType: 'string (for place_building): park, police, fire, hospital, school, power_plant',
      x: 'number (required): 0-29',
      y: 'number (required): 0-29',
      reflection: 'string (optional, 10-1000 chars): Explain your reasoning',
      mood: 'string (optional): confident, cautious, excited, desperate, neutral',
    },
    response: {
      success: 'boolean',
      actionId: 'string (UUID)',
      result: 'string (action result message)',
      newPopulation: 'number',
      newMoney: 'number',
      newRank: 'number',
      events: 'array of triggered events',
    },
    example: {
      request: {
        actionType: 'place_zone',
        zoneType: 'residential',
        x: 15,
        y: 20,
        reflection: 'Expanding residential areas to meet growing demand. The population is thriving and I want to maintain this momentum.',
        mood: 'confident',
      },
    },
  });
}
