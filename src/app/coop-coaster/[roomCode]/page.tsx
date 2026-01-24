'use client';

import React, { useState, useRef } from 'react';
import { CoasterProvider, createInitialGameState } from '@/context/CoasterContext';
import { CoasterMultiplayerContextProvider } from '@/context/CoasterMultiplayerContext';
import CoasterGame from '@/components/coaster/Game';
import { CoopCoasterModal } from '@/components/multiplayer/CoopCoasterModal';
import { GameState } from '@/games/coaster/types';
import { compressToUTF16 } from 'lz-string';
import { useParams, useRouter } from 'next/navigation';
import { COASTER_AUTOSAVE_KEY, COASTER_SAVED_PARKS_INDEX_KEY, buildSavedParkMeta } from '@/games/coaster/saveUtils';

// Save a park to the saved parks index (for multiplayer parks)
function saveParkToIndex(state: GameState, roomCode?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const saved = localStorage.getItem(COASTER_SAVED_PARKS_INDEX_KEY);
    const parks = saved ? JSON.parse(saved) : [];
    
    const parkMeta = {
      ...buildSavedParkMeta(state),
      roomCode,
    };
    
    const existingIndex = parks.findIndex((p: { id: string; roomCode?: string }) => 
      p.id === parkMeta.id || (roomCode && p.roomCode === roomCode)
    );
    
    if (existingIndex >= 0) {
      parks[existingIndex] = parkMeta;
    } else {
      parks.unshift(parkMeta);
    }
    
    localStorage.setItem(COASTER_SAVED_PARKS_INDEX_KEY, JSON.stringify(parks.slice(0, 20)));
  } catch (e) {
    console.error('Failed to save park to index:', e);
  }
}

export default function CoopCoasterPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = (params.roomCode as string)?.toUpperCase();
  
  const [showGame, setShowGame] = useState(false);
  const [showCoopModal, setShowCoopModal] = useState(true);
  const [startFreshGame, setStartFreshGame] = useState(false);
  
  const isStartingGameRef = useRef(false);

  const handleExitGame = () => {
    router.push('/coaster');
  };

  const handleCoopStart = (isHost: boolean, initialState?: GameState, code?: string) => {
    isStartingGameRef.current = true;
    
    if (isHost && initialState) {
      try {
        const compressed = compressToUTF16(JSON.stringify(initialState));
        localStorage.setItem(COASTER_AUTOSAVE_KEY, compressed);
        if (code) {
          saveParkToIndex(initialState, code);
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
        localStorage.setItem(COASTER_AUTOSAVE_KEY, compressed);
        if (code) {
          saveParkToIndex(initialState, code);
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

  const handleModalClose = (open: boolean) => {
    if (!open && !showGame && !isStartingGameRef.current) {
      router.push('/coaster');
    }
    setShowCoopModal(open);
  };

  if (showGame) {
    return (
      <CoasterMultiplayerContextProvider>
        <CoasterProvider startFresh={startFreshGame}>
          <main className="h-screen w-screen overflow-hidden">
            <CoasterGame onExit={handleExitGame} />
          </main>
        </CoasterProvider>
      </CoasterMultiplayerContextProvider>
    );
  }

  return (
    <CoasterMultiplayerContextProvider>
      <main className="min-h-screen bg-gradient-to-br from-emerald-950 via-teal-950 to-emerald-950 flex items-center justify-center">
        <CoopCoasterModal
          open={showCoopModal}
          onOpenChange={handleModalClose}
          onStartGame={handleCoopStart}
          createInitialState={createInitialGameState}
          pendingRoomCode={roomCode}
        />
      </main>
    </CoasterMultiplayerContextProvider>
  );
}
