// Multiplayer sync hook for IsoCoaster

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useCoasterMultiplayerOptional } from '@/context/CoasterMultiplayerContext';
import { useCoaster } from '@/context/CoasterContext';
import { CoasterGameAction, CoasterGameActionInput } from '@/lib/multiplayer/coasterTypes';
import { Tool, GameState } from '@/games/coaster/types';
import {
  buildSavedParkMeta,
  readSavedParksIndex,
  upsertSavedParkMeta,
  writeSavedParksIndex,
} from '@/games/coaster/saveUtils';

// Batch placement buffer for reducing message count during drags
const BATCH_FLUSH_INTERVAL = 100; // ms - flush every 100ms during drag
const BATCH_MAX_SIZE = 100; // Max placements before force flush

// Update the saved parks index with the current multiplayer park state
function updateSavedParksIndex(state: GameState, roomCode: string): void {
  if (typeof window === 'undefined') return;
  try {
    const meta = buildSavedParkMeta(state, Date.now(), roomCode);
    const updated = upsertSavedParkMeta(meta, readSavedParksIndex());
    writeSavedParksIndex(updated.slice(0, 20));
  } catch (e) {
    console.error('Failed to update saved parks index:', e);
  }
}

export function useCoasterMultiplayerSync() {
  const multiplayer = useCoasterMultiplayerOptional();
  const coaster = useCoaster();
  const lastActionRef = useRef<string | null>(null);
  const initialStateLoadedRef = useRef(false);

  // Batching for placements - use refs to avoid stale closures
  const placementBufferRef = useRef<Array<{ x: number; y: number; tool: Tool }>>([]);
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const multiplayerRef = useRef(multiplayer);

  // Keep multiplayer ref updated
  useEffect(() => {
    multiplayerRef.current = multiplayer;
  }, [multiplayer]);

  // Load initial state when joining a room (received from other players)
  // This can happen even if we already loaded from cache - network state takes priority
  const lastInitialStateRef = useRef<string | null>(null);
  useEffect(() => {
    if (!multiplayer || !multiplayer.initialState) return;

    const stateKey = JSON.stringify(multiplayer.initialState.tick || 0);
    if (lastInitialStateRef.current === stateKey && initialStateLoadedRef.current) return;

    console.log('[useCoasterMultiplayerSync] Received initial state from network, loading...');

    const stateString = JSON.stringify(multiplayer.initialState);
    const success = coaster.loadState(stateString);

    if (success) {
      initialStateLoadedRef.current = true;
      lastInitialStateRef.current = stateKey;
    }
  }, [multiplayer?.initialState, coaster]);

  // Apply a remote action to the local game state
  const applyRemoteAction = useCallback((action: CoasterGameAction) => {
    if (!action || !action.type) {
      console.warn('[useCoasterMultiplayerSync] Received invalid action:', action);
      return;
    }

    switch (action.type) {
      case 'place': {
        const currentTool = coaster.state.selectedTool;
        coaster.setTool(action.tool);
        coaster.placeAtTile(action.x, action.y, true);
        coaster.setTool(currentTool);
        break;
      }

      case 'placeBatch': {
        const originalTool = coaster.state.selectedTool;
        for (const placement of action.placements) {
          coaster.setTool(placement.tool);
          coaster.placeAtTile(placement.x, placement.y, true);
        }
        coaster.setTool(originalTool);
        break;
      }

      case 'bulldoze':
        coaster.bulldozeTile(action.x, action.y, true);
        break;

      case 'setSpeed':
        coaster.setSpeed(action.speed, true);
        break;

      case 'setParkSettings':
        coaster.setParkSettings(action.settings, true);
        break;

      case 'startCoasterBuild':
        coaster.startCoasterBuild(action.coasterType, action.coasterId, true);
        break;

      case 'finishCoasterBuild':
        coaster.finishCoasterBuild(true);
        break;

      case 'cancelCoasterBuild':
        coaster.cancelCoasterBuild(true);
        break;

      case 'fullState':
        break;
    }
  }, [coaster]);

  // Register callback to receive remote actions
  useEffect(() => {
    if (!multiplayer) return;

    multiplayer.setOnRemoteAction((action: CoasterGameAction) => {
      applyRemoteAction(action);
    });

    return () => {
      multiplayer.setOnRemoteAction(null);
    };
  }, [multiplayer, applyRemoteAction]);

  // Flush batched placements - uses ref to avoid stale closure issues
  const flushPlacements = useCallback(() => {
    const mp = multiplayerRef.current;
    if (!mp || placementBufferRef.current.length === 0) return;

    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }

    const placements = [...placementBufferRef.current];
    placementBufferRef.current = [];

    if (placements.length === 1) {
      const p = placements[0];
      mp.dispatchAction({ type: 'place', x: p.x, y: p.y, tool: p.tool });
    } else {
      mp.dispatchAction({ type: 'placeBatch', placements });
    }
  }, []);

  // Register callback to broadcast local placements (with batching)
  useEffect(() => {
    if (!multiplayer || multiplayer.connectionState !== 'connected') {
      coaster.setPlaceCallback(null);
      if (placementBufferRef.current.length > 0) {
        placementBufferRef.current = [];
      }
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = null;
      }
      return;
    }

    coaster.setPlaceCallback(({ x, y, tool }: { x: number; y: number; tool: Tool }) => {
      placementBufferRef.current.push({ x, y, tool });

      if (placementBufferRef.current.length >= BATCH_MAX_SIZE) {
        flushPlacements();
      } else if (!flushTimeoutRef.current) {
        flushTimeoutRef.current = setTimeout(() => {
          flushTimeoutRef.current = null;
          flushPlacements();
        }, BATCH_FLUSH_INTERVAL);
      }
    });

    return () => {
      flushPlacements();
      coaster.setPlaceCallback(null);
    };
  }, [multiplayer, multiplayer?.connectionState, coaster, flushPlacements]);

  // Register callback to broadcast local bulldozes
  useEffect(() => {
    if (!multiplayer || multiplayer.connectionState !== 'connected') {
      coaster.setBulldozeCallback(null);
      return;
    }

    coaster.setBulldozeCallback(({ x, y }) => {
      multiplayer.dispatchAction({ type: 'bulldoze', x, y });
    });

    return () => {
      coaster.setBulldozeCallback(null);
    };
  }, [multiplayer, multiplayer?.connectionState, coaster]);

  // Register callback to broadcast coaster build actions
  useEffect(() => {
    if (!multiplayer || multiplayer.connectionState !== 'connected') {
      coaster.setCoasterBuildCallback(null);
      return;
    }

    coaster.setCoasterBuildCallback((action) => {
      if (action.type === 'start') {
        multiplayer.dispatchAction({
          type: 'startCoasterBuild',
          coasterId: action.coasterId,
          coasterType: action.coasterType,
        });
      } else if (action.type === 'finish') {
        multiplayer.dispatchAction({ type: 'finishCoasterBuild' });
      } else if (action.type === 'cancel') {
        multiplayer.dispatchAction({ type: 'cancelCoasterBuild' });
      }
    });

    return () => {
      coaster.setCoasterBuildCallback(null);
    };
  }, [multiplayer, multiplayer?.connectionState, coaster]);

  // Register callback to broadcast speed changes
  useEffect(() => {
    if (!multiplayer || multiplayer.connectionState !== 'connected') {
      coaster.setSpeedCallback(null);
      return;
    }

    coaster.setSpeedCallback((speed) => {
      multiplayer.dispatchAction({ type: 'setSpeed', speed });
    });

    return () => {
      coaster.setSpeedCallback(null);
    };
  }, [multiplayer, multiplayer?.connectionState, coaster]);

  // Register callback to broadcast park setting changes
  useEffect(() => {
    if (!multiplayer || multiplayer.connectionState !== 'connected') {
      coaster.setParkSettingsCallback(null);
      return;
    }

    coaster.setParkSettingsCallback((settings) => {
      multiplayer.dispatchAction({ type: 'setParkSettings', settings });
    });

    return () => {
      coaster.setParkSettingsCallback(null);
    };
  }, [multiplayer, multiplayer?.connectionState, coaster]);

  // Keep the game state synced with the Supabase database
  // The provider handles throttling internally (saves every 3 seconds max)
  // Also updates the local saved parks index so the park appears on the homepage
  const lastUpdateRef = useRef<number>(0);
  const lastIndexUpdateRef = useRef<number>(0);
  useEffect(() => {
    if (!multiplayer || multiplayer.connectionState !== 'connected') return;

    const now = Date.now();
    if (now - lastUpdateRef.current < 2000) return; // Throttle to 2 second intervals
    lastUpdateRef.current = now;

    multiplayer.updateGameState(coaster.state);

    if (multiplayer.roomCode && now - lastIndexUpdateRef.current > 10000) {
      lastIndexUpdateRef.current = now;
      updateSavedParksIndex(coaster.state, multiplayer.roomCode);
    }
  }, [multiplayer, coaster.state]);

  // Broadcast a local action to peers
  const broadcastAction = useCallback((action: CoasterGameActionInput) => {
    if (!multiplayer || multiplayer.connectionState !== 'connected') return;

    const actionKey = JSON.stringify(action);
    if (lastActionRef.current === actionKey) return;
    lastActionRef.current = actionKey;

    setTimeout(() => {
      if (lastActionRef.current === actionKey) {
        lastActionRef.current = null;
      }
    }, 100);

    multiplayer.dispatchAction(action);
  }, [multiplayer]);

  const isMultiplayer = multiplayer?.connectionState === 'connected';
  const isHost = multiplayer?.isHost ?? false;
  const playerCount = multiplayer?.players.length ?? 0;
  const roomCode = multiplayer?.roomCode ?? null;
  const connectionState = multiplayer?.connectionState ?? 'disconnected';

  return {
    isMultiplayer,
    isHost,
    playerCount,
    roomCode,
    connectionState,
    players: multiplayer?.players ?? [],
    broadcastAction,
    leaveRoom: multiplayer?.leaveRoom ?? (() => {}),
  };
}
