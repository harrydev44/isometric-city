'use client';

import React, { useState, useRef } from 'react';
import { GameProvider } from '@/context/GameContext';
import { MultiplayerContextProvider } from '@/context/MultiplayerContext';
import Game from '@/components/Game';
import { CoopModal } from '@/components/multiplayer/CoopModal';
import { GameState } from '@/types/game';
import { compressToUTF16 } from 'lz-string';
import { useParams, useRouter } from 'next/navigation';
import { useStorageNamespace } from '@/hooks/useStorageNamespace';
import { CityStorageKeys, buildCityStorageKeys, buildStoragePrefix, withPaneParam } from '@/lib/storageKeys';

// Save a city to the saved cities index (for multiplayer cities)
function saveCityToIndex(storageKeys: CityStorageKeys, state: GameState, roomCode?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const saved = localStorage.getItem(storageKeys.savedCitiesIndex);
    const cities = saved ? JSON.parse(saved) : [];
    
    const cityMeta = {
      id: state.id || `city-${Date.now()}`,
      cityName: state.cityName || 'Co-op City',
      population: state.stats.population,
      money: state.stats.money,
      year: state.year,
      month: state.month,
      gridSize: state.gridSize,
      savedAt: Date.now(),
      roomCode: roomCode,
    };
    
    const existingIndex = cities.findIndex((c: { id: string; roomCode?: string }) => 
      c.id === cityMeta.id || (roomCode && c.roomCode === roomCode)
    );
    
    if (existingIndex >= 0) {
      cities[existingIndex] = cityMeta;
    } else {
      cities.unshift(cityMeta);
    }
    
    localStorage.setItem(storageKeys.savedCitiesIndex, JSON.stringify(cities.slice(0, 20)));
  } catch (e) {
    console.error('Failed to save city to index:', e);
  }
}

export default function CoopPage() {
  const storageNamespace = useStorageNamespace();
  const storagePrefix = buildStoragePrefix(storageNamespace);
  const storageKeys = buildCityStorageKeys(storagePrefix);
  const params = useParams();
  const router = useRouter();
  const roomCode = (params.roomCode as string)?.toUpperCase();
  
  const [showGame, setShowGame] = useState(false);
  const [showCoopModal, setShowCoopModal] = useState(true);
  const [startFreshGame, setStartFreshGame] = useState(false);
  
  // Ref to track that we're intentionally starting the game (not closing to go home)
  const isStartingGameRef = useRef(false);

  // Handle exit from game - navigate back to homepage
  const handleExitGame = () => {
    router.push(withPaneParam('/', storageNamespace));
  };

  // Handle co-op game start
  const handleCoopStart = (isHost: boolean, initialState?: GameState, code?: string) => {
    // Mark that we're intentionally starting the game (not closing to go home)
    isStartingGameRef.current = true;
    
    if (isHost && initialState) {
      try {
        const compressed = compressToUTF16(JSON.stringify(initialState));
        localStorage.setItem(storageKeys.state, compressed);
        if (code) {
          saveCityToIndex(storageKeys, initialState, code);
        }
      } catch (e) {
        console.error('Failed to save co-op state:', e);
      }
      setStartFreshGame(false);
    } else if (isHost) {
      setStartFreshGame(true);
    } else if (initialState) {
      try {
        const compressed = compressToUTF16(JSON.stringify(initialState));
        localStorage.setItem(storageKeys.state, compressed);
        if (code) {
          saveCityToIndex(storageKeys, initialState, code);
        }
      } catch (e) {
        console.error('Failed to save co-op state:', e);
      }
      setStartFreshGame(false);
    } else {
      setStartFreshGame(true);
    }
    
    setShowGame(true);
    setShowCoopModal(false);
  };

  // Handle modal close - go back to homepage if not connected
  const handleModalClose = (open: boolean) => {
    // Don't redirect if we're intentionally starting the game
    if (!open && !showGame && !isStartingGameRef.current) {
      router.push(withPaneParam('/', storageNamespace));
    }
    setShowCoopModal(open);
  };

  if (showGame) {
    return (
      <MultiplayerContextProvider>
        <GameProvider startFresh={startFreshGame} storageNamespace={storageNamespace}>
          <main className="h-screen w-screen overflow-hidden">
            <Game onExit={handleExitGame} />
          </main>
        </GameProvider>
      </MultiplayerContextProvider>
    );
  }

  // Show the coop modal with the room code pre-filled
  return (
    <MultiplayerContextProvider>
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <CoopModal
          open={showCoopModal}
          onOpenChange={handleModalClose}
          onStartGame={handleCoopStart}
          pendingRoomCode={roomCode}
        />
      </main>
    </MultiplayerContextProvider>
  );
}
