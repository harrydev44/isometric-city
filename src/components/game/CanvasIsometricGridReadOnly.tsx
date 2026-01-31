'use client';

/**
 * Read-only Isometric Grid Renderer for AI Civilization Mode
 *
 * A simplified canvas renderer that displays a city grid without
 * interaction capabilities. Optimized for rendering many cities quickly.
 */

import React, { useRef, useEffect, useState } from 'react';
import { GameState, Tile } from '@/games/isocity/types/game';
import { BuildingType } from '@/games/isocity/types/buildings';
import {
  TILE_WIDTH,
  TILE_HEIGHT,
} from '@/components/game/types';
import {
  drawGreenBaseTile,
  drawGreyBaseTile,
} from '@/components/game/drawing';
import { gridToScreen } from '@/components/game/utils';
import { getSpriteCoords, getSpriteOffsets, SpritePack, DEFAULT_SPRITE_PACK_ID, getSpritePack } from '@/lib/renderConfig';
import { loadSpriteImage, getCachedImage } from '@/components/game/imageLoader';

// ============================================================================
// CONSTANTS
// ============================================================================

const ZOOM_DEFAULT = 0.85;
const BACKGROUND_COLOR = { r: 255, g: 0, b: 0 };
const COLOR_THRESHOLD = 155;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Filter red background from sprite sheet
 */
function filterBackgroundColor(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const distance = Math.sqrt(
      Math.pow(r - BACKGROUND_COLOR.r, 2) +
      Math.pow(g - BACKGROUND_COLOR.g, 2) +
      Math.pow(b - BACKGROUND_COLOR.b, 2)
    );

    if (distance <= COLOR_THRESHOLD) {
      data[i + 3] = 0; // Make transparent
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Draw a simple road tile
 */
function drawSimpleRoad(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  zoom: number
): void {
  const w = TILE_WIDTH * zoom;
  const h = TILE_HEIGHT * zoom;

  // Draw grey diamond for road
  const topX = screenX + w / 2;
  const topY = screenY;
  const rightX = screenX + w;
  const rightY = screenY + h / 2;
  const bottomX = screenX + w / 2;
  const bottomY = screenY + h;
  const leftX = screenX;
  const leftY = screenY + h / 2;

  ctx.fillStyle = '#4b5563';
  ctx.beginPath();
  ctx.moveTo(topX, topY);
  ctx.lineTo(rightX, rightY);
  ctx.lineTo(bottomX, bottomY);
  ctx.lineTo(leftX, leftY);
  ctx.closePath();
  ctx.fill();

  // Add some road markings
  ctx.strokeStyle = '#6b7280';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ============================================================================
// COMPONENT PROPS
// ============================================================================

export interface CanvasIsometricGridReadOnlyProps {
  state: GameState;
  width?: number;
  height?: number;
  zoom?: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CanvasIsometricGridReadOnly({
  state,
  width = 600,
  height = 400,
  zoom = ZOOM_DEFAULT,
}: CanvasIsometricGridReadOnlyProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [spriteSheet, setSpriteSheet] = useState<HTMLCanvasElement | null>(null);
  const [spritePack, setSpritePack] = useState<SpritePack | null>(null);

  // Load sprite sheet
  useEffect(() => {
    const pack = getSpritePack(DEFAULT_SPRITE_PACK_ID);
    setSpritePack(pack);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const filtered = filterBackgroundColor(img);
      setSpriteSheet(filtered);
    };
    img.src = pack.src;
  }, []);

  // Render the grid
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !state) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const { grid, gridSize } = state;

    // Set up canvas
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Clear canvas with background
    ctx.fillStyle = '#1e293b'; // Slate background
    ctx.fillRect(0, 0, width, height);

    // Calculate offset to center the grid
    const scaledTileWidth = TILE_WIDTH * zoom;
    const scaledTileHeight = TILE_HEIGHT * zoom;

    // Calculate the center of the grid in screen space
    const centerGridX = gridSize / 2;
    const centerGridY = gridSize / 2;

    // The screen position of the center tile (without offset)
    const centerScreenX = (centerGridX - centerGridY) * (scaledTileWidth / 2);
    const centerScreenY = (centerGridX + centerGridY) * (scaledTileHeight / 2);

    // Offset to center the grid in the canvas
    const offsetX = width / 2 - centerScreenX;
    const offsetY = height / 2 - centerScreenY + scaledTileHeight * 2; // Adjust for better vertical centering

    // Draw tiles from back to front (isometric ordering)
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const tile = grid[y][x];
        const buildingType = tile.building.type;

        // Calculate screen position
        const screenX = (x - y) * (scaledTileWidth / 2) + offsetX;
        const screenY = (x + y) * (scaledTileHeight / 2) + offsetY;

        // Skip tiles outside visible area
        if (
          screenX + scaledTileWidth < 0 ||
          screenX > width ||
          screenY + scaledTileHeight * 3 < 0 ||
          screenY > height
        ) {
          continue;
        }

        // Draw base tile
        if (buildingType === 'grass' || buildingType === 'tree') {
          // Draw green tile with zone coloring
          ctx.save();
          ctx.translate(screenX, screenY);
          ctx.scale(zoom, zoom);
          drawGreenBaseTile(ctx, 0, 0, tile, zoom);
          ctx.restore();
        } else if (buildingType === 'road' || buildingType === 'bridge') {
          // Draw road
          drawSimpleRoad(ctx, screenX, screenY, zoom);
        } else if (buildingType === 'water') {
          // Draw water tile
          ctx.fillStyle = '#3b82f6';
          const w = scaledTileWidth;
          const h = scaledTileHeight;
          ctx.beginPath();
          ctx.moveTo(screenX + w / 2, screenY);
          ctx.lineTo(screenX + w, screenY + h / 2);
          ctx.lineTo(screenX + w / 2, screenY + h);
          ctx.lineTo(screenX, screenY + h / 2);
          ctx.closePath();
          ctx.fill();
        } else {
          // Draw grey base for buildings
          ctx.save();
          ctx.translate(screenX, screenY);
          ctx.scale(zoom, zoom);
          drawGreyBaseTile(ctx, 0, 0, tile, zoom);
          ctx.restore();

          // Draw building sprite if available
          if (spriteSheet && spritePack) {
            const coords = getSpriteCoords(
              buildingType,
              spriteSheet.width,
              spriteSheet.height,
              spritePack
            );

            if (coords) {
              // Get sprite-specific offsets
              const offsets = getSpriteOffsets(buildingType, spritePack);

              // Calculate sprite size and position
              const spriteScale = zoom * 1.0;
              const destWidth = coords.sw * spriteScale;
              const destHeight = coords.sh * spriteScale;

              // Position sprite on tile with offsets
              // Anchor at bottom center of tile, then apply offsets
              const destX = screenX + (scaledTileWidth - destWidth) / 2 + (offsets.horizontal * zoom);
              const destY = screenY - destHeight + scaledTileHeight + (offsets.vertical * zoom);

              ctx.drawImage(
                spriteSheet,
                coords.sx,
                coords.sy,
                coords.sw,
                coords.sh,
                destX,
                destY,
                destWidth,
                destHeight
              );
            }
          }
        }
      }
    }

    // Draw city name
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(state.cityName, 10, 20);

    // Draw population
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(`Pop: ${state.stats.population.toLocaleString()}`, 10, 36);
  }, [state, width, height, zoom, spriteSheet, spritePack]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{
        imageRendering: 'pixelated',
      }}
    />
  );
}

export default CanvasIsometricGridReadOnly;
