'use client';

/**
 * City Viewer - Renders an agent's city using the real game renderer
 *
 * Wraps the agent's state in a GameProvider to use the actual
 * CanvasIsometricGrid component for proper rendering.
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { GameState } from '@/games/isocity/types/game';
import { GameProvider } from '@/context/GameContext';
import { CanvasIsometricGrid } from '@/components/game/CanvasIsometricGrid';

interface CityViewerProps {
  state: GameState;
  key?: string; // Force remount when state changes
}

function CityViewerInner() {
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);

  return (
    <div className="w-full h-full">
      <CanvasIsometricGrid
        overlayMode="none"
        selectedTile={selectedTile}
        setSelectedTile={setSelectedTile}
        isMobile={false}
      />
    </div>
  );
}

export function CityViewer({ state }: CityViewerProps) {
  // Use a key based on city ID to force remount when switching cities
  const viewerKey = useMemo(() => `viewer-${state.id}-${state.cityName}`, [state.id, state.cityName]);

  return (
    <GameProvider initialState={state} readOnly={true} key={viewerKey}>
      <CityViewerInner />
    </GameProvider>
  );
}

export default CityViewer;
