/**
 * Fog of War System for Competitive Mode
 * 
 * Handles:
 * - Tracking explored/unexplored tiles
 * - Vision radius around buildings and units
 * - Drawing fog overlay on unexplored areas
 */

import { Tile } from '@/types/game';
import { MilitaryUnit, PlayerId, COMPETITIVE_SETTINGS, CompetitiveState } from '@/types/competitive';
import { TILE_WIDTH, TILE_HEIGHT } from './types';

// Update fog of war based on player's buildings and units
export function updateFogOfWar(
  state: CompetitiveState,
  grid: Tile[][],
  gridSize: number,
  units: MilitaryUnit[],
  playerCityX: number,
  playerCityY: number,
  playerCityRadius: number
): void {
  // Reset visibility (but keep explored status)
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      state.visibleTiles[y][x] = false;
    }
  }
  
  // Mark tiles visible around player's city
  for (let y = Math.max(0, playerCityY - playerCityRadius - COMPETITIVE_SETTINGS.fogOfWarRadius); 
       y < Math.min(gridSize, playerCityY + playerCityRadius + COMPETITIVE_SETTINGS.fogOfWarRadius); y++) {
    for (let x = Math.max(0, playerCityX - playerCityRadius - COMPETITIVE_SETTINGS.fogOfWarRadius); 
         x < Math.min(gridSize, playerCityX + playerCityRadius + COMPETITIVE_SETTINGS.fogOfWarRadius); x++) {
      const dist = Math.sqrt((x - playerCityX) ** 2 + (y - playerCityY) ** 2);
      if (dist <= playerCityRadius + COMPETITIVE_SETTINGS.fogOfWarRadius) {
        state.visibleTiles[y][x] = true;
        state.exploredTiles[y][x] = true;
      }
    }
  }
  
  // Mark tiles visible around player's units
  for (const unit of units) {
    if (unit.ownerId !== state.humanPlayerId) continue;
    if (unit.state === 'dead') continue;
    
    const radius = COMPETITIVE_SETTINGS.unitVisionRadius;
    for (let y = Math.max(0, unit.tileY - radius); y < Math.min(gridSize, unit.tileY + radius); y++) {
      for (let x = Math.max(0, unit.tileX - radius); x < Math.min(gridSize, unit.tileX + radius); x++) {
        const dist = Math.sqrt((x - unit.tileX) ** 2 + (y - unit.tileY) ** 2);
        if (dist <= radius) {
          state.visibleTiles[y][x] = true;
          state.exploredTiles[y][x] = true;
        }
      }
    }
  }
  
  // Also mark visibility around player-owned buildings
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const tile = grid[y]?.[x];
      if (!tile) continue;
      
      const type = tile.building.type;
      if (type === 'grass' || type === 'water' || type === 'empty') continue;
      
      // Check if this building is in player's territory
      const distToCity = Math.sqrt((x - playerCityX) ** 2 + (y - playerCityY) ** 2);
      if (distToCity <= playerCityRadius) {
        const radius = COMPETITIVE_SETTINGS.fogOfWarRadius;
        for (let fy = Math.max(0, y - radius); fy < Math.min(gridSize, y + radius); fy++) {
          for (let fx = Math.max(0, x - radius); fx < Math.min(gridSize, x + radius); fx++) {
            const dist = Math.sqrt((fx - x) ** 2 + (fy - y) ** 2);
            if (dist <= radius) {
              state.visibleTiles[fy][fx] = true;
              state.exploredTiles[fy][fx] = true;
            }
          }
        }
      }
    }
  }
}

// Draw fog of war overlay
export function drawFogOfWar(
  ctx: CanvasRenderingContext2D,
  state: CompetitiveState,
  offset: { x: number; y: number },
  zoom: number,
  canvasWidth: number,
  canvasHeight: number
): void {
  const gridSize = state.mapSize;
  const dpr = window.devicePixelRatio || 1;
  
  ctx.save();
  ctx.scale(dpr * zoom, dpr * zoom);
  ctx.translate(offset.x / zoom, offset.y / zoom);
  
  // Calculate visible tile range
  const viewLeft = -offset.x / zoom - TILE_WIDTH;
  const viewTop = -offset.y / zoom - TILE_HEIGHT * 2;
  const viewRight = canvasWidth / (dpr * zoom) - offset.x / zoom + TILE_WIDTH;
  const viewBottom = canvasHeight / (dpr * zoom) - offset.y / zoom + TILE_HEIGHT * 2;
  
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      // Calculate screen position
      const screenX = (x - y) * (TILE_WIDTH / 2);
      const screenY = (x + y) * (TILE_HEIGHT / 2);
      
      // Skip tiles outside view
      if (screenX < viewLeft - TILE_WIDTH || screenX > viewRight + TILE_WIDTH ||
          screenY < viewTop - TILE_HEIGHT * 2 || screenY > viewBottom + TILE_HEIGHT * 2) {
        continue;
      }
      
      const isExplored = state.exploredTiles[y]?.[x] ?? false;
      const isVisible = state.visibleTiles[y]?.[x] ?? false;
      
      if (!isExplored) {
        // Completely unexplored - draw dark fog
        ctx.fillStyle = 'rgba(10, 10, 20, 0.95)';
        drawIsometricTile(ctx, screenX, screenY);
      } else if (!isVisible) {
        // Explored but not currently visible - draw lighter fog
        ctx.fillStyle = 'rgba(30, 30, 50, 0.6)';
        drawIsometricTile(ctx, screenX, screenY);
      }
    }
  }
  
  ctx.restore();
}

// Draw an isometric tile shape
function drawIsometricTile(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.beginPath();
  ctx.moveTo(x + TILE_WIDTH / 2, y);
  ctx.lineTo(x + TILE_WIDTH, y + TILE_HEIGHT / 2);
  ctx.lineTo(x + TILE_WIDTH / 2, y + TILE_HEIGHT);
  ctx.lineTo(x, y + TILE_HEIGHT / 2);
  ctx.closePath();
  ctx.fill();
}

// Check if a tile is visible to the player
export function isTileVisible(state: CompetitiveState, x: number, y: number): boolean {
  return state.visibleTiles[y]?.[x] ?? false;
}

// Check if a tile has been explored
export function isTileExplored(state: CompetitiveState, x: number, y: number): boolean {
  return state.exploredTiles[y]?.[x] ?? false;
}

// Initialize fog of war with player's starting area revealed
export function initializeFogOfWar(
  state: CompetitiveState,
  playerCityX: number,
  playerCityY: number,
  revealRadius: number
): void {
  const gridSize = state.mapSize;
  
  // Reveal starting area
  for (let y = Math.max(0, playerCityY - revealRadius); y < Math.min(gridSize, playerCityY + revealRadius); y++) {
    for (let x = Math.max(0, playerCityX - revealRadius); x < Math.min(gridSize, playerCityX + revealRadius); x++) {
      const dist = Math.sqrt((x - playerCityX) ** 2 + (y - playerCityY) ** 2);
      if (dist <= revealRadius) {
        state.exploredTiles[y][x] = true;
        state.visibleTiles[y][x] = true;
      }
    }
  }
}
