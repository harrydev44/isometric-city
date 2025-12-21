'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useGame } from '@/context/GameContext';
import { drawMilitaryUnits, drawSelectionBox, getUnitsInSelectionBox, screenToTile } from './militarySystem';
import { drawFogOfWar } from './fogOfWar';

interface CompetitiveOverlayProps {
  offset: { x: number; y: number };
  zoom: number;
  canvasWidth: number;
  canvasHeight: number;
}

export function CompetitiveOverlay({ offset, zoom, canvasWidth, canvasHeight }: CompetitiveOverlayProps) {
  const { state, competitiveState, selectUnits, commandSelectedUnits } = useGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    active: boolean;
  } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  
  // Render military units and fog of war
  useEffect(() => {
    // Don't render if not in competitive mode
    if (!competitiveState.enabled) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw fog of war
    drawFogOfWar(ctx, competitiveState, offset, zoom, canvasWidth, canvasHeight);
    
    // Draw military units
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawMilitaryUnits(
      ctx,
      competitiveState.units,
      offset,
      zoom,
      competitiveState.selectedUnitIds
    );
    
    // Draw selection box
    if (selectionBox && selectionBox.active) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawSelectionBox(ctx, selectionBox, zoom);
    }
  }, [competitiveState, offset, zoom, canvasWidth, canvasHeight, selectionBox]);
  
  // Handle mouse down - start selection
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!competitiveState.enabled) return;
    
    if (e.button === 0) { // Left click
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      setSelectionBox({
        startX: x,
        startY: y,
        endX: x,
        endY: y,
        active: true
      });
      setIsSelecting(true);
    }
  }, [competitiveState.enabled]);
  
  // Handle mouse move - update selection box
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!competitiveState.enabled) return;
    if (!isSelecting || !selectionBox) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setSelectionBox(prev => prev ? {
      ...prev,
      endX: x,
      endY: y
    } : null);
  }, [competitiveState.enabled, isSelecting, selectionBox]);
  
  // Handle mouse up - finish selection
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!competitiveState.enabled) return;
    
    if (e.button === 0 && isSelecting && selectionBox) {
      // Get units in selection box
      const width = Math.abs(selectionBox.endX - selectionBox.startX);
      const height = Math.abs(selectionBox.endY - selectionBox.startY);
      
      if (width > 5 || height > 5) {
        // Box selection
        const selectedIds = getUnitsInSelectionBox(
          competitiveState.units,
          selectionBox,
          offset,
          zoom,
          'player'
        );
        selectUnits(selectedIds);
      } else {
        // Click selection - check if clicked on a unit
        const clickedUnit = competitiveState.units.find(unit => {
          if (unit.ownerId !== 'player' || unit.state === 'dead') return false;
          const screenX = (unit.x + offset.x) * zoom;
          const screenY = (unit.y + offset.y) * zoom;
          const dx = selectionBox.startX - screenX;
          const dy = selectionBox.startY - screenY;
          return Math.sqrt(dx * dx + dy * dy) < 20 * zoom;
        });
        
        if (clickedUnit) {
          selectUnits([clickedUnit.id]);
        } else {
          selectUnits([]);
        }
      }
      
      setSelectionBox(null);
      setIsSelecting(false);
    }
  }, [competitiveState.enabled, competitiveState.units, isSelecting, selectionBox, offset, zoom, selectUnits]);
  
  // Handle right-click - move or attack command
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    
    if (!competitiveState.enabled) return;
    if (competitiveState.selectedUnitIds.length === 0) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = (e.clientX - rect.left) / zoom - offset.x;
    const mouseY = (e.clientY - rect.top) / zoom - offset.y;
    
    // Convert screen to tile
    const { tileX, tileY } = screenToTile(mouseX, mouseY);
    
    // Check if target is valid
    if (tileX < 0 || tileX >= state.gridSize || tileY < 0 || tileY >= state.gridSize) return;
    
    // Check if clicking on an enemy building (to attack)
    const tile = state.grid[tileY]?.[tileX];
    const isAttack = tile && 
      tile.building.type !== 'grass' && 
      tile.building.type !== 'water' && 
      tile.building.type !== 'empty' &&
      tile.building.type !== 'road';
    
    // Check if enemy territory (simple check - outside player's city radius)
    const player = competitiveState.players.find(p => p.id === 'player');
    const isEnemyTerritory = player ? Math.sqrt((tileX - player.cityX) ** 2 + (tileY - player.cityY) ** 2) > player.cityRadius : false;
    
    commandSelectedUnits(tileX, tileY, isAttack && isEnemyTerritory);
  }, [competitiveState, state.grid, state.gridSize, offset, zoom, commandSelectedUnits]);
  
  // Don't render if not in competitive mode
  if (!competitiveState.enabled) return null;
  
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-auto"
      style={{ zIndex: 50 }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={handleContextMenu}
    />
  );
}
