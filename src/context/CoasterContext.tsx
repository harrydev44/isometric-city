// CoasterContext for Rollercoaster Tycoon-style game
'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { compressToUTF16, decompressFromUTF16 } from 'lz-string';
import {
  CoasterParkState,
  CoasterTool,
  PanelType,
  RideType,
  SavedParkMeta,
} from '@/games/coaster/types';
import {
  createInitialCoasterState,
  DEFAULT_COASTER_GRID_SIZE,
  simulateCoasterTick,
} from '@/lib/coasterSimulation';

const STORAGE_KEY = 'coaster-game-state';
const SAVED_PARKS_INDEX_KEY = 'coaster-saved-parks-index';

type CoasterContextValue = {
  state: CoasterParkState;
  latestStateRef: React.RefObject<CoasterParkState>;
  setTool: (tool: CoasterTool) => void;
  setSpeed: (speed: 0 | 1 | 2 | 3) => void;
  setActivePanel: (panel: PanelType) => void;
  placeAtTile: (x: number, y: number) => void;
  buildRide: (rideType: RideType, x: number, y: number) => boolean;
  buildPath: (x: number, y: number) => void;
  setRidePrice: (rideId: string, price: number) => void;
  newGame: (name?: string, size?: number) => void;
  loadState: (stateString: string) => boolean;
  exportState: () => string;
  hasExistingGame: boolean;
  isStateReady: boolean;
  savedParks: SavedParkMeta[];
  savePark: () => void;
  loadSavedPark: (parkId: string) => boolean;
  deleteSavedPark: (parkId: string) => void;
};

const CoasterContext = createContext<CoasterContextValue | null>(null);

function loadCoasterState(): CoasterParkState | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;

    let jsonString = decompressFromUTF16(saved);
    if (!jsonString || !jsonString.startsWith('{')) {
      if (saved.startsWith('{')) {
        jsonString = saved;
      } else {
        return null;
      }
    }
    const parsed = JSON.parse(jsonString);
    if (parsed?.grid && parsed?.gridSize) {
      return parsed as CoasterParkState;
    }
    return null;
  } catch {
    return null;
  }
}

function saveCoasterState(state: CoasterParkState): void {
  if (typeof window === 'undefined') return;
  try {
    const compressed = compressToUTF16(JSON.stringify(state));
    localStorage.setItem(STORAGE_KEY, compressed);
  } catch (error) {
    console.error('Failed to save coaster state:', error);
  }
}

function loadSavedParks(): SavedParkMeta[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(SAVED_PARKS_INDEX_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? (parsed as SavedParkMeta[]) : [];
  } catch {
    return [];
  }
}

function saveSavedParks(parks: SavedParkMeta[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SAVED_PARKS_INDEX_KEY, JSON.stringify(parks));
  } catch (error) {
    console.error('Failed to save park index:', error);
  }
}

export function CoasterProvider({ children, startFresh = false }: { children: React.ReactNode; startFresh?: boolean }) {
  const [state, setState] = useState<CoasterParkState>(() =>
    createInitialCoasterState(DEFAULT_COASTER_GRID_SIZE, 'Coaster Park')
  );
  const [hasExistingGame, setHasExistingGame] = useState(false);
  const [isStateReady, setIsStateReady] = useState(false);
  const [savedParks, setSavedParks] = useState<SavedParkMeta[]>([]);
  const latestStateRef = useRef(state);
  const skipNextSaveRef = useRef(false);
  const stateChangedRef = useRef(false);

  useEffect(() => {
    if (!startFresh) {
      const saved = loadCoasterState();
      if (saved) {
        skipNextSaveRef.current = true;
        setState(saved);
        setHasExistingGame(true);
      } else {
        setHasExistingGame(false);
      }
    } else {
      setHasExistingGame(false);
    }
    setSavedParks(loadSavedParks());
    setIsStateReady(true);
  }, [startFresh]);

  useEffect(() => {
    latestStateRef.current = state;
    stateChangedRef.current = true;
  }, [state]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (skipNextSaveRef.current) {
        skipNextSaveRef.current = false;
        return;
      }
      if (!stateChangedRef.current) return;
      saveCoasterState(latestStateRef.current);
      setHasExistingGame(true);
      stateChangedRef.current = false;
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (state.speed === 0) return;
    const interval = setInterval(() => {
      setState((prev) => simulateCoasterTick(prev));
    }, state.speed === 1 ? 700 : state.speed === 2 ? 450 : 300);
    return () => clearInterval(interval);
  }, [state.speed]);

  const setTool = useCallback((tool: CoasterTool) => {
    setState((prev) => ({ ...prev, selectedTool: tool, activePanel: 'none' }));
  }, []);

  const setSpeed = useCallback((speed: 0 | 1 | 2 | 3) => {
    setState((prev) => ({ ...prev, speed }));
  }, []);

  const setActivePanel = useCallback((panel: PanelType) => {
    setState((prev) => ({ ...prev, activePanel: panel }));
  }, []);

  const placeAtTile = useCallback((_x: number, _y: number) => {
    // Placeholder - placement logic will be added in Phase 2
  }, []);

  const buildRide = useCallback((_rideType: RideType, _x: number, _y: number) => {
    // Placeholder - ride placement logic will be added in Phase 3
    return false;
  }, []);

  const buildPath = useCallback((_x: number, _y: number) => {
    // Placeholder - path placement logic will be added in Phase 2
  }, []);

  const setRidePrice = useCallback((_rideId: string, _price: number) => {
    // Placeholder - ride pricing logic will be added in Phase 4
  }, []);

  const newGame = useCallback((name?: string, size?: number) => {
    const fresh = createInitialCoasterState(size ?? DEFAULT_COASTER_GRID_SIZE, name ?? 'Coaster Park');
    skipNextSaveRef.current = true;
    setState(fresh);
  }, []);

  const loadState = useCallback((stateString: string) => {
    try {
      const parsed = JSON.parse(stateString);
      if (parsed?.grid && parsed?.gridSize) {
        skipNextSaveRef.current = true;
        setState(parsed as CoasterParkState);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const exportState = useCallback(() => JSON.stringify(state), [state]);

  const savePark = useCallback(() => {
    const parkMeta: SavedParkMeta = {
      id: state.id,
      parkName: state.parkName,
      guests: state.stats.guestsInPark,
      rating: state.stats.rating,
      cash: state.finance.cash,
      year: state.year,
      month: state.month,
      gridSize: state.gridSize,
      savedAt: Date.now(),
    };
    setSavedParks((prev) => {
      const existingIndex = prev.findIndex((park) => park.id === state.id);
      const next = [...prev];
      if (existingIndex >= 0) {
        next[existingIndex] = parkMeta;
      } else {
        next.push(parkMeta);
      }
      next.sort((a, b) => b.savedAt - a.savedAt);
      saveSavedParks(next);
      return next;
    });
  }, [state]);

  const loadSavedPark = useCallback((parkId: string) => {
    const saved = localStorage.getItem(`coaster-park-${parkId}`);
    if (!saved) return false;
    let jsonString = decompressFromUTF16(saved);
    if (!jsonString || !jsonString.startsWith('{')) {
      if (saved.startsWith('{')) {
        jsonString = saved;
      } else {
        return false;
      }
    }
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed?.grid && parsed?.gridSize) {
        skipNextSaveRef.current = true;
        setState(parsed as CoasterParkState);
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }, []);

  const deleteSavedPark = useCallback((parkId: string) => {
    setSavedParks((prev) => {
      const next = prev.filter((park) => park.id !== parkId);
      saveSavedParks(next);
      return next;
    });
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`coaster-park-${parkId}`);
    }
  }, []);

  const value: CoasterContextValue = {
    state,
    latestStateRef,
    setTool,
    setSpeed,
    setActivePanel,
    placeAtTile,
    buildRide,
    buildPath,
    setRidePrice,
    newGame,
    loadState,
    exportState,
    hasExistingGame,
    isStateReady,
    savedParks,
    savePark,
    loadSavedPark,
    deleteSavedPark,
  };

  return <CoasterContext.Provider value={value}>{children}</CoasterContext.Provider>;
}

export function useCoaster() {
  const ctx = useContext(CoasterContext);
  if (!ctx) {
    throw new Error('useCoaster must be used within a CoasterProvider');
  }
  return ctx;
}
