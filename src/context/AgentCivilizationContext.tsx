'use client';

/**
 * Context Provider for AI Civilization Mode
 *
 * Manages state for 200 AI agent cities, turn processing,
 * camera cycling, leaderboard, events, and awards.
 *
 * Supports shared real-time sync where:
 * - One viewer is the "leader" who runs the simulation
 * - Other viewers are "followers" who receive turn updates
 * - Leader election happens automatically (oldest viewer wins)
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import {
  AgentCity,
  CivilizationState,
  TurnPhase,
  CIVILIZATION_CONSTANTS,
  CivilizationEvent,
  CharacterAward,
} from '@/types/civilization';
import {
  initializeAgents,
  processTurn,
  updateRankings,
  getTopAgents,
  calculateStats,
  calculateCharacterStats,
  calculateAwards,
  generateEvents,
  CivilizationStats,
  CharacterStats,
} from '@/lib/turnManager';
import {
  CivilizationSyncProvider,
  CivilizationTurnUpdate,
  createCivilizationSyncProvider,
} from '@/lib/civilization/civilizationSyncProvider';
import { CivilizationSessionState } from '@/lib/civilization/civilizationDatabase';
import {
  GameEvent,
  generateGameEvents,
  applyEventEffects,
} from '@/lib/civilization/gameEvents';

const { TURN_DURATION_MS, CAMERA_CYCLE_MS, TOP_LEADERBOARD_COUNT, SPEED_OPTIONS } = CIVILIZATION_CONSTANTS;

// ============================================================================
// CONTEXT TYPES
// ============================================================================

interface AgentCivilizationContextValue {
  // State
  agents: AgentCity[];
  currentTurn: number;
  currentViewIndex: number;
  turnPhase: TurnPhase;
  autoAdvance: boolean;
  autoCycleCamera: boolean;
  timeRemaining: number;
  processingProgress: number;
  speedMultiplier: number;

  // Sync state
  isLeader: boolean;
  isConnected: boolean;
  viewerCount: number;

  // Events & Awards
  events: CivilizationEvent[];
  gameEvents: GameEvent[];
  awards: CharacterAward[];
  characterStats: CharacterStats[];

  // Derived
  currentAgent: AgentCity | null;
  topAgents: AgentCity[];
  stats: CivilizationStats;

  // Actions
  initialize: () => Promise<void>;
  advanceTurn: () => Promise<void>;
  setViewIndex: (index: number) => void;
  setAutoAdvance: (auto: boolean) => void;
  setAutoCycleCamera: (auto: boolean) => void;
  setSpeedMultiplier: (speed: number) => void;
  nextCity: () => void;
  prevCity: () => void;
  clearEvents: () => void;
  goToCity: (agentId: number) => void;
}

const defaultStats: CivilizationStats = {
  totalPopulation: 0,
  totalMoney: 0,
  averagePopulation: 0,
  maxPopulation: 0,
  minPopulation: 0,
  totalBuildingsPlaced: 0,
};

const AgentCivilizationContext = createContext<AgentCivilizationContextValue | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

export function AgentCivilizationProvider({ children }: { children: React.ReactNode }) {
  // Core state
  const [agents, setAgents] = useState<AgentCity[]>([]);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [currentViewIndex, setCurrentViewIndex] = useState(0);
  const [turnPhase, setTurnPhase] = useState<TurnPhase>('idle');
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [autoCycleCamera, setAutoCycleCamera] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<number>(TURN_DURATION_MS);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);

  // Sync state
  const [isLeader, setIsLeader] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);

  // Events & Awards
  const [events, setEvents] = useState<CivilizationEvent[]>([]);
  const [gameEvents, setGameEvents] = useState<GameEvent[]>([]);
  const [awards, setAwards] = useState<CharacterAward[]>([]);
  const [characterStats, setCharacterStats] = useState<CharacterStats[]>([]);

  // Refs for intervals
  const turnTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cameraTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);
  const previousAgentsRef = useRef<AgentCity[]>([]);

  // Sync provider ref
  const syncProviderRef = useRef<CivilizationSyncProvider | null>(null);
  const isLeaderRef = useRef(false); // Sync ref for use in callbacks
  const hasSyncedFromLeaderRef = useRef(false); // Track if we've ever synced from leader/DB

  // Refs for current state (used in callbacks)
  const agentsRef = useRef<AgentCity[]>([]);
  const currentTurnRef = useRef(0);
  const eventsRef = useRef<CivilizationEvent[]>([]);
  const gameEventsRef = useRef<GameEvent[]>([]);
  const awardsRef = useRef<CharacterAward[]>([]);
  const characterStatsRef = useRef<CharacterStats[]>([]);

  // Ref for current view index
  const currentViewIndexRef = useRef(0);

  // Keep refs in sync with state
  useEffect(() => { agentsRef.current = agents; }, [agents]);
  useEffect(() => { currentTurnRef.current = currentTurn; }, [currentTurn]);
  useEffect(() => { currentViewIndexRef.current = currentViewIndex; }, [currentViewIndex]);
  useEffect(() => { eventsRef.current = events; }, [events]);
  useEffect(() => { gameEventsRef.current = gameEvents; }, [gameEvents]);
  useEffect(() => { awardsRef.current = awards; }, [awards]);
  useEffect(() => { characterStatsRef.current = characterStats; }, [characterStats]);

  // Derived state
  const currentAgent = agents.length > 0 ? agents[currentViewIndex] : null;
  const topAgents = agents.length > 0 ? getTopAgents(agents, TOP_LEADERBOARD_COUNT) : [];
  const stats = agents.length > 0 ? calculateStats(agents) : defaultStats;

  // ============================================================================
  // APPLY TURN UPDATE FROM LEADER (for followers)
  // ============================================================================

  const applyTurnUpdate = useCallback(async (update: CivilizationTurnUpdate) => {
    // Only followers apply updates
    if (isLeaderRef.current) return;

    console.log('[Civilization] Received turn update:', update.turn, 'local turn:', currentTurnRef.current, 'reloadFromDb:', update.reloadFromDb);

    // Sync camera view from leader immediately
    if (update.currentViewIndex !== undefined) {
      setCurrentViewIndex(update.currentViewIndex);
    }

    // Always reload from database if:
    // 1. reloadFromDb flag is set, OR
    // 2. We're behind the leader's turn (desync recovery), OR
    // 3. We don't have agents yet, OR
    // 4. We've never successfully synced from leader (fallback init recovery)
    const needsReload = update.reloadFromDb ||
                        update.turn > currentTurnRef.current ||
                        agentsRef.current.length === 0 ||
                        !hasSyncedFromLeaderRef.current;

    if (needsReload) {
      const { loadCivilizationSession } = await import('@/lib/civilization/civilizationDatabase');

      // Retry loading a few times in case of timing issues
      for (let attempt = 1; attempt <= 3; attempt++) {
        const dbState = await loadCivilizationSession();
        if (dbState?.state && dbState.state.agents && dbState.state.agents.length > 0) {
          console.log('[Civilization] Reloaded state from database, turn:', dbState.state.currentTurn, 'attempt:', attempt);
          setAgents(dbState.state.agents);
          setCurrentTurn(dbState.state.currentTurn);
          setTurnPhase(dbState.state.turnPhase);
          if (dbState.state.currentViewIndex !== undefined) {
            setCurrentViewIndex(dbState.state.currentViewIndex);
          }
          setEvents(dbState.state.events || []);
          setAwards(dbState.state.awards || []);
          setCharacterStats(dbState.state.characterStats || []);
          hasSyncedFromLeaderRef.current = true; // Mark as synced
          break;
        } else if (attempt < 3) {
          console.log('[Civilization] DB load attempt', attempt, 'failed, retrying...');
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    setTimeRemaining(TURN_DURATION_MS);
  }, []);

  // ============================================================================
  // APPLY FULL STATE FROM DATABASE/SYNC (for new joiners)
  // ============================================================================

  const applyFullState = useCallback((state: CivilizationSessionState) => {
    console.log('[Civilization] Applying full state, turn:', state.currentTurn, 'viewIndex:', state.currentViewIndex);
    setAgents(state.agents);
    setCurrentTurn(state.currentTurn);
    setTurnPhase(state.turnPhase);
    // Sync camera view from leader
    if (state.currentViewIndex !== undefined) {
      setCurrentViewIndex(state.currentViewIndex);
    }
    setEvents(state.events || []);
    setGameEvents([]); // Reset game events - they're generated per turn
    setAwards(state.awards || []);
    setCharacterStats(state.characterStats || []);
    setTimeRemaining(TURN_DURATION_MS);
    setProcessingProgress(0);
    hasSyncedFromLeaderRef.current = true; // Mark as synced from leader/DB
  }, []);

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  const initialize = useCallback(async () => {
    // Clean up existing sync provider
    if (syncProviderRef.current) {
      syncProviderRef.current.destroy();
      syncProviderRef.current = null;
    }

    try {
      // Connect to sync provider
      const { provider, initialState } = await createCivilizationSyncProvider({
        onConnectionChange: (connected) => {
          setIsConnected(connected);
        },
        onViewerCountChange: (count) => {
          setViewerCount(count);
        },
        onLeaderChange: (leader) => {
          setIsLeader(leader);
          isLeaderRef.current = leader;
          console.log('[Civilization] Leader status:', leader);
        },
        onStateReceived: (state) => {
          // Received full state from leader or database
          applyFullState(state);
        },
        onTurnUpdate: (update) => {
          // Received turn update from leader
          applyTurnUpdate(update);
        },
        onCameraChange: async (viewIndex) => {
          // Received camera change from leader
          if (!isLeaderRef.current) {
            setCurrentViewIndex(viewIndex);

            // If we haven't synced yet or have no agents, try to load from database
            // This helps recover desynced followers on camera broadcasts
            if (agentsRef.current.length === 0 || !hasSyncedFromLeaderRef.current) {
              console.log('[Civilization] Unsynced during camera change, trying DB reload...');
              const { loadCivilizationSession } = await import('@/lib/civilization/civilizationDatabase');
              const dbState = await loadCivilizationSession();
              if (dbState?.state && dbState.state.agents && dbState.state.agents.length > 0) {
                console.log('[Civilization] Loaded state from DB on camera change');
                applyFullState(dbState.state);
              }
            }
          }
        },
        onRequestState: (targetViewerId) => {
          // A new viewer joined - send them the current state
          console.log('[Civilization] onRequestState called for:', targetViewerId, 'agents:', agentsRef.current.length);
          if (syncProviderRef.current && agentsRef.current.length > 0) {
            const currentState: CivilizationSessionState = {
              agents: agentsRef.current,
              currentTurn: currentTurnRef.current,
              turnPhase: 'idle',
              currentViewIndex: currentViewIndexRef.current,
              events: eventsRef.current,
              awards: awardsRef.current,
              characterStats: characterStatsRef.current,
              stats: calculateStats(agentsRef.current),
            };
            console.log('[Civilization] Sending state to new viewer:', targetViewerId, 'turn:', currentState.currentTurn, 'viewIndex:', currentState.currentViewIndex);
            syncProviderRef.current.broadcastFullState(currentState, targetViewerId);
          } else {
            console.log('[Civilization] Cannot send state: provider=', !!syncProviderRef.current, 'agents=', agentsRef.current.length);
          }
        },
        onError: (error) => {
          console.error('[Civilization] Sync error:', error);
        },
      });

      syncProviderRef.current = provider;

      // Sync leader status from provider (might have been set during connect)
      if (provider.isLeader) {
        setIsLeader(true);
        isLeaderRef.current = true;
      }
      if (provider.isConnected) {
        setIsConnected(true);
      }
      setViewerCount(provider.viewerCount || 1);

      // Check if initialState is valid (has agents)
      const hasValidInitialState = initialState && initialState.agents && initialState.agents.length > 0;

      if (hasValidInitialState) {
        // Load valid state from database
        console.log('[Civilization] Loading valid initial state from database, agents:', initialState.agents.length);
        applyFullState(initialState);
      } else {
        // No existing session in database
        // Wait a bit for leader election to complete
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Re-check leader status after waiting
        const weAreLeader = provider.isLeader || isLeaderRef.current;
        console.log('[Civilization] After wait - isLeader:', weAreLeader);

        if (weAreLeader) {
          console.log('[Civilization] We are leader, initializing fresh state');
          const freshAgents = initializeAgents();
          const rankedAgents = updateRankings(freshAgents);
          setAgents(rankedAgents);
          setCurrentTurn(0);
          setCurrentViewIndex(0);
          setTurnPhase('idle');
          setTimeRemaining(TURN_DURATION_MS);
          setProcessingProgress(0);
          setEvents([]);
          setAwards([]);
          setCharacterStats([]);

          // Save initial state to database immediately so followers can load it
          // Use direct save (not throttled) to ensure it's saved right away
          const { saveCivilizationSession } = await import('@/lib/civilization/civilizationDatabase');
          const initialSessionState: CivilizationSessionState = {
            agents: rankedAgents,
            currentTurn: 0,
            turnPhase: 'idle',
            currentViewIndex: 0,
            events: [],
            awards: [],
            characterStats: [],
            stats: calculateStats(rankedAgents),
          };
          const saved = await saveCivilizationSession(initialSessionState, syncProviderRef.current?.viewerId || null);
          console.log('[Civilization] Saved initial state to database:', saved);
        } else {
          console.log('[Civilization] We are follower, waiting for state from leader...');
          const { loadCivilizationSession, claimLeadership, saveCivilizationSession } = await import('@/lib/civilization/civilizationDatabase');

          // Try loading from database a few times - faster iterations
          const INITIAL_ATTEMPTS = 3; // 3 attempts * 1s = 3s initial wait
          let foundState = false;

          for (let attempt = 1; attempt <= INITIAL_ATTEMPTS; attempt++) {
            // Check if we received state via broadcast while waiting
            if (agentsRef.current.length > 0) {
              console.log('[Civilization] Received state from broadcast, done waiting');
              foundState = true;
              break;
            }

            console.log('[Civilization] Attempt', attempt, '/', INITIAL_ATTEMPTS, '- trying to load state from database...');
            const dbState = await loadCivilizationSession();

            if (dbState?.state && dbState.state.agents && dbState.state.agents.length > 0) {
              console.log('[Civilization] Loaded state from database, turn:', dbState.state.currentTurn, 'agents:', dbState.state.agents.length);
              applyFullState(dbState.state);
              foundState = true;
              break;
            } else {
              console.log('[Civilization] No valid state in database yet, retrying in 1s...');
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }

          // If still no state after initial attempts, use fallback immediately
          // This prevents the second viewer from getting stuck
          if (!foundState && agentsRef.current.length === 0) {
            console.log('[Civilization] No state found, initializing fresh as fallback (will sync on next turn)');

            // Initialize fresh state for display
            // This viewer will sync with leader on next turn update
            const freshAgents = initializeAgents();
            const rankedAgents = updateRankings(freshAgents);
            setAgents(rankedAgents);
            setCurrentTurn(0);
            setCurrentViewIndex(0);
            setTurnPhase('idle');
            setTimeRemaining(TURN_DURATION_MS);
            setProcessingProgress(0);
            setEvents([]);
            setGameEvents([]);
            setAwards([]);
            setCharacterStats([]);

            // Don't save to DB - we're not the leader
            // The next turn update from leader will trigger a DB reload and sync us
            console.log('[Civilization] Fallback initialization complete - will sync on next turn');
          }
        }
      }
    } catch (e) {
      console.error('[Civilization] Failed to connect to sync:', e);
      console.log('[Civilization] Falling back to local-only mode');
      // Fallback to local-only mode
      const initialAgents = initializeAgents();
      const rankedAgents = updateRankings(initialAgents);
      setAgents(rankedAgents);
      setCurrentTurn(0);
      setCurrentViewIndex(0);
      setTurnPhase('idle');
      setTimeRemaining(TURN_DURATION_MS);
      setProcessingProgress(0);
      setIsLeader(true); // Local mode = always leader
      isLeaderRef.current = true;
      setIsConnected(false);
      setViewerCount(1);
      console.log('[Civilization] Local mode initialized, isLeader=true');
    }
  }, [applyFullState, applyTurnUpdate]);

  // ============================================================================
  // TURN PROCESSING
  // ============================================================================

  const advanceTurn = useCallback(async () => {
    // Only leaders can advance turns
    if (!isLeaderRef.current) return;
    if (isProcessingRef.current || agents.length === 0) return;

    isProcessingRef.current = true;
    setTurnPhase('thinking');
    setProcessingProgress(0);

    // Store previous state for event comparison
    previousAgentsRef.current = agents;

    try {
      // Process turn with progress callback
      const updatedAgents = await processTurn(agents, {
        onBatchComplete: (processed, total) => {
          setProcessingProgress(Math.round((processed / total) * 100));
        },
      });

      // Generate random game events (disasters, booms, etc.)
      const newTurn = currentTurn + 1;
      const newGameEvents = generateGameEvents(updatedAgents, newTurn);

      // Apply game event effects to agents
      const agentsAfterEvents = applyEventEffects(updatedAgents, newGameEvents);

      // Update rankings
      const rankedAgents = updateRankings(agentsAfterEvents);

      // Generate civilization events by comparing old and new state
      const newEvents = generateEvents(previousAgentsRef.current, rankedAgents, newTurn);

      // Calculate awards and character stats
      const newAwards = calculateAwards(rankedAgents);
      const newCharacterStats = calculateCharacterStats(rankedAgents);
      const newStats = calculateStats(rankedAgents);

      // Update state
      setAgents(rankedAgents);
      setCurrentTurn(newTurn);
      setTimeRemaining(TURN_DURATION_MS / speedMultiplier);
      setTurnPhase('idle');

      // Add new events (keep last 20)
      const mergedEvents = newEvents.length > 0
        ? [...newEvents, ...events].slice(0, 20)
        : events;
      if (newEvents.length > 0) {
        setEvents(mergedEvents);
      }

      // Update game events (keep last 10)
      if (newGameEvents.length > 0) {
        setGameEvents(prev => [...newGameEvents, ...prev].slice(0, 10));
      }

      setAwards(newAwards);
      setCharacterStats(newCharacterStats);

      // Sync with followers: Save state to database FIRST, then notify
      if (syncProviderRef.current) {
        const sessionState: CivilizationSessionState = {
          agents: rankedAgents,
          currentTurn: newTurn,
          turnPhase: 'idle',
          currentViewIndex: currentViewIndexRef.current,
          events: mergedEvents,
          awards: newAwards,
          characterStats: newCharacterStats,
          stats: newStats,
        };

        // Save to database immediately (not throttled) so followers can reload
        const { saveCivilizationSession } = await import('@/lib/civilization/civilizationDatabase');
        await saveCivilizationSession(sessionState, syncProviderRef.current.viewerId);

        // Broadcast lightweight notification telling followers to reload from database
        const turnUpdate: CivilizationTurnUpdate = {
          turn: newTurn,
          timestamp: Date.now(),
          turnPhase: 'idle',
          currentViewIndex: currentViewIndexRef.current,
          reloadFromDb: true, // Signal followers to reload full state from database
        };
        syncProviderRef.current.broadcastTurnUpdate(turnUpdate);
      }
    } catch (error) {
      console.error('Turn processing error:', error);
      setTurnPhase('idle');
    } finally {
      isProcessingRef.current = false;
      setProcessingProgress(0);
    }
  }, [agents, currentTurn, speedMultiplier, events]);

  // ============================================================================
  // CAMERA CONTROLS
  // ============================================================================

  const setViewIndex = useCallback((index: number) => {
    if (index >= 0 && index < agents.length) {
      setCurrentViewIndex(index);
    }
  }, [agents.length]);

  const nextCity = useCallback(() => {
    setCurrentViewIndex(prev => (prev + 1) % Math.max(1, agents.length));
  }, [agents.length]);

  const prevCity = useCallback(() => {
    setCurrentViewIndex(prev => (prev - 1 + agents.length) % Math.max(1, agents.length));
  }, [agents.length]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const goToCity = useCallback((agentId: number) => {
    const index = agents.findIndex(a => a.agentId === agentId);
    if (index !== -1) {
      setCurrentViewIndex(index);
    }
  }, [agents]);

  // ============================================================================
  // AUTO-ADVANCE TIMER (only for leaders)
  // ============================================================================

  useEffect(() => {
    // Only leaders run the auto-advance timer
    if (!isLeader) return;
    if (!autoAdvance || agents.length === 0 || turnPhase !== 'idle') {
      return;
    }

    const effectiveDuration = TURN_DURATION_MS / speedMultiplier;

    // Countdown timer (updates every second, adjusted for speed)
    const countdownInterval = setInterval(() => {
      setTimeRemaining(prev => {
        const decrement = 1000 * speedMultiplier;
        const next = prev - decrement;
        if (next <= 0) {
          advanceTurn();
          return effectiveDuration;
        }
        return next;
      });
    }, 1000);

    return () => {
      clearInterval(countdownInterval);
    };
  }, [isLeader, autoAdvance, agents.length, turnPhase, advanceTurn, speedMultiplier]);

  // ============================================================================
  // AUTO-CYCLE CAMERA (only for leaders - followers sync from leader)
  // ============================================================================

  useEffect(() => {
    // Only leaders control the camera cycle
    if (!isLeader) {
      if (cameraTimerRef.current) {
        clearInterval(cameraTimerRef.current);
        cameraTimerRef.current = null;
      }
      return;
    }

    if (!autoCycleCamera || agents.length === 0) {
      if (cameraTimerRef.current) {
        clearInterval(cameraTimerRef.current);
        cameraTimerRef.current = null;
      }
      return;
    }

    cameraTimerRef.current = setInterval(() => {
      setCurrentViewIndex(prev => {
        const newIndex = (prev + 1) % agents.length;
        // Broadcast camera change to followers
        if (syncProviderRef.current) {
          syncProviderRef.current.broadcastCameraChange(newIndex);
        }
        return newIndex;
      });
    }, CAMERA_CYCLE_MS);

    return () => {
      if (cameraTimerRef.current) {
        clearInterval(cameraTimerRef.current);
        cameraTimerRef.current = null;
      }
    };
  }, [isLeader, autoCycleCamera, agents.length]);

  // ============================================================================
  // CLEANUP
  // ============================================================================

  useEffect(() => {
    return () => {
      if (turnTimerRef.current) {
        clearInterval(turnTimerRef.current);
      }
      if (cameraTimerRef.current) {
        clearInterval(cameraTimerRef.current);
      }
      // Clean up sync provider
      if (syncProviderRef.current) {
        syncProviderRef.current.destroy();
        syncProviderRef.current = null;
      }
    };
  }, []);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const value: AgentCivilizationContextValue = {
    agents,
    currentTurn,
    currentViewIndex,
    turnPhase,
    autoAdvance,
    autoCycleCamera,
    timeRemaining,
    processingProgress,
    speedMultiplier,
    isLeader,
    isConnected,
    viewerCount,
    events,
    gameEvents,
    awards,
    characterStats,
    currentAgent,
    topAgents,
    stats,
    initialize,
    advanceTurn,
    setViewIndex,
    setAutoAdvance,
    setAutoCycleCamera,
    setSpeedMultiplier,
    nextCity,
    prevCity,
    clearEvents,
    goToCity,
  };

  return (
    <AgentCivilizationContext.Provider value={value}>
      {children}
    </AgentCivilizationContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useAgentCivilization(): AgentCivilizationContextValue {
  const context = useContext(AgentCivilizationContext);
  if (!context) {
    throw new Error('useAgentCivilization must be used within AgentCivilizationProvider');
  }
  return context;
}
