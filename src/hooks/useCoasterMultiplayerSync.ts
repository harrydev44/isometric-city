'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useMultiplayerOptional } from '@/context/MultiplayerContext';
import { useCoaster } from '@/context/CoasterContext';
import { GameAction, GameActionInput } from '@/lib/multiplayer/types';
import { GameState, Tool } from '@/games/coaster/types';
import { BuildingType } from '@/games/coaster/types/buildings';
import {
  buildSavedParkMeta,
  readSavedParksIndex,
  upsertSavedParkMeta,
  writeSavedParksIndex,
} from '@/games/coaster/saveUtils';

// Batch placement buffer for reducing message count during drags
const BATCH_FLUSH_INTERVAL = 100; // ms - flush every 100ms during drag
const BATCH_MAX_SIZE = 100; // Max placements before force flush
const SAVED_PARKS_MAX = 20;

type CoasterPlacement = { x: number; y: number; tool: Tool; coasterId?: string; buildingType?: BuildingType };

function updateSavedParksIndex(state: GameState, roomCode: string): void {
  if (typeof window === 'undefined') return;
  try {
    const meta = buildSavedParkMeta(state, Date.now(), roomCode);
    const updated = upsertSavedParkMeta(meta, readSavedParksIndex());
    writeSavedParksIndex(updated.slice(0, SAVED_PARKS_MAX));
  } catch (e) {
    console.error('Failed to update saved parks index:', e);
  }
}

export function useCoasterMultiplayerSync() {
  const multiplayer = useMultiplayerOptional();
  const coaster = useCoaster();
  const lastActionRef = useRef<string | null>(null);
  const initialStateLoadedRef = useRef(false);

  // Batching for placements - use refs to avoid stale closures
  const placementBufferRef = useRef<CoasterPlacement[]>([]);
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const multiplayerRef = useRef(multiplayer);

  // Keep multiplayer ref updated
  useEffect(() => {
    multiplayerRef.current = multiplayer;
  }, [multiplayer]);

  // Load initial state when joining a room (received from other players)
  const lastInitialStateKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!multiplayer || !multiplayer.initialState) return;

    const stateKey = JSON.stringify(multiplayer.initialState.tick || 0);
    if (lastInitialStateKeyRef.current === stateKey && initialStateLoadedRef.current) return;

    const stateString = JSON.stringify(multiplayer.initialState);
    const success = coaster.loadState(stateString);
    if (success) {
      initialStateLoadedRef.current = true;
      lastInitialStateKeyRef.current = stateKey;
    }
  }, [multiplayer?.initialState, coaster]);

  // Apply a remote action to the local park state
  const applyRemoteAction = useCallback((action: GameAction) => {
    if (!action || !action.type) {
      console.warn('[useCoasterMultiplayerSync] Received invalid action:', action);
      return;
    }

    switch (action.type) {
      case 'coasterPlace': {
        const currentTool = coaster.state.selectedTool;
        coaster.setTool(action.tool);
        coaster.placeAtTile(action.x, action.y, {
          isRemote: true,
          coasterId: action.coasterId,
          buildingType: action.buildingType,
        });
        coaster.setTool(currentTool);
        break;
      }
      case 'coasterPlaceBatch': {
        const currentTool = coaster.state.selectedTool;
        for (const placement of action.placements) {
          coaster.setTool(placement.tool);
          coaster.placeAtTile(placement.x, placement.y, {
            isRemote: true,
            coasterId: placement.coasterId,
            buildingType: placement.buildingType,
          });
        }
        coaster.setTool(currentTool);
        break;
      }
      case 'coasterBulldoze':
        coaster.bulldozeTile(action.x, action.y, { isRemote: true });
        break;
      case 'coasterBuildStart':
        coaster.startCoasterBuild(action.coasterType, { isRemote: true, coasterId: action.coasterId });
        break;
      case 'coasterBuildFinish':
        coaster.finishCoasterBuild({ isRemote: true });
        break;
      case 'coasterBuildCancel':
        coaster.cancelCoasterBuild({ isRemote: true });
        break;
      case 'coasterSetSpeed':
        coaster.setSpeed(action.speed, { isRemote: true });
        break;
      case 'coasterSetParkSettings':
        coaster.setParkSettings(action.settings, { isRemote: true });
        break;
      case 'coasterAddMoney':
        coaster.addMoney(action.amount, { isRemote: true });
        break;
      case 'coasterClearGuests':
        coaster.clearGuests({ isRemote: true });
        break;
      default:
        break;
    }
  }, [coaster]);

  // Register callback to receive remote actions
  useEffect(() => {
    if (!multiplayer) return;

    multiplayer.setOnRemoteAction((action: GameAction) => {
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
      mp.dispatchAction({
        type: 'coasterPlace',
        x: p.x,
        y: p.y,
        tool: p.tool,
        coasterId: p.coasterId,
        buildingType: p.buildingType,
      });
    } else {
      mp.dispatchAction({ type: 'coasterPlaceBatch', placements });
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

    coaster.setPlaceCallback((placement) => {
      if (placement.tool === 'bulldoze') {
        flushPlacements();
        multiplayer.dispatchAction({ type: 'coasterBulldoze', x: placement.x, y: placement.y });
        return;
      }

      placementBufferRef.current.push(placement);

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

  // Register callback to broadcast bulldoze actions
  useEffect(() => {
    if (!multiplayer || multiplayer.connectionState !== 'connected') {
      coaster.setBulldozeCallback(null);
      return;
    }

    coaster.setBulldozeCallback(({ x, y }) => {
      multiplayer.dispatchAction({ type: 'coasterBulldoze', x, y });
    });

    return () => {
      coaster.setBulldozeCallback(null);
    };
  }, [multiplayer, multiplayer?.connectionState, coaster]);

  // Register callback to broadcast coaster build lifecycle
  useEffect(() => {
    if (!multiplayer || multiplayer.connectionState !== 'connected') {
      coaster.setCoasterBuildCallback(null);
      return;
    }

    coaster.setCoasterBuildCallback((event) => {
      if (event.type === 'start') {
        multiplayer.dispatchAction({
          type: 'coasterBuildStart',
          coasterType: event.coasterType,
          coasterId: event.coasterId,
        });
      } else if (event.type === 'finish') {
        multiplayer.dispatchAction({ type: 'coasterBuildFinish' });
      } else if (event.type === 'cancel') {
        multiplayer.dispatchAction({ type: 'coasterBuildCancel' });
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
      multiplayer.dispatchAction({ type: 'coasterSetSpeed', speed });
    });

    return () => {
      coaster.setSpeedCallback(null);
    };
  }, [multiplayer, multiplayer?.connectionState, coaster]);

  // Register callback to broadcast park settings changes
  useEffect(() => {
    if (!multiplayer || multiplayer.connectionState !== 'connected') {
      coaster.setParkSettingsCallback(null);
      return;
    }

    coaster.setParkSettingsCallback((settings) => {
      multiplayer.dispatchAction({ type: 'coasterSetParkSettings', settings });
    });

    return () => {
      coaster.setParkSettingsCallback(null);
    };
  }, [multiplayer, multiplayer?.connectionState, coaster]);

  // Register callback to broadcast money adjustments
  useEffect(() => {
    if (!multiplayer || multiplayer.connectionState !== 'connected') {
      coaster.setAddMoneyCallback(null);
      return;
    }

    coaster.setAddMoneyCallback((amount) => {
      multiplayer.dispatchAction({ type: 'coasterAddMoney', amount });
    });

    return () => {
      coaster.setAddMoneyCallback(null);
    };
  }, [multiplayer, multiplayer?.connectionState, coaster]);

  // Register callback to broadcast guest clears
  useEffect(() => {
    if (!multiplayer || multiplayer.connectionState !== 'connected') {
      coaster.setClearGuestsCallback(null);
      return;
    }

    coaster.setClearGuestsCallback(() => {
      multiplayer.dispatchAction({ type: 'coasterClearGuests' });
    });

    return () => {
      coaster.setClearGuestsCallback(null);
    };
  }, [multiplayer, multiplayer?.connectionState, coaster]);

  // Keep the park state synced with the Supabase database
  const lastUpdateRef = useRef<number>(0);
  const lastIndexUpdateRef = useRef<number>(0);
  useEffect(() => {
    if (!multiplayer || multiplayer.connectionState !== 'connected') return;

    const now = Date.now();
    if (now - lastUpdateRef.current < 2000) return;
    lastUpdateRef.current = now;

    multiplayer.updateGameState(coaster.state);

    if (multiplayer.roomCode && now - lastIndexUpdateRef.current > 10000) {
      lastIndexUpdateRef.current = now;
      updateSavedParksIndex(coaster.state, multiplayer.roomCode);
    }
  }, [multiplayer, coaster.state]);

  const broadcastAction = useCallback((action: GameActionInput) => {
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
