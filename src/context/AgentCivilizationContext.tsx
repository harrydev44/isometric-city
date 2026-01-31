'use client';

/**
 * Context Provider for AI Civilization Mode
 *
 * Manages state for 200 AI agent cities, turn processing,
 * camera cycling, and leaderboard.
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
} from '@/types/civilization';
import {
  initializeAgents,
  processTurn,
  updateRankings,
  getTopAgents,
  calculateStats,
  CivilizationStats,
} from '@/lib/turnManager';

const { TURN_DURATION_MS, CAMERA_CYCLE_MS, TOP_LEADERBOARD_COUNT } = CIVILIZATION_CONSTANTS;

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

  // Derived
  currentAgent: AgentCity | null;
  topAgents: AgentCity[];
  stats: CivilizationStats;

  // Actions
  initialize: () => void;
  advanceTurn: () => Promise<void>;
  setViewIndex: (index: number) => void;
  setAutoAdvance: (auto: boolean) => void;
  setAutoCycleCamera: (auto: boolean) => void;
  nextCity: () => void;
  prevCity: () => void;
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

  // Refs for intervals
  const turnTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cameraTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);

  // Derived state
  const currentAgent = agents.length > 0 ? agents[currentViewIndex] : null;
  const topAgents = agents.length > 0 ? getTopAgents(agents, TOP_LEADERBOARD_COUNT) : [];
  const stats = agents.length > 0 ? calculateStats(agents) : defaultStats;

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  const initialize = useCallback(() => {
    const initialAgents = initializeAgents();
    const rankedAgents = updateRankings(initialAgents);
    setAgents(rankedAgents);
    setCurrentTurn(0);
    setCurrentViewIndex(0);
    setTurnPhase('idle');
    setTimeRemaining(TURN_DURATION_MS);
    setProcessingProgress(0);
  }, []);

  // ============================================================================
  // TURN PROCESSING
  // ============================================================================

  const advanceTurn = useCallback(async () => {
    if (isProcessingRef.current || agents.length === 0) return;

    isProcessingRef.current = true;
    setTurnPhase('thinking');
    setProcessingProgress(0);

    try {
      // Process turn with progress callback
      const updatedAgents = await processTurn(agents, {
        onBatchComplete: (processed, total) => {
          setProcessingProgress(Math.round((processed / total) * 100));
        },
      });

      // Update rankings
      const rankedAgents = updateRankings(updatedAgents);

      setAgents(rankedAgents);
      setCurrentTurn(prev => prev + 1);
      setTimeRemaining(TURN_DURATION_MS);
      setTurnPhase('idle');
    } catch (error) {
      console.error('Turn processing error:', error);
      setTurnPhase('idle');
    } finally {
      isProcessingRef.current = false;
      setProcessingProgress(0);
    }
  }, [agents]);

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

  // ============================================================================
  // AUTO-ADVANCE TIMER
  // ============================================================================

  useEffect(() => {
    if (!autoAdvance || agents.length === 0 || turnPhase !== 'idle') {
      return;
    }

    // Countdown timer (updates every second)
    const countdownInterval = setInterval(() => {
      setTimeRemaining(prev => {
        const next = prev - 1000;
        if (next <= 0) {
          advanceTurn();
          return TURN_DURATION_MS;
        }
        return next;
      });
    }, 1000);

    return () => {
      clearInterval(countdownInterval);
    };
  }, [autoAdvance, agents.length, turnPhase, advanceTurn]);

  // ============================================================================
  // AUTO-CYCLE CAMERA
  // ============================================================================

  useEffect(() => {
    if (!autoCycleCamera || agents.length === 0) {
      if (cameraTimerRef.current) {
        clearInterval(cameraTimerRef.current);
        cameraTimerRef.current = null;
      }
      return;
    }

    cameraTimerRef.current = setInterval(() => {
      setCurrentViewIndex(prev => (prev + 1) % agents.length);
    }, CAMERA_CYCLE_MS);

    return () => {
      if (cameraTimerRef.current) {
        clearInterval(cameraTimerRef.current);
        cameraTimerRef.current = null;
      }
    };
  }, [autoCycleCamera, agents.length]);

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
    currentAgent,
    topAgents,
    stats,
    initialize,
    advanceTurn,
    setViewIndex,
    setAutoAdvance,
    setAutoCycleCamera,
    nextCity,
    prevCity,
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
