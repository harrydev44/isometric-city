'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useCoasterMultiplayerOptional } from '@/context/CoasterMultiplayerContext';
import { useCoaster } from '@/context/CoasterContext';
import { CoasterGameAction, CoasterGameActionInput } from '@/lib/multiplayer/coasterTypes';
import { Tool } from '@/games/coaster/types';
import { ParkSettings } from '@/games/coaster/types/economy';
import { SavedParkMeta, COASTER_SAVED_PARKS_INDEX_KEY } from '@/games/coaster/saveUtils';

// Batch placement buffer for reducing message count during drags
const BATCH_FLUSH_INTERVAL = 100; // ms
const BATCH_MAX_SIZE = 100;

// Update the saved parks index with the current multiplayer park state
function updateSavedParksIndex(state: { 
  id: string; 
  settings: { name: string }; 
  stats: { guestsInPark: number; parkRating: number };
  finances: { cash: number };
  gridSize: number;
  year: number;
  month: number;
  day: number;
}, roomCode: string): void {
  if (typeof window === 'undefined') return;
  try {
    const saved = localStorage.getItem(COASTER_SAVED_PARKS_INDEX_KEY);
    const parks: SavedParkMeta[] = saved ? JSON.parse(saved) : [];
    
    const parkMeta: SavedParkMeta = {
      id: state.id || `park-${Date.now()}`,
      name: state.settings?.name || 'Co-op Park',
      cash: state.finances?.cash || 0,
      guests: state.stats?.guestsInPark || 0,
      rating: state.stats?.parkRating || 0,
      gridSize: state.gridSize || 60,
      year: state.year || 1,
      month: state.month || 1,
      day: state.day || 1,
      savedAt: Date.now(),
      roomCode: roomCode,
    };
    
    const existingIndex = parks.findIndex((p: SavedParkMeta) => p.roomCode === roomCode);
    if (existingIndex >= 0) {
      parks[existingIndex] = parkMeta;
    } else {
      parks.unshift(parkMeta);
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
  const game = useCoaster();
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
    const success = game.loadState(stateString);
    
    if (success) {
      initialStateLoadedRef.current = true;
      lastInitialStateRef.current = stateKey;
    }
  }, [multiplayer?.initialState, game]);

  // Apply a remote action to the local game state
  const applyRemoteAction = useCallback((action: CoasterGameAction) => {
    if (!action || !action.type) {
      console.warn('[useCoasterMultiplayerSync] Received invalid action:', action);
      return;
    }
    
    switch (action.type) {
      case 'place': {
        const currentTool = game.state.selectedTool;
        game.setTool(action.tool);
        game.placeAtTile(action.x, action.y);
        game.setTool(currentTool);
        break;
      }
        
      case 'placeBatch': {
        const originalTool = game.state.selectedTool;
        for (const placement of action.placements) {
          game.setTool(placement.tool);
          game.placeAtTile(placement.x, placement.y);
        }
        game.setTool(originalTool);
        break;
      }
        
      case 'bulldoze': {
        const savedTool = game.state.selectedTool;
        game.setTool('bulldoze');
        game.bulldozeTile(action.x, action.y);
        game.setTool(savedTool);
        break;
      }
        
      case 'placeTrackLine':
        game.placeTrackLine(action.tiles);
        break;
        
      case 'setSpeed':
        game.setSpeed(action.speed);
        break;
        
      case 'setParkSettings':
        game.setParkSettings(action.settings);
        break;
        
      case 'startCoasterBuild':
        game.startCoasterBuild(action.coasterType);
        break;
        
      case 'finishCoasterBuild':
        game.finishCoasterBuild();
        break;
        
      case 'cancelCoasterBuild':
        game.cancelCoasterBuild();
        break;
        
      case 'fullState':
        // Ignore - full state sync is handled separately
        break;
        
      case 'tick':
        // For now, rely on periodic full state syncs
        break;
    }
  }, [game]);

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

  // Keep the game state synced with the database
  const lastUpdateRef = useRef<number>(0);
  const lastIndexUpdateRef = useRef<number>(0);
  useEffect(() => {
    if (!multiplayer || multiplayer.connectionState !== 'connected') return;
    
    const now = Date.now();
    if (now - lastUpdateRef.current < 2000) return;
    lastUpdateRef.current = now;
    
    multiplayer.updateGameState(game.state);
    
    if (multiplayer.roomCode && now - lastIndexUpdateRef.current > 10000) {
      lastIndexUpdateRef.current = now;
      updateSavedParksIndex(game.state, multiplayer.roomCode);
    }
  }, [multiplayer, game.state]);

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
      flushPlacements();
      broadcastAction({ type: 'bulldoze', x, y });
    } else if (tool !== 'select') {
      // Add to batch
      placementBufferRef.current.push({ x, y, tool });
      
      if (placementBufferRef.current.length >= BATCH_MAX_SIZE) {
        flushPlacements();
      } else if (!flushTimeoutRef.current) {
        flushTimeoutRef.current = setTimeout(() => {
          flushTimeoutRef.current = null;
          flushPlacements();
        }, BATCH_FLUSH_INTERVAL);
      }
    }
  }, [broadcastAction, flushPlacements]);

  // Helper to broadcast speed change
  const broadcastSpeed = useCallback((speed: 0 | 1 | 2 | 3) => {
    broadcastAction({ type: 'setSpeed', speed });
  }, [broadcastAction]);

  // Helper to broadcast park settings change
  const broadcastParkSettings = useCallback((settings: Partial<ParkSettings>) => {
    broadcastAction({ type: 'setParkSettings', settings });
  }, [broadcastAction]);

  // Helper to broadcast track line placement
  const broadcastTrackLine = useCallback((tiles: { x: number; y: number }[]) => {
    broadcastAction({ type: 'placeTrackLine', tiles });
  }, [broadcastAction]);

  // Helper to broadcast coaster build start
  const broadcastStartCoasterBuild = useCallback((coasterType: string) => {
    broadcastAction({ type: 'startCoasterBuild', coasterType });
  }, [broadcastAction]);

  // Helper to broadcast coaster build finish
  const broadcastFinishCoasterBuild = useCallback(() => {
    broadcastAction({ type: 'finishCoasterBuild' });
  }, [broadcastAction]);

  // Helper to broadcast coaster build cancel
  const broadcastCancelCoasterBuild = useCallback(() => {
    broadcastAction({ type: 'cancelCoasterBuild' });
  }, [broadcastAction]);

  // Check if we're in multiplayer mode
  const isMultiplayer = multiplayer?.connectionState === 'connected';
  const isHost = multiplayer?.isHost ?? false;
  const playerCount = multiplayer?.players.length ?? 0;
  const roomCode = multiplayer?.roomCode ?? null;
  const displayCode = multiplayer?.displayCode ?? null;
  const connectionState = multiplayer?.connectionState ?? 'disconnected';

  return {
    isMultiplayer,
    isHost,
    playerCount,
    roomCode,
    displayCode,
    connectionState,
    players: multiplayer?.players ?? [],
    broadcastPlace,
    broadcastSpeed,
    broadcastParkSettings,
    broadcastTrackLine,
    broadcastStartCoasterBuild,
    broadcastFinishCoasterBuild,
    broadcastCancelCoasterBuild,
    broadcastAction,
    leaveRoom: multiplayer?.leaveRoom ?? (() => {}),
  };
}
