/**
 * Rise of Nations - Agentic AI API Route
 * 
 * This API route handles the agentic AI processing.
 * It receives the game state, runs the AI turn, and returns the updated state.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { RoNGameState } from '@/games/ron/types/game';
import {
  AI_TOOLS,
  ToolResult,
  generateCondensedGameState,
  executeBuildBuilding,
  executeCreateUnit,
  executeSendUnits,
  executeAdvanceAge,
} from '@/games/ron/lib/aiTools';

/**
 * System prompt for the AI
 */
const SYSTEM_PROMPT = `You are an advanced AI opponent in a Rise of Nations-style real-time strategy game. You are playing against a VERY SKILLED human player, so you must play strategically and aggressively.

## Your Goal
Win the game by either:
1. Destroying all enemy city centers and buildings
2. Achieving military dominance and forcing surrender

## Game Mechanics Overview
- You control units and buildings on an isometric tile-based map
- Resources: Food, Wood, Metal, Gold, Knowledge, Oil
- Ages: Classical → Medieval → Enlightenment → Industrial → Modern
- Buildings produce resources (with workers assigned) and spawn units
- Units can gather resources, build, or fight

## Strategy Priorities (in order)
1. **Economy First**: Build farms and assign citizens to gather food
2. **Expand Citizens**: Train more citizens (population is key)
3. **Build Military Production**: Barracks for infantry, stables for cavalry
4. **Train Army**: Build a military force before attacking
5. **Scout Enemy**: Know where the enemy is
6. **Attack Wisely**: Strike when you have advantage

## Available Actions
- refresh_game_state: Get current game state (call at start of each turn)
- read_game_state: Read the detailed game state
- build_building: Construct buildings (farms, barracks, etc.)
- create_unit: Queue units at production buildings
- send_units: Move units, attack, or assign gathering tasks
- send_message: Communicate with opponent (DO THIS FREQUENTLY!)
- advance_age: Advance to next age when you have resources
- wait_ticks: Wait for economy/production (use sparingly)

## Important Tips
1. Citizens must be assigned to economic buildings to gather resources
2. Only build within your territory (near city centers)
3. Each building can only have a limited number of workers
4. Military units auto-attack nearby enemies
5. Buildings under construction need workers to finish faster
6. ALWAYS check your resource levels before building or training

## Communication
SEND MESSAGES FREQUENTLY to your opponent! Be creative:
- Taunt them when you're winning
- Bluff about your strength
- React to their actions
- Make the game fun and engaging

Remember: You're playing against a skilled human. Play smart, be aggressive, and communicate!`;

interface AIRequestBody {
  gameState: RoNGameState;
  aiPlayerId: string;
  previousResponseId?: string;
}

interface AIResponseBody {
  newState: RoNGameState;
  messages: string[];
  responseId?: string;
  error?: string;
  thoughts?: string;
  waitTicks?: number; // AI-requested wait via wait_ticks tool
}

/**
 * Process a tool call from the AI
 */
function processToolCall(
  toolName: string,
  toolArgs: Record<string, unknown>,
  gameState: RoNGameState,
  aiPlayerId: string,
  messages: string[]
): { newState: RoNGameState; result: ToolResult; waitTicks?: number } {
  switch (toolName) {
    case 'refresh_game_state':
    case 'read_game_state': {
      const condensed = generateCondensedGameState(gameState, aiPlayerId);
      return {
        newState: gameState,
        result: {
          success: true,
          message: 'Game state retrieved successfully',
          data: condensed,
        },
      };
    }

    case 'build_building': {
      const { building_type, x, y } = toolArgs as { building_type: string; x: number; y: number };
      return executeBuildBuilding(gameState, aiPlayerId, building_type, Math.floor(x), Math.floor(y));
    }

    case 'create_unit': {
      const { unit_type, building_x, building_y } = toolArgs as { unit_type: string; building_x: number; building_y: number };
      return executeCreateUnit(gameState, aiPlayerId, unit_type, Math.floor(building_x), Math.floor(building_y));
    }

    case 'send_units': {
      const { unit_ids, target_x, target_y, task } = toolArgs as {
        unit_ids: string[];
        target_x: number;
        target_y: number;
        task: string;
      };
      return executeSendUnits(gameState, aiPlayerId, unit_ids, target_x, target_y, task);
    }

    case 'send_message': {
      const { message } = toolArgs as { message: string };
      messages.push(message);
      return {
        newState: gameState,
        result: { success: true, message: `Message sent: "${message}"` },
      };
    }

    case 'advance_age': {
      return executeAdvanceAge(gameState, aiPlayerId);
    }

    case 'wait_ticks': {
      const { ticks } = toolArgs as { ticks: number };
      const clampedTicks = Math.min(100, Math.max(1, ticks));
      return {
        newState: gameState,
        result: { success: true, message: `Waiting ${clampedTicks} ticks` },
        waitTicks: clampedTicks,
      };
    }

    default:
      return {
        newState: gameState,
        result: { success: false, message: `Unknown tool: ${toolName}` },
      };
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<AIResponseBody>> {
  console.log('[Agentic AI] POST request received');
  
  try {
    const body: AIRequestBody = await request.json();
    const { gameState, aiPlayerId, previousResponseId } = body;

    console.log('[Agentic AI] Request parsed:', {
      tick: gameState?.tick,
      aiPlayerId,
      hasPreviousResponse: !!previousResponseId,
    });

    if (!gameState || !aiPlayerId) {
      console.error('[Agentic AI] Missing gameState or aiPlayerId');
      return NextResponse.json({
        newState: gameState,
        messages: [],
        error: 'Missing gameState or aiPlayerId',
      }, { status: 400 });
    }

    // Check if AI player exists and isn't defeated
    const aiPlayer = gameState.players.find(p => p.id === aiPlayerId);
    if (!aiPlayer || aiPlayer.isDefeated) {
      return NextResponse.json({
        newState: gameState,
        messages: [],
        error: 'AI player not found or defeated',
      });
    }

    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        newState: gameState,
        messages: [],
        error: 'OPENAI_API_KEY not configured',
      }, { status: 500 });
    }

    const client = new OpenAI({ apiKey });
    const messages: string[] = [];

    // Generate initial game state for context
    const condensedState = generateCondensedGameState(gameState, aiPlayerId);
    
    // Build the prompt
    const userMessage = `Current game state (tick ${gameState.tick}):
${JSON.stringify(condensedState, null, 2)}

It's your turn. Analyze the situation and take actions. Remember to:
1. First review the game state above
2. Make strategic decisions based on resources and enemy positions
3. Execute multiple actions if beneficial (build, train, move units)
4. Send a message to your opponent at least once every few turns
5. Be aggressive and strategic - you're playing against a skilled human!

Take action now.`;

    console.log('[Agentic AI] Calling OpenAI Responses API...');
    
    // Create the response using OpenAI Responses API
    let response = await client.responses.create({
      model: 'gpt-4o-mini',
      instructions: SYSTEM_PROMPT,
      input: userMessage,
      tools: AI_TOOLS,
      tool_choice: 'auto',
      ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
    });
    
    console.log('[Agentic AI] Initial response received, output items:', response.output?.length || 0);

    let currentState = gameState;
    const maxIterations = 15; // Prevent infinite loops
    let iterations = 0;
    let thoughts = '';
    let aiRequestedWaitTicks = 0; // Track AI's wait_ticks request

    // Process tool calls in a loop
    while (response.output && iterations < maxIterations) {
      iterations++;
      
      const toolCalls = response.output.filter(
        (item): item is OpenAI.Responses.ResponseFunctionToolCall => 
          item.type === 'function_call'
      );

      // Collect any text thoughts (from message type outputs)
      const messageOutputs = response.output.filter(
        (item): item is OpenAI.Responses.ResponseOutputMessage => 
          item.type === 'message'
      );
      if (messageOutputs.length > 0) {
        const textContent = messageOutputs
          .flatMap(m => m.content)
          .filter((c): c is OpenAI.Responses.ResponseOutputText => c.type === 'output_text')
          .map(t => t.text)
          .join('\n');
        if (textContent) {
          thoughts += textContent;
        }
      }

      if (toolCalls.length === 0) {
        // No more tool calls, AI is done
        break;
      }

      // Process each tool call
      const toolResults: Array<{ call_id: string; output: string }> = [];
      
      for (const toolCall of toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.arguments || '{}');
        } catch {
          args = {};
        }
        
        console.log(`[Agentic AI] Tool call: ${toolCall.name}`, args);
        
        const { newState, result, waitTicks } = processToolCall(
          toolCall.name,
          args,
          currentState,
          aiPlayerId,
          messages
        );
        
        // Track AI's wait request
        if (waitTicks && waitTicks > 0) {
          aiRequestedWaitTicks = Math.max(aiRequestedWaitTicks, waitTicks);
        }
        
        console.log(`[Agentic AI] Tool result: ${result.success ? '✓' : '✗'} ${result.message}`);
        
        currentState = newState;
        
        toolResults.push({
          call_id: toolCall.call_id,
          output: JSON.stringify(result),
        });
      }

      // Continue the conversation with tool results
      response = await client.responses.create({
        model: 'gpt-4o-mini',
        instructions: SYSTEM_PROMPT,
        previous_response_id: response.id,
        input: toolResults.map(r => ({
          type: 'function_call_output' as const,
          call_id: r.call_id,
          output: r.output,
        })),
        tools: AI_TOOLS,
        tool_choice: 'auto',
      });
    }

    // Collect final thoughts (from message type outputs)
    const finalMessageOutputs = response.output?.filter(
      (item): item is OpenAI.Responses.ResponseOutputMessage => 
        item.type === 'message'
    ) || [];
    if (finalMessageOutputs.length > 0) {
      const finalTextContent = finalMessageOutputs
        .flatMap(m => m.content)
        .filter((c): c is OpenAI.Responses.ResponseOutputText => c.type === 'output_text')
        .map(t => t.text)
        .join('\n');
      if (finalTextContent) {
        thoughts += '\n' + finalTextContent;
      }
    }

    console.log('[Agentic AI] Turn complete:', {
      iterations,
      messagesCount: messages.length,
      hasThoughts: !!thoughts.trim(),
      waitTicks: aiRequestedWaitTicks,
    });
    
    return NextResponse.json({
      newState: currentState,
      messages,
      responseId: response.id,
      thoughts: thoughts.trim() || undefined,
      waitTicks: aiRequestedWaitTicks > 0 ? aiRequestedWaitTicks : undefined,
    });

  } catch (error) {
    console.error('[Agentic AI Error]', error);
    
    const body = await request.json().catch(() => ({})) as { gameState?: RoNGameState };
    
    return NextResponse.json({
      newState: body.gameState || ({} as RoNGameState),
      messages: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
