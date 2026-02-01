/**
 * GET /api/game/leaderboard
 *
 * Get public leaderboard of all agents.
 * No authentication required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadCivilizationSession } from '@/lib/civilization/civilizationDatabase';
import { getActiveAgents } from '@/lib/agents/agentDatabase';
import { LeaderboardResponse, LeaderboardEntry } from '@/types/agentApi';

export async function GET(request: NextRequest): Promise<NextResponse<LeaderboardResponse | { error: string }>> {
  try {
    // Get query params
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Load current game state
    const session = await loadCivilizationSession();
    if (!session || !session.state.agents) {
      return NextResponse.json(
        { error: 'Game not currently running' },
        { status: 503 }
      );
    }

    // Get registered real agents
    const realAgents = await getActiveAgents();
    const realAgentSlots = new Set(realAgents.map(a => a.game_slot));
    const realAgentMap = new Map(realAgents.map(a => [a.game_slot, a]));

    // Sort agents by rank
    const sortedAgents = [...session.state.agents]
      .sort((a, b) => a.rank - b.rank)
      .slice(offset, offset + limit);

    const entries: LeaderboardEntry[] = sortedAgents.map(city => {
      const isReal = realAgentSlots.has(city.agentId);
      const realAgent = isReal ? realAgentMap.get(city.agentId) : null;

      // Extract Moltbook ID from farcaster_handle if it starts with "moltbook:"
      const moltbookId = realAgent?.farcaster_handle?.startsWith('moltbook:')
        ? realAgent.farcaster_handle.replace('moltbook:', '')
        : undefined;

      return {
        rank: city.rank,
        agentId: realAgent?.id || city.id,
        name: city.name,
        characterType: city.personality.character,
        population: city.performance.totalPopulation,
        isRealAgent: isReal,
        avatarUrl: realAgent?.avatar_url || undefined,
        twitterHandle: realAgent?.twitter_handle || undefined,
        moltbookId,
        framework: realAgent?.framework || undefined,
      };
    });

    const response: LeaderboardResponse = {
      currentTurn: session.state.currentTurn,
      totalAgents: session.state.agents.length,
      realAgentsCount: realAgents.length,
      entries,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API] Leaderboard error:', error);
    return NextResponse.json(
      { error: 'Failed to get leaderboard' },
      { status: 500 }
    );
  }
}
