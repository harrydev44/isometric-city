import { screenToGrid } from '@/components/game/utils';

export type Point = { x: number; y: number };

export type GridPoint = { gridX: number; gridY: number };

/**
 * Convert a browser client (viewport) point into grid coordinates.
 *
 * This centralizes the coordinate math used by mouse/touch handlers:
 * - Convert client → container-local
 * - Convert pixels → world units (divide by zoom)
 * - Apply current camera offset (in world units) for `screenToGrid`
 */
export function getGridCoordsFromClientPoint(
  client: Point,
  rect: DOMRect,
  zoom: number,
  offset: Point
): GridPoint {
  const worldX = (client.x - rect.left) / zoom;
  const worldY = (client.y - rect.top) / zoom;
  return screenToGrid(worldX, worldY, offset.x / zoom, offset.y / zoom);
}

export function isGridCoordInBounds(gridX: number, gridY: number, gridSize: number): boolean {
  return gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize;
}

