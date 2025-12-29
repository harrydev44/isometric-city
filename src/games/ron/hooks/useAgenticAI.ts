/**
 * Rise of Nations - Agentic AI Hook
 * 
 * React hook that manages the agentic AI system.
 * The AI runs continuously and controls its own pacing via wait_ticks.
 * Only re-triggers if the AI stops or encounters errors.
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { RoNGameState } from '../types/game';

export interface AgenticAIConfig {
  enabled: boolean;
  aiPlayerId: string;
  actionInterval: number; // Base ticks between AI turns (AI can override with wait_ticks)
}

export interface AgenticAIMessage {
  id: string;
  message: string;
  timestamp: number;
  isRead: boolean;
}

export interface UseAgenticAIResult {
  messages: AgenticAIMessage[];
  isThinking: boolean;
  lastError: string | null;
  thoughts: string | null;
  markMessageRead: (messageId: string) => void;
  clearMessages: () => void;
}

// Backoff configuration
const MIN_POLL_INTERVAL_MS = 15000;  // 15 seconds minimum between polls
const MAX_POLL_INTERVAL_MS = 120000; // 2 minutes max backoff
const RATE_LIMIT_BACKOFF_MULTIPLIER = 2;

/**
 * Hook to run the agentic AI system
 */
export function useAgenticAI(
  gameState: RoNGameState,
  setGameState: (updater: (prev: RoNGameState) => RoNGameState) => void,
  config: AgenticAIConfig
): UseAgenticAIResult {
  const [messages, setMessages] = useState<AgenticAIMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [thoughts, setThoughts] = useState<string | null>(null);
  
  // Refs to track state without causing re-renders
  const lastActionTickRef = useRef(0);
  const isProcessingRef = useRef(false);
  const responseIdRef = useRef<string | undefined>(undefined);
  const latestStateRef = useRef(gameState);
  
  // Backoff and pacing refs
  const currentBackoffRef = useRef(MIN_POLL_INTERVAL_MS);
  const waitUntilTickRef = useRef(0); // AI-requested wait via wait_ticks tool
  const consecutiveErrorsRef = useRef(0);
  const lastPollTimeRef = useRef(0);
  
  // Keep latest state ref updated
  useEffect(() => {
    latestStateRef.current = gameState;
  }, [gameState]);

  // Process an AI turn
  const processAITurn = useCallback(async () => {
    if (isProcessingRef.current) return;
    if (!config.enabled) return;
    
    const state = latestStateRef.current;
    const now = Date.now();
    
    // Check if game is paused or over
    if (state.gameSpeed === 0 || state.gameOver) return;
    
    // Respect minimum poll interval (prevents hammering API)
    if (now - lastPollTimeRef.current < currentBackoffRef.current) return;
    
    // Respect AI-requested wait (from wait_ticks tool)
    if (state.tick < waitUntilTickRef.current) return;
    
    // Check if enough ticks have passed since last action
    if (state.tick - lastActionTickRef.current < config.actionInterval) return;
    
    // Check if AI player exists and isn't defeated
    const aiPlayer = state.players.find(p => p.id === config.aiPlayerId);
    if (!aiPlayer || aiPlayer.isDefeated) return;

    isProcessingRef.current = true;
    setIsThinking(true);
    lastActionTickRef.current = state.tick;
    lastPollTimeRef.current = now;

    console.log('[Agentic AI] Requesting turn at tick', state.tick, '(backoff:', currentBackoffRef.current, 'ms)');

    try {
      const response = await fetch('/api/ron-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameState: state,
          aiPlayerId: config.aiPlayerId,
          previousResponseId: responseIdRef.current,
        }),
      });

      const result = await response.json();

      // Check for rate limit error
      if (result.error?.includes('rate_limit') || response.status === 429) {
        consecutiveErrorsRef.current++;
        currentBackoffRef.current = Math.min(
          currentBackoffRef.current * RATE_LIMIT_BACKOFF_MULTIPLIER,
          MAX_POLL_INTERVAL_MS
        );
        console.warn('[Agentic AI] Rate limited, backing off to', currentBackoffRef.current, 'ms');
        setLastError(`Rate limited - waiting ${Math.round(currentBackoffRef.current / 1000)}s`);
        return;
      }

      console.log('[Agentic AI] Response received:', {
        success: !result.error,
        messagesCount: result.messages?.length || 0,
        hasThoughts: !!result.thoughts,
        waitTicks: result.waitTicks,
      });

      if (result.error) {
        console.error('[Agentic AI] Error:', result.error);
        consecutiveErrorsRef.current++;
        // Increase backoff on errors
        currentBackoffRef.current = Math.min(
          currentBackoffRef.current * 1.5,
          MAX_POLL_INTERVAL_MS
        );
        setLastError(result.error);
      } else {
        // Success - reset backoff
        consecutiveErrorsRef.current = 0;
        currentBackoffRef.current = MIN_POLL_INTERVAL_MS;
        setLastError(null);
        
        // Update response ID for conversation continuity
        if (result.responseId) {
          responseIdRef.current = result.responseId;
        }

        // Respect AI-requested wait ticks
        if (result.waitTicks && result.waitTicks > 0) {
          waitUntilTickRef.current = state.tick + result.waitTicks;
          console.log('[Agentic AI] AI requested wait until tick', waitUntilTickRef.current);
        }

        // Store AI thoughts
        if (result.thoughts) {
          setThoughts(result.thoughts);
        }

        // Add any messages from the AI
        if (result.messages && result.messages.length > 0) {
          setMessages(prev => [
            ...prev,
            ...result.messages.map((msg: string) => ({
              id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              message: msg,
              timestamp: Date.now(),
              isRead: false,
            })),
          ]);
        }

        // Update game state with AI's changes
        if (result.newState && result.newState.tick) {
          setGameState(() => result.newState);
          latestStateRef.current = result.newState;
        }
      }
    } catch (error) {
      console.error('[Agentic AI] Network error:', error);
      consecutiveErrorsRef.current++;
      currentBackoffRef.current = Math.min(
        currentBackoffRef.current * 1.5,
        MAX_POLL_INTERVAL_MS
      );
      setLastError(error instanceof Error ? error.message : 'Network error');
    } finally {
      isProcessingRef.current = false;
      setIsThinking(false);
    }
  }, [config.enabled, config.aiPlayerId, config.actionInterval, setGameState]);

  // Run AI turn check on a timer - checks every 5 seconds but respects backoff
  useEffect(() => {
    if (!config.enabled) return;

    // Poll at 5 second intervals, but processAITurn respects the backoff
    const interval = setInterval(() => {
      processAITurn();
    }, 5000);

    // Trigger initial turn
    const initialDelay = setTimeout(() => {
      processAITurn();
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(initialDelay);
    };
  }, [config.enabled, processAITurn]);

  // Mark a message as read
  const markMessageRead = useCallback((messageId: string) => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId ? { ...msg, isRead: true } : msg
      )
    );
  }, []);

  // Clear all messages
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isThinking,
    lastError,
    thoughts,
    markMessageRead,
    clearMessages,
  };
}
