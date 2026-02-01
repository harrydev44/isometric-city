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

  // Refs for current state (used in callbacks)
  const agentsRef = useRef<AgentCity[]>([]);
  const currentTurnRef = useRef(0);
  const eventsRef = useRef<CivilizationEvent[]>([]);
  const awardsRef = useRef<CharacterAward[]>([]);
  const characterStatsRef = useRef<CharacterStats[]>([]);

  // Ref for current view index
  const currentViewIndexRef = useRef(0);

  // Keep refs in sync with state
  useEffect(() => { agentsRef.current = agents; }, [agents]);
  useEffect(() => { currentTurnRef.current = currentTurn; }, [currentTurn]);
  useEffect(() => { currentViewIndexRef.current = currentViewIndex; }, [currentViewIndex]);
  useEffect(() => { eventsRef.current = events; }, [events]);
  useEffect(() => { awardsRef.current = awards; }, [awards]);
  useEffect(() => { characterStatsRef.current = characterStats; }, [characterStats]);

  // Derived state
  const currentAgent = agents.length > 0 ? agents[currentViewIndex] : null;
  const topAgents = agents.length > 0 ? getTopAgents(agents, TOP_LEADERBOARD_COUNT) : [];
  const stats = agents.length > 0 ? calculateStats(agents) : defaultStats;

  // ============================================================================
  // APPLY TURN UPDATE FROM LEADER (for followers)
  // ============================================================================

  const applyTurnUpdate = useCallback((update: CivilizationTurnUpdate) => {
    // Only followers apply updates
    if (isLeaderRef.current) return;

    setAgents((prevAgents) => {
      if (prevAgents.length === 0) return prevAgents;

      // Create a map for quick lookups
      const updateMap = new Map(
        update.agentUpdates.map((u) => [u.agentId, u])
      );

      // Apply delta updates to each agent
      return prevAgents.map((agent) => {
        const agentUpdate = updateMap.get(agent.agentId);
        if (!agentUpdate) return agent;

        return {
          ...agent,
          rank: agentUpdate.rank,
          performance: agentUpdate.performance,
          lastDecision: agentUpdate.lastDecision,
        };
      });
    });

    setCurrentTurn(update.turn);
    setTurnPhase(update.turnPhase);
    setTimeRemaining(TURN_DURATION_MS);

    // Sync camera view from leader
    if (update.currentViewIndex !== undefined) {
      setCurrentViewIndex(update.currentViewIndex);
    }

    // Update events (keep last 20)
    if (update.events.length > 0) {
      setEvents((prev) => [...update.events, ...prev].slice(0, 20));
    }

    setAwards(update.awards);
    setCharacterStats(update.characterStats);
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
    setAwards(state.awards || []);
    setCharacterStats(state.characterStats || []);
    setTimeRemaining(TURN_DURATION_MS);
    setProcessingProgress(0);
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
        onCameraChange: (viewIndex) => {
          // Received camera change from leader
          if (!isLeaderRef.current) {
            setCurrentViewIndex(viewIndex);
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

      if (initialState) {
        // Load state from database
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
          if (syncProviderRef.current) {
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
            syncProviderRef.current.saveStateToDatabase(initialSessionState);
            console.log('[Civilization] Saved initial state to database');
          }
        } else {
          console.log('[Civilization] We are follower, waiting for state from leader...');
          // Wait for state from leader or database
          await new Promise(resolve => setTimeout(resolve, 3000));

          // If still no agents, try loading from database again
          if (agentsRef.current.length === 0) {
            console.log('[Civilization] Trying to load state from database...');
            const { loadCivilizationSession } = await import('@/lib/civilization/civilizationDatabase');
            const dbState = await loadCivilizationSession();
            if (dbState?.state) {
              console.log('[Civilization] Loaded state from database, turn:', dbState.state.currentTurn);
              applyFullState(dbState.state);
            } else {
              // Last resort: initialize fresh
              console.log('[Civilization] No state available, initializing fresh');
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
            }
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

      // Update rankings
      const rankedAgents = updateRankings(updatedAgents);

      // Generate events by comparing old and new state
      const newTurn = currentTurn + 1;
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
      setAwards(newAwards);
      setCharacterStats(newCharacterStats);

      // Broadcast turn update to followers
      if (syncProviderRef.current) {
        const turnUpdate: CivilizationTurnUpdate = {
          turn: newTurn,
          timestamp: Date.now(),
          turnPhase: 'idle',
          currentViewIndex: currentViewIndexRef.current,
          agentUpdates: rankedAgents.map((agent) => ({
            agentId: agent.agentId,
            rank: agent.rank,
            performance: agent.performance,
            lastDecision: agent.lastDecision,
          })),
          stats: newStats,
          events: newEvents,
          awards: newAwards,
          characterStats: newCharacterStats,
        };
        syncProviderRef.current.broadcastTurnUpdate(turnUpdate);

        // Save state to database (throttled)
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
        syncProviderRef.current.saveStateToDatabase(sessionState);
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
