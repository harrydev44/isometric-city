'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useCoasterMultiplayerOptional } from '@/context/CoasterMultiplayerContext';
import { useCoaster } from '@/context/CoasterContext';
import { CoasterGameAction, CoasterGameActionInput } from '@/lib/multiplayer/coasterTypes';
import { Tool, GameState, ParkSettings } from '@/games/coaster/types';
import {
  COASTER_SAVED_PARKS_INDEX_KEY,
  SavedParkMeta,
  buildSavedParkMeta,
} from '@/games/coaster/saveUtils';

// Batch placement buffer for reducing message count during drags
const BATCH_FLUSH_INTERVAL = 100; // ms
const BATCH_MAX_SIZE = 100;

// Update the saved parks index with the current multiplayer park state
function updateSavedParksIndex(state: GameState, roomCode: string): void {
  if (typeof window === 'undefined') return;
  try {
    const saved = localStorage.getItem(COASTER_SAVED_PARKS_INDEX_KEY);
    const parks: SavedParkMeta[] = saved ? JSON.parse(saved) : [];
    
    const parkMeta = buildSavedParkMeta(state);
    // Add roomCode to track multiplayer parks (extend the meta)
    const parkMetaWithRoom = {
      ...parkMeta,
      roomCode,
    };
    
    // Find and update or add
    const existingIndex = parks.findIndex((p: SavedParkMeta & { roomCode?: string }) => 
      p.roomCode === roomCode || p.id === parkMeta.id
    );
    if (existingIndex >= 0) {
      parks[existingIndex] = parkMetaWithRoom;
    } else {
      parks.unshift(parkMetaWithRoom);
    }
    
    localStorage.setItem(COASTER_SAVED_PARKS_INDEX_KEY, JSON.stringify(parks.slice(0, 20)));
  } catch (e) {
    console.error('Failed to update saved parks index:', e);
  }
}

/**
 * Hook to sync coaster game actions with multiplayer.
 */
export function useCoasterMultiplayerSync() {
  const multiplayer = useCoasterMultiplayerOptional();
  const coaster = useCoaster();
  const lastActionRef = useRef<string | null>(null);
  const initialStateLoadedRef = useRef(false);
  
  // Batching for placements
  const placementBufferRef = useRef<Array<{ x: number; y: number; tool: Tool }>>([]);
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const multiplayerRef = useRef(multiplayer);
  
  useEffect(() => {
    multiplayerRef.current = multiplayer;
  }, [multiplayer]);

  // Load initial state when joining a room
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
        coaster.placeAtTile(action.x, action.y);
        coaster.setTool(currentTool);
        break;
      }
        
      case 'placeBatch': {
        const originalTool = coaster.state.selectedTool;
        for (const placement of action.placements) {
          coaster.setTool(placement.tool);
          coaster.placeAtTile(placement.x, placement.y);
        }
        coaster.setTool(originalTool);
        break;
      }
        
      case 'bulldoze': {
        coaster.bulldozeTile(action.x, action.y);
        break;
      }
        
      case 'setSpeed':
        coaster.setSpeed(action.speed);
        break;
        
      case 'setParkSettings':
        coaster.setParkSettings(action.settings);
        break;
        
      case 'startCoasterBuild':
        coaster.startCoasterBuild(action.coasterType);
        break;
        
      case 'addCoasterTrack':
        coaster.addCoasterTrack(action.x, action.y);
        break;
        
      case 'finishCoasterBuild':
        coaster.finishCoasterBuild();
        break;
        
      case 'cancelCoasterBuild':
        coaster.cancelCoasterBuild();
        break;
        
      case 'placeTrackLine':
        coaster.placeTrackLine(action.tiles);
        break;
        
      case 'fullState':
      case 'tick':
        // Handled separately
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
  
  // Flush batched placements
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

  // Keep the game state synced with the Supabase database
  const lastUpdateRef = useRef<number>(0);
  const lastIndexUpdateRef = useRef<number>(0);
  useEffect(() => {
    if (!multiplayer || multiplayer.connectionState !== 'connected') return;
    
    const now = Date.now();
    if (now - lastUpdateRef.current < 2000) return;
    lastUpdateRef.current = now;
    
    multiplayer.updateGameState(coaster.state);
    
    // Also update the local saved parks index
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

  // Helper to broadcast a placement action
  const broadcastPlace = useCallback(({ x, y, tool }: { x: number; y: number; tool: Tool }) => {
    if (tool === 'bulldoze') {
      broadcastAction({ type: 'bulldoze', x, y });
    } else if (tool !== 'select') {
      broadcastAction({ type: 'place', x, y, tool });
    }
  }, [broadcastAction]);

  // Helper to broadcast speed change
  const broadcastSpeed = useCallback((speed: 0 | 1 | 2 | 3) => {
    broadcastAction({ type: 'setSpeed', speed });
  }, [broadcastAction]);

  // Helper to broadcast park settings change
  const broadcastParkSettings = useCallback((settings: Partial<ParkSettings>) => {
    broadcastAction({ type: 'setParkSettings', settings });
  }, [broadcastAction]);

  // Check if we're in multiplayer mode
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
    broadcastPlace,
    broadcastSpeed,
    broadcastParkSettings,
    broadcastAction,
    leaveRoom: multiplayer?.leaveRoom ?? (() => {}),
  };
}
