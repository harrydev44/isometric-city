#!/usr/bin/env npx ts-node
/**
 * Rise of Nations - Standalone Game Runner
 * 
 * Runs the game simulation and AI completely server-side.
 * No browser required - full control from terminal.
 * 
 * Usage: npx ts-node scripts/game-runner.ts
 */

import { createInitialRoNGameState, RoNGameState, RoNPlayer } from '../src/games/ron/types/game';
import { simulateRoNTick } from '../src/games/ron/lib/simulation';

// Colors for terminal output
const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';

// Configuration
const GRID_SIZE = 100;
const TICK_INTERVAL_MS = 100; // 10 ticks per second
const AI_TURN_INTERVAL_TICKS = 30; // AI takes turn every 30 ticks (3 seconds)
const API_BASE_URL = 'http://localhost:3000';

interface AIState {
  playerId: string;
  lastTurnTick: number;
  responseId: string | null;
  isProcessing: boolean;
  totalActions: number;
  turnsCompleted: number;
}

class GameRunner {
  private state: RoNGameState;
  private aiStates: Map<string, AIState> = new Map();
  private running = false;
  private tickInterval: NodeJS.Timeout | null = null;

  constructor() {
    console.log(`${MAGENTA}${BOLD}`);
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║   🎮 Rise of Nations - Standalone Game Runner  ║');
    console.log('╚════════════════════════════════════════════════╝');
    console.log(RESET);

    // Initialize fresh game
    this.state = createInitialRoNGameState(GRID_SIZE, [
      { name: 'Player', type: 'human', color: '#3b82f6' },
      { name: 'AI Red', type: 'ai', difficulty: 'medium', color: '#ef4444' },
      { name: 'AI Green', type: 'ai', difficulty: 'medium', color: '#22c55e' },
    ]);

    // Initialize AI states
    for (const player of this.state.players) {
      if (player.type === 'ai') {
        this.aiStates.set(player.id, {
          playerId: player.id,
          lastTurnTick: 0,
          responseId: null,
          isProcessing: false,
          totalActions: 0,
          turnsCompleted: 0,
        });
        console.log(`${GREEN}✓ Initialized AI: ${player.name} (${player.id})${RESET}`);
      }
    }

    console.log(`${CYAN}Game initialized: ${GRID_SIZE}x${GRID_SIZE} grid, ${this.state.players.length} players${RESET}`);
    console.log('');
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.state.gameSpeed = 3;

    console.log(`${GREEN}▶ Starting game simulation...${RESET}`);
    console.log(`${YELLOW}  Tick interval: ${TICK_INTERVAL_MS}ms (${1000/TICK_INTERVAL_MS} ticks/sec)${RESET}`);
    console.log(`${YELLOW}  AI turn interval: every ${AI_TURN_INTERVAL_TICKS} ticks${RESET}`);
    console.log('');

    this.tickInterval = setInterval(() => this.tick(), TICK_INTERVAL_MS);
  }

  stop() {
    this.running = false;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    console.log(`${RED}⏹ Game stopped${RESET}`);
  }

  private tick() {
    // Advance game state
    this.state = simulateRoNTick(this.state);

    // Log status every 100 ticks
    if (this.state.tick % 100 === 0) {
      this.logStatus();
    }

    // Process AI turns
    for (const [playerId, aiState] of this.aiStates) {
      const ticksSinceLastTurn = this.state.tick - aiState.lastTurnTick;
      
      if (ticksSinceLastTurn >= AI_TURN_INTERVAL_TICKS && !aiState.isProcessing) {
        this.processAITurn(playerId);
      }
    }
  }

  private logStatus() {
    const tick = this.state.tick;
    console.log(`${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
    console.log(`${CYAN}Tick ${tick} | Time: ${(tick * TICK_INTERVAL_MS / 1000).toFixed(1)}s${RESET}`);
    
    for (const player of this.state.players) {
      if (player.type === 'ai') {
        const aiState = this.aiStates.get(player.id);
        const buildings = this.state.grid.flat().filter(t => t.building?.ownerId === player.id).length;
        const units = this.state.units.filter(u => u.ownerId === player.id).length;
        const military = this.state.units.filter(u => u.ownerId === player.id && u.type !== 'citizen').length;
        
        console.log(`${player.color === '#ef4444' ? RED : GREEN}${player.name}:${RESET}`);
        console.log(`  Pop: ${player.population}/${player.populationCap} | Units: ${units} | Military: ${military}`);
        console.log(`  Food: ${Math.floor(player.resources.food)} | Wood: ${Math.floor(player.resources.wood)} | Metal: ${Math.floor(player.resources.metal)} | Gold: ${Math.floor(player.resources.gold)}`);
        console.log(`  Buildings: ${buildings} | Turns: ${aiState?.turnsCompleted || 0} | Actions: ${aiState?.totalActions || 0}`);
      }
    }
    console.log('');
  }

  private async processAITurn(playerId: string) {
    const aiState = this.aiStates.get(playerId);
    if (!aiState || aiState.isProcessing) return;

    aiState.isProcessing = true;
    aiState.lastTurnTick = this.state.tick;

    const player = this.state.players.find(p => p.id === playerId);
    if (!player) {
      aiState.isProcessing = false;
      return;
    }

    console.log(`${YELLOW}🤖 ${player.name} starting turn at tick ${this.state.tick}...${RESET}`);

    try {
      const response = await fetch(`${API_BASE_URL}/api/ron-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameState: this.state,
          playerId: playerId,
          previousResponseId: aiState.responseId,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.updatedState) {
        // Apply state updates
        this.state = result.updatedState;
        aiState.responseId = result.responseId || null;
        aiState.turnsCompleted++;
        
        const actionCount = result.actions?.length || 0;
        aiState.totalActions += actionCount;

        console.log(`${GREEN}✓ ${player.name} completed turn: ${actionCount} actions in ${(result.duration / 1000).toFixed(1)}s${RESET}`);
        
        // Log actions
        if (result.actions && result.actions.length > 0) {
          for (const action of result.actions.slice(0, 5)) {
            console.log(`  ${BLUE}→ ${action.type}: ${JSON.stringify(action.args).slice(0, 60)}...${RESET}`);
          }
          if (result.actions.length > 5) {
            console.log(`  ${BLUE}  ... and ${result.actions.length - 5} more actions${RESET}`);
          }
        }
      } else if (result.error) {
        console.log(`${RED}✗ ${player.name} error: ${result.error}${RESET}`);
      }
    } catch (error) {
      console.log(`${RED}✗ ${player.name} API call failed: ${error instanceof Error ? error.message : 'Unknown error'}${RESET}`);
    } finally {
      aiState.isProcessing = false;
    }
  }

  getState(): RoNGameState {
    return this.state;
  }
}

// Main entry point
async function main() {
  const runner = new GameRunner();
  
  // Start the game
  runner.start();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n');
    runner.stop();
    console.log(`${MAGENTA}Game ended. Final state:${RESET}`);
    const state = runner.getState();
    console.log(`  Total ticks: ${state.tick}`);
    for (const player of state.players) {
      if (player.type === 'ai') {
        console.log(`  ${player.name}: Pop ${player.population}/${player.populationCap}`);
      }
    }
    process.exit(0);
  });

  console.log(`${YELLOW}Press Ctrl+C to stop${RESET}`);
  console.log('');
}

main().catch(console.error);
