// IsoCoaster co-op room page

'use client';

import React, { useState, useRef } from 'react';
import { CoasterProvider } from '@/context/CoasterContext';
import { CoasterMultiplayerContextProvider } from '@/context/CoasterMultiplayerContext';
import CoasterGame from '@/components/coaster/Game';
import { CoasterCoopModal } from '@/components/multiplayer/CoasterCoopModal';
import { GameState } from '@/games/coaster/types';
import {
  COASTER_AUTOSAVE_KEY,
  buildSavedParkMeta,
  readSavedParksIndex,
  saveCoasterStateToStorage,
  upsertSavedParkMeta,
  writeSavedParksIndex,
} from '@/games/coaster/saveUtils';
import { useParams, useRouter } from 'next/navigation';

export default function CoasterCoopPage() {
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

    if (initialState) {
      saveCoasterStateToStorage(COASTER_AUTOSAVE_KEY, initialState);
      const meta = buildSavedParkMeta(initialState, Date.now(), code);
      const updated = upsertSavedParkMeta(meta, readSavedParksIndex());
      writeSavedParksIndex(updated);
      setStartFreshGame(false);
    } else if (isHost) {
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
        <CoasterCoopModal
          open={showCoopModal}
          onOpenChange={handleModalClose}
          onStartGame={handleCoopStart}
          pendingRoomCode={roomCode}
        />
      </main>
    </CoasterMultiplayerContextProvider>
  );
}
