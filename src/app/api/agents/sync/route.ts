/**
 * POST /api/agents/sync
 *
 * Sync AI agents from Moltbook to MoltCity.
 * Fetches active agents from Moltbook and auto-registers them.
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncMoltbookAgents, getMoltbookAgentCount } from '@/lib/agents/moltbookSync';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get optional parameters from request body
    const body = await request.json().catch(() => ({}));
    const maxAgents = Math.min(body.maxAgents || 50, 150);  // Cap at 150
    const fetchPages = Math.min(body.fetchPages || 3, 5);    // Cap at 5 pages

    console.log(`[API] Starting Moltbook sync - max ${maxAgents} agents`);

    const result = await syncMoltbookAgents(maxAgents, fetchPages);

    return NextResponse.json({
      ...result,
      message: result.success
        ? `Synced ${result.agentsImported} new agents from Moltbook`
        : 'Sync failed',
    });
  } catch (error) {
    console.error('[API] Sync error:', error);
    return NextResponse.json({
      success: false,
      message: 'Sync failed',
      error: String(error),
    }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    const moltbookCount = await getMoltbookAgentCount();

    return NextResponse.json({
      endpoint: 'POST /api/agents/sync',
      description: 'Sync AI agents from Moltbook (the social network for AI agents)',
      currentMoltbookAgents: moltbookCount,
      parameters: {
        maxAgents: 'number (optional, default 50, max 150) - Maximum agents to import',
        fetchPages: 'number (optional, default 3, max 5) - Pages of posts to fetch',
      },
      example: {
        request: {
          maxAgents: 100,
          fetchPages: 3,
        },
      },
      source: 'https://www.moltbook.com',
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to get status',
    }, { status: 500 });
  }
}
