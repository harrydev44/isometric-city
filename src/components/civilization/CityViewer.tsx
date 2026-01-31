'use client';

/**
 * City Viewer - Renders an agent's city using the real game renderer
 *
 * Features:
 * - Dynamically centered camera on the city
 * - Smooth fade transitions when switching cities
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { GameState } from '@/games/isocity/types/game';
import { GameProvider } from '@/context/GameContext';
import { CanvasIsometricGrid } from '@/components/game/CanvasIsometricGrid';
import { CIVILIZATION_CONSTANTS } from '@/types/civilization';

// Tile dimensions for offset calculation (must match CanvasIsometricGrid)
const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;

interface CityViewerProps {
  state: GameState;
}

interface CityViewerInnerProps {
  initialOffset: { x: number; y: number };
  initialZoom: number;
}

function CityViewerInner({ initialOffset, initialZoom }: CityViewerInnerProps) {
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);

  return (
    <div className="w-full h-full">
      <CanvasIsometricGrid
        overlayMode="none"
        selectedTile={selectedTile}
        setSelectedTile={setSelectedTile}
        isMobile={false}
        initialOffset={initialOffset}
        initialZoom={initialZoom}
      />
    </div>
  );
}

export function CityViewer({ state }: CityViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayedState, setDisplayedState] = useState(state);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);
  const prevStateIdRef = useRef(state.id);

  // Measure container size - wait for measurement before rendering
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({
          width: rect.width,
          height: rect.height,
        });
      }
    };

    // Initial measurement with small delay to ensure layout is complete
    const timer = setTimeout(updateSize, 50);

    // Watch for resize
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, []);

  // Handle city transitions with fade
  useEffect(() => {
    if (state.id !== prevStateIdRef.current) {
      // Start fade out
      setIsTransitioning(true);

      // After fade out, update state and fade in
      const timer = setTimeout(() => {
        setDisplayedState(state);
        prevStateIdRef.current = state.id;
        // Allow fade in to start
        setTimeout(() => setIsTransitioning(false), 50);
      }, 200); // Match CSS transition duration

      return () => clearTimeout(timer);
    }
  }, [state]);

  // Zoom level that shows the whole city nicely
  const initialZoom = 0.9;

  // Calculate centered offset for the grid based on actual container size
  const initialOffset = useMemo(() => {
    if (!containerSize) return { x: 500, y: 200 }; // Fallback

    const gridSize = CIVILIZATION_CONSTANTS.GRID_SIZE; // 30
    const centerTileX = gridSize / 2; // 15
    const centerTileY = gridSize / 2; // 15

    // In isometric projection, tile (15, 15) is at screen position:
    // screenX = (15 - 15) * (TILE_WIDTH / 2) = 0
    // screenY = (15 + 15) * (TILE_HEIGHT / 2) = 30 * 16 = 480
    const gridCenterScreenX = (centerTileX - centerTileY) * (TILE_WIDTH / 2); // = 0
    const gridCenterScreenY = (centerTileX + centerTileY) * (TILE_HEIGHT / 2); // = 480

    // The canvas applies: ctx.translate(offset.x / zoom, offset.y / zoom)
    // Then draws tile at screenX, screenY
    // Final position on canvas: screenX + offset.x/zoom, screenY + offset.y/zoom
    //
    // We want: containerCenter.x = gridCenterScreenX + offset.x/zoom
    //          containerCenter.y = gridCenterScreenY + offset.y/zoom
    //
    // Therefore: offset.x = (containerCenter.x - gridCenterScreenX) * zoom
    //            offset.y = (containerCenter.y - gridCenterScreenY) * zoom

    const containerCenterX = containerSize.width / 2;
    const containerCenterY = containerSize.height / 2;

    return {
      x: (containerCenterX - gridCenterScreenX) * initialZoom,
      y: (containerCenterY - gridCenterScreenY) * initialZoom,
    };
  }, [containerSize, initialZoom]);

  // Use a key based on city ID for the provider
  // Include a timestamp for the initial container size to ensure proper centering
  const [mountKey, setMountKey] = useState(0);

  // Update mount key when container size is first measured or city changes
  useEffect(() => {
    if (containerSize) {
      setMountKey(prev => prev + 1);
    }
  }, [displayedState.id]);

  const viewerKey = `viewer-${displayedState.id}-${mountKey}`;

  return (
    <div
      ref={containerRef}
      className={`w-full h-full transition-opacity duration-200 ${
        isTransitioning ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {containerSize ? (
        <GameProvider initialState={displayedState} readOnly={true} key={viewerKey}>
          <CityViewerInner initialOffset={initialOffset} initialZoom={initialZoom} />
        </GameProvider>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-white/50 text-sm">Loading...</div>
        </div>
      )}
    </div>
  );
}

export default CityViewer;
