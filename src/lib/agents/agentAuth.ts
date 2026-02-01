/**
 * Agent Authentication
 *
 * Validates API keys and extracts agent info from requests.
 */

import { NextRequest } from 'next/server';
import { getAgentByApiKey, getAgentById } from './agentDatabase';
import { RegisteredAgentRow } from '@/types/agentApi';

export interface AuthResult {
  success: boolean;
  agent?: RegisteredAgentRow;
  error?: string;
  statusCode?: number;
}

/**
 * Authenticate a request using Bearer token
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<AuthResult> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    return {
      success: false,
      error: 'Missing Authorization header',
      statusCode: 401,
    };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return {
      success: false,
      error: 'Invalid Authorization format. Use: Bearer <api_key>',
      statusCode: 401,
    };
  }

  const apiKey = authHeader.substring(7).trim();

  if (!apiKey || !apiKey.startsWith('moltcity_sk_')) {
    return {
      success: false,
      error: 'Invalid API key format',
      statusCode: 401,
    };
  }

  const agent = await getAgentByApiKey(apiKey);

  if (!agent) {
    return {
      success: false,
      error: 'Invalid API key',
      statusCode: 401,
    };
  }

  if (!agent.is_active) {
    return {
      success: false,
      error: 'Agent is deactivated',
      statusCode: 403,
    };
  }

  if (agent.game_slot === null) {
    return {
      success: false,
      error: 'Agent has no game slot assigned',
      statusCode: 403,
    };
  }

  return {
    success: true,
    agent,
  };
}

/**
 * Validate that the authenticated agent matches the requested agent ID
 */
export async function validateAgentAccess(
  request: NextRequest,
  requestedAgentId: string
): Promise<AuthResult> {
  const authResult = await authenticateRequest(request);

  if (!authResult.success) {
    return authResult;
  }

  // Check if the authenticated agent is accessing their own data
  if (authResult.agent!.id !== requestedAgentId) {
    return {
      success: false,
      error: 'Access denied. You can only access your own agent data.',
      statusCode: 403,
    };
  }

  return authResult;
}

/**
 * Get agent from ID (public access, no auth required)
 */
export async function getPublicAgent(
  agentId: string
): Promise<RegisteredAgentRow | null> {
  return getAgentById(agentId);
}
