/**
 * Rise of Nations - Agentic AI Hook (Multi-Agent Support)
 * 
 * Supports multiple AI players, each with their own conversation context.
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { RoNGameState, RoNPlayer } from '../types/game';
import { Unit } from '../types/units';

export interface AgenticAIConfig {
  enabled: boolean;
  aiPlayerIds: string[];  // Support multiple AI players
  actionInterval: number;
}

export interface AgenticAIMessage {
  id: string;
  playerId: string;  // Which AI sent this message
  playerName: string;
  message: string;
  timestamp: number;
  isRead: boolean;
}

export interface UseAgenticAIResult {
  messages: AgenticAIMessage[];
  isThinking: boolean;
  thinkingPlayerIds: string[];  // Which AIs are currently thinking
  lastError: string | null;
  thoughts: string | null;
  markMessageRead: (messageId: string) => void;
  clearMessages: () => void;
  reset: () => void;
}

const POLL_INTERVAL_MS = 5000; // 5 seconds between AI calls (faster for more responsive AI)
const STAGGER_DELAY_MS = 1500;  // Stagger AI calls by 1.5 seconds

// Per-AI state stored in refs
interface AIPlayerState {
  responseId?: string;
  isProcessing: boolean;
  lastCallTime: number;
}

export function useAgenticAI(
  gameState: RoNGameState,
  setGameState: (updater: (prev: RoNGameState) => RoNGameState) => void,
  config: AgenticAIConfig
): UseAgenticAIResult {
  const [messages, setMessages] = useState<AgenticAIMessage[]>([]);
  const [thinkingPlayerIds, setThinkingPlayerIds] = useState<string[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  
  // Per-AI state refs (keyed by player ID)
  const aiStatesRef = useRef<Map<string, AIPlayerState>>(new Map());
  const latestStateRef = useRef(gameState);
  
  useEffect(() => {
    latestStateRef.current = gameState;
  }, [gameState]);

  // Initialize/update AI states when player IDs change
  useEffect(() => {
    const currentIds = new Set(config.aiPlayerIds);
    const stateMap = aiStatesRef.current;
    
    // Log AI player configuration
    // if (config.aiPlayerIds.length > 0) {
    //   console.log(`[MULTI-AI] Configured ${config.aiPlayerIds.length} AI players:`, config.aiPlayerIds);
    // }
    
    // Add new AI players
    for (const id of config.aiPlayerIds) {
      if (!stateMap.has(id)) {
        stateMap.set(id, {
          isProcessing: false,
          lastCallTime: 0,
        });
        console.log(`[MULTI-AI] Added AI player: ${id}`);
      }
    }
    
    // Remove old AI players
    for (const id of stateMap.keys()) {
      if (!currentIds.has(id)) {
        stateMap.delete(id);
        console.log(`[MULTI-AI] Removed AI player: ${id}`);
      }
    }
  }, [config.aiPlayerIds]);

  // Log AI resources every ~10 ticks for all AI players
  const lastLogTickRef = useRef(0);
  useEffect(() => {
    if (!config.enabled || config.aiPlayerIds.length === 0) return;
    const tick = gameState.tick;
    if (tick - lastLogTickRef.current >= 10) {
      const isDetailedLog = tick - lastLogTickRef.current >= 50 || lastLogTickRef.current === 0;
      lastLogTickRef.current = tick;
      
      for (const aiPlayerId of config.aiPlayerIds) {
        const aiPlayer = gameState.players.find(p => p.id === aiPlayerId);
        if (aiPlayer) {
          const aiUnits = gameState.units.filter(u => u.ownerId === aiPlayerId);
          const citizens = aiUnits.filter(u => u.type === 'citizen').length;
          const military = aiUnits.filter(u => u.type !== 'citizen').length;
          
          // Count buildings
          const buildingCounts: Record<string, number> = {};
          for (let y = 0; y < gameState.gridSize; y++) {
            for (let x = 0; x < gameState.gridSize; x++) {
              const tile = gameState.grid[y]?.[x];
              if (tile?.building && tile.ownerId === aiPlayerId) {
                const type = tile.building.type;
                buildingCounts[type] = (buildingCounts[type] || 0) + 1;
              }
            }
          }
          
          const color = aiPlayer.color || '#4CAF50';
          console.log(
            `%c[${aiPlayer.name}] Tick ${tick}%c | Pop: ${aiPlayer.population}/${aiPlayer.populationCap} | ` +
            `👷${citizens} ⚔️${military} | ` +
            `🍖${Math.round(aiPlayer.resources.food)}(${aiPlayer.resourceRates.food}/s) ` +
            `🪵${Math.round(aiPlayer.resources.wood)}(${aiPlayer.resourceRates.wood}/s) ` +
            `⛏️${Math.round(aiPlayer.resources.metal)}(${aiPlayer.resourceRates.metal}/s)`,
            `color: ${color}; font-weight: bold`,
            'color: inherit'
          );
          
          if (isDetailedLog) {
            const buildingSummary = Object.entries(buildingCounts)
              .map(([type, count]) => `${type}:${count}`)
              .join(', ');
            console.log(`  [${aiPlayer.name} Buildings] ${buildingSummary || 'none'}`);
          }
        }
      }
    }
  }, [gameState.tick, config.enabled, config.aiPlayerIds, gameState.players, gameState.units, gameState.grid, gameState.gridSize]);

  const processAITurn = useCallback(async (aiPlayerId: string) => {
    const aiState = aiStatesRef.current.get(aiPlayerId);
    if (!aiState || aiState.isProcessing || !config.enabled) return;
    
    const state = latestStateRef.current;
    if (state.gameSpeed === 0 || state.gameOver) return;
    
    const aiPlayer = state.players.find(p => p.id === aiPlayerId);
    if (!aiPlayer || aiPlayer.isDefeated) return;

    aiState.isProcessing = true;
    aiState.lastCallTime = Date.now();
    setThinkingPlayerIds(prev => [...prev.filter(id => id !== aiPlayerId), aiPlayerId]);

    try {
      const response = await fetch('/api/ron-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameState: state,
          aiPlayerId: aiPlayerId,
          previousResponseId: aiState.responseId,
        }),
      });

      const result = await response.json();

      if (result.error) {
        setLastError(`[${aiPlayer.name}] ${result.error}`);
        // Reset response ID on errors to start fresh
        if (result.error.includes('400') || result.error.includes('invalid')) {
          aiState.responseId = undefined;
        }
      } else {
        setLastError(null);
        
        // Save response ID for conversation continuity
        if (result.responseId) {
          aiState.responseId = result.responseId;
        }
        
        // Add messages with player attribution
        if (result.messages?.length > 0) {
          setMessages(prev => [
            ...prev,
            ...result.messages.map((msg: string) => ({
              id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              playerId: aiPlayerId,
              playerName: aiPlayer.name,
              message: msg,
              timestamp: Date.now(),
              isRead: false,
            })),
          ]);
        }

        // Apply AI actions directly to current state
        console.log(`[${aiPlayer.name} SYNC] Result received:`, { 
          hasActions: !!result.actions, 
          actionCount: result.actions?.length,
          hasTick: !!result.newState?.tick 
        });
        
        const actions = result.actions as Array<{
          type: 'build' | 'unit_task' | 'train' | 'resource_update';
          data: Record<string, unknown>;
        }> | undefined;
        
        if (actions && actions.length > 0) {
          console.log(`[${aiPlayer.name} SYNC] Applying ${actions.length} actions:`, actions.map(a => a.type).join(', '));
          
          setGameState((currentState) => {
            let newGrid = currentState.grid.map(row => [...row]);
            let newUnits = [...currentState.units];
            let newPlayers = [...currentState.players];
            
            for (const action of actions) {
              if (action.type === 'build') {
                const { building, x, y, ownerId } = action.data as { 
                  building: unknown; x: number; y: number; ownerId: string 
                };
                console.log(`[${aiPlayer.name} SYNC] Building ${(building as {type: string}).type} at (${x},${y})`);
                
                // Apply building to grid
                if (newGrid[y] && newGrid[y][x]) {
                  newGrid[y][x] = {
                    ...newGrid[y][x],
                    building: building as typeof newGrid[0][0]['building'],
                    ownerId,
                  };
                }
              } else if (action.type === 'unit_task') {
                const { unitId, task, taskTarget, targetX, targetY, isMoving } = action.data as {
                  unitId: string; task: string; taskTarget?: unknown; 
                  targetX?: number; targetY?: number; isMoving?: boolean;
                };
                
                const unitIdx = newUnits.findIndex(u => u.id === unitId);
                if (unitIdx >= 0) {
                  console.log(`[${aiPlayer.name} SYNC] Unit ${unitId.slice(0,15)}: task=${task}, target=(${targetX?.toFixed(1)},${targetY?.toFixed(1)})`);
                  newUnits[unitIdx] = {
                    ...newUnits[unitIdx],
                    task: task as Unit['task'],
                    taskTarget: taskTarget as Unit['taskTarget'],
                    targetX,
                    targetY,
                    isMoving: isMoving ?? true,
                  };
                }
              } else if (action.type === 'train') {
                const { unitType, buildingX, buildingY } = action.data as {
                  unitType: string; buildingX: number; buildingY: number;
                };
                console.log(`[${aiPlayer.name} SYNC] Queued ${unitType} at (${buildingX},${buildingY})`);
                
                // Add to building queue
                if (newGrid[buildingY] && newGrid[buildingY][buildingX]?.building) {
                  const tile = newGrid[buildingY][buildingX];
                  newGrid[buildingY][buildingX] = {
                    ...tile,
                    building: {
                      ...tile.building!,
                      queuedUnits: [...(tile.building!.queuedUnits || []), unitType],
                    },
                  };
                }
              } else if (action.type === 'resource_update') {
                const { playerId, resources } = action.data as {
                  playerId: string; resources: RoNPlayer['resources'];
                };
                console.log(`[${aiPlayer.name} SYNC] Resource boost for ${playerId}: food=${resources.food}, wood=${resources.wood}, metal=${resources.metal}`);
                newPlayers = newPlayers.map(p => 
                  p.id === playerId ? { ...p, resources } : p
                );
              }
            }
            
            // Also sync AI player resources from newState
            if (result.newState?.players) {
              const returnedPlayer = result.newState.players.find((p: RoNPlayer) => p.id === aiPlayerId);
              if (returnedPlayer) {
                newPlayers = newPlayers.map(p => 
                  p.id === aiPlayerId ? { ...p, resources: returnedPlayer.resources, age: returnedPlayer.age } : p
                );
              }
            }
            
            console.log(`[${aiPlayer.name} SYNC] Applied ${actions.length} actions successfully`);
            
            const merged = {
              ...currentState,
              grid: newGrid,
              units: newUnits,
              players: newPlayers,
            };
            latestStateRef.current = merged;
            return merged;
          });
        } else if (result.newState?.tick) {
          // Fallback: sync resources at minimum
          setGameState((currentState) => {
            if (result.newState?.players) {
              const returnedPlayer = result.newState.players.find((p: RoNPlayer) => p.id === aiPlayerId);
              if (returnedPlayer) {
                const newPlayers = currentState.players.map(p => 
                  p.id === aiPlayerId ? { ...p, resources: returnedPlayer.resources, age: returnedPlayer.age } : p
                );
                return { ...currentState, players: newPlayers };
              }
            }
            return currentState;
          });
        }
      }
    } catch (error) {
      setLastError(`[${aiPlayer?.name || aiPlayerId}] ${error instanceof Error ? error.message : 'Error'}`);
    } finally {
      aiState.isProcessing = false;
      setThinkingPlayerIds(prev => prev.filter(id => id !== aiPlayerId));
    }
  }, [config.enabled, setGameState]);

  // Schedule AI turns with staggered timing
  useEffect(() => {
    if (!config.enabled || config.aiPlayerIds.length === 0) return;

    // Initial calls with stagger
    const initialTimeouts = config.aiPlayerIds.map((id, index) => 
      setTimeout(() => processAITurn(id), 2000 + index * STAGGER_DELAY_MS)
    );

    // Interval calls with stagger
    const intervals = config.aiPlayerIds.map((id, index) => 
      setInterval(() => processAITurn(id), POLL_INTERVAL_MS + index * STAGGER_DELAY_MS)
    );

    return () => {
      initialTimeouts.forEach(t => clearTimeout(t));
      intervals.forEach(i => clearInterval(i));
    };
  }, [config.enabled, config.aiPlayerIds, processAITurn]);

  const markMessageRead = useCallback((messageId: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, isRead: true } : msg
    ));
  }, []);

  const clearMessages = useCallback(() => setMessages([]), []);

  // Reset all AI state - call this when restarting the game
  const reset = useCallback(() => {
    // Clear messages and errors
    setMessages([]);
    setLastError(null);
    setThinkingPlayerIds([]);
    
    // Clear all AI conversation histories
    aiStatesRef.current.forEach((state) => {
      state.responseId = undefined;
      state.isProcessing = false;
      state.lastCallTime = 0;
    });
    
    console.log('[AI] Reset complete - All AI agents will start fresh');
  }, []);

  return {
    messages,
    isThinking: thinkingPlayerIds.length > 0,
    thinkingPlayerIds,
    lastError,
    thoughts: null,
    markMessageRead,
    clearMessages,
    reset,
  };
}
