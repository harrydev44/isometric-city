import { TILE_WIDTH, TILE_HEIGHT } from '@/components/game/types';

export function getMapBounds(currentZoom: number, canvasW: number, canvasH: number, gridSize: number) {
  const padding = 100;
  const mapLeft = -(gridSize - 1) * TILE_WIDTH / 2;
  const mapRight = (gridSize - 1) * TILE_WIDTH / 2;
  const mapTop = 0;
  const mapBottom = (gridSize - 1) * TILE_HEIGHT;
  const minOffsetX = padding - mapRight * currentZoom;
  const maxOffsetX = canvasW - padding - mapLeft * currentZoom;
  const minOffsetY = padding - mapBottom * currentZoom;
  const maxOffsetY = canvasH - padding - mapTop * currentZoom;
  
  return { minOffsetX, maxOffsetX, minOffsetY, maxOffsetY };
}

export function clampOffset(
  newOffset: { x: number; y: number },
  currentZoom: number,
  canvasW: number,
  canvasH: number,
  gridSize: number
): { x: number; y: number } {
  const bounds = getMapBounds(currentZoom, canvasW, canvasH, gridSize);
  
  return {
    x: Math.max(bounds.minOffsetX, Math.min(bounds.maxOffsetX, newOffset.x)),
    y: Math.max(bounds.minOffsetY, Math.min(bounds.maxOffsetY, newOffset.y)),
  };
}

export function getTouchDistance(touch1: React.Touch, touch2: React.Touch): number {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function getTouchCenter(touch1: React.Touch, touch2: React.Touch): { x: number; y: number } {
  return {
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2,
  };
}
