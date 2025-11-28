/**
 * Grid helper functions for building lookups and park checks.
 * Extracted from CanvasIsometricGrid.tsx for better code organization.
 */

import { Tile, BuildingType } from '@/types/game';
import { getBuildingSize } from './utils';

// ============================================================================
// Building Origin Finder
// ============================================================================

/**
 * Find the origin of a multi-tile building that contains a given tile.
 * Returns the origin coordinates and building type, or null if not part of a multi-tile building.
 */
export function findBuildingOriginInGrid(
  gridX: number,
  gridY: number,
  grid: Tile[][],
  gridSize: number
): { originX: number; originY: number; buildingType: BuildingType } | null {
  const maxSize = 4; // Maximum building size
  
  // First check if this tile itself has a multi-tile building
  const tile = grid[gridY]?.[gridX];
  if (!tile) return null;
  
  // If this tile has a real building (not empty), check if it's multi-tile
  if (tile.building.type !== 'empty' && 
      tile.building.type !== 'grass' && 
      tile.building.type !== 'water' && 
      tile.building.type !== 'road' && 
      tile.building.type !== 'tree') {
    const size = getBuildingSize(tile.building.type);
    if (size.width > 1 || size.height > 1) {
      return { originX: gridX, originY: gridY, buildingType: tile.building.type };
    }
    return null; // Single-tile building
  }
  
  // If this is an 'empty' tile, search for the origin building
  if (tile.building.type === 'empty') {
    for (let dy = 0; dy < maxSize; dy++) {
      for (let dx = 0; dx < maxSize; dx++) {
        const originX = gridX - dx;
        const originY = gridY - dy;
        
        if (originX >= 0 && originX < gridSize && originY >= 0 && originY < gridSize) {
          const originTile = grid[originY][originX];
          
          if (originTile.building.type !== 'empty' && 
              originTile.building.type !== 'grass' &&
              originTile.building.type !== 'water' &&
              originTile.building.type !== 'road' &&
              originTile.building.type !== 'tree') {
            const size = getBuildingSize(originTile.building.type);
            
            // Check if the clicked tile is within this building's footprint
            if (size.width > 1 || size.height > 1) {
              if (gridX >= originX && gridX < originX + size.width &&
                  gridY >= originY && gridY < originY + size.height) {
                return { originX, originY, buildingType: originTile.building.type };
              }
            }
          }
        }
      }
    }
  }
  
  return null;
}

// ============================================================================
// Park Building Checks
// ============================================================================

/**
 * Set of building types that have green/park base tiles.
 * Note: buildings with grey bases (baseball_stadium, swimming_pool, community_center, office_building_small) are NOT included.
 */
export const PARK_BUILDINGS_SET = new Set<BuildingType>([
  'park_large', 'baseball_field_small', 'football_field',
  'mini_golf_course', 'go_kart_track', 'amphitheater', 'greenhouse_garden',
  'marina_docks_small', 'roller_coaster_small', 'mountain_lodge', 'playground_large', 'mountain_trailhead'
]);

/**
 * Check if a tile is part of a park building footprint.
 */
export function isPartOfParkBuildingInGrid(
  gridX: number,
  gridY: number,
  grid: Tile[][],
  gridSize: number,
  parkBuildingsSet: Set<BuildingType> = PARK_BUILDINGS_SET
): boolean {
  const maxSize = 4; // Maximum building size

  for (let dy = 0; dy < maxSize; dy++) {
    for (let dx = 0; dx < maxSize; dx++) {
      const originX = gridX - dx;
      const originY = gridY - dy;

      if (originX >= 0 && originX < gridSize && originY >= 0 && originY < gridSize) {
        const originTile = grid[originY][originX];

        // Use Set.has() for O(1) lookup
        if (parkBuildingsSet.has(originTile.building.type)) {
          const buildingSize = getBuildingSize(originTile.building.type);
          if (gridX >= originX && gridX < originX + buildingSize.width &&
              gridY >= originY && gridY < originY + buildingSize.height) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

// ============================================================================
// Multi-tile Building Checks
// ============================================================================

/**
 * Check if a tile is part of a multi-tile building's footprint (but not the origin).
 */
export function isPartOfMultiTileBuildingInGrid(
  gridX: number,
  gridY: number,
  grid: Tile[][],
  gridSize: number
): boolean {
  const maxSize = 4; // Maximum building size
  
  for (let dy = 0; dy < maxSize; dy++) {
    for (let dx = 0; dx < maxSize; dx++) {
      // Skip checking the tile itself
      if (dx === 0 && dy === 0) continue;
      
      const originX = gridX - dx;
      const originY = gridY - dy;
      
      if (originX >= 0 && originX < gridSize && originY >= 0 && originY < gridSize) {
        const originTile = grid[originY][originX];
        const buildingType = originTile.building.type;
        
        // Skip natural/empty tiles
        if (buildingType === 'empty' || 
            buildingType === 'grass' ||
            buildingType === 'water' ||
            buildingType === 'road' ||
            buildingType === 'tree') {
          continue;
        }
        
        const size = getBuildingSize(buildingType);
        
        // Check if this building is multi-tile and the target tile is within its footprint
        if (size.width > 1 || size.height > 1) {
          if (gridX >= originX && gridX < originX + size.width &&
              gridY >= originY && gridY < originY + size.height) {
            return true;
          }
        }
      }
    }
  }
  
  return false;
}

// ============================================================================
// Water Adjacency
// ============================================================================

/**
 * Check if a tile is adjacent to water (cardinal and diagonal).
 */
export function isAdjacentToWaterInGrid(
  gridX: number,
  gridY: number,
  grid: Tile[][],
  gridSize: number
): boolean {
  const directions = [
    [-1, 0], [1, 0], [0, -1], [0, 1], // cardinal directions
    [-1, -1], [1, -1], [-1, 1], [1, 1] // diagonal directions
  ];
  
  for (const [dx, dy] of directions) {
    const nx = gridX + dx;
    const ny = gridY + dy;
    
    if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
      if (grid[ny][nx]?.building.type === 'water') {
        return true;
      }
    }
  }
  
  return false;
}

// ============================================================================
// Depth Sorting
// ============================================================================

/**
 * Insertion sort for nearly-sorted arrays (O(n) vs O(n log n) for .sort()).
 * Since tiles are iterated in diagonal order, queues are already nearly sorted.
 */
export function insertionSortByDepth<T extends { depth: number }>(arr: T[]): void {
  for (let i = 1; i < arr.length; i++) {
    const current = arr[i];
    let j = i - 1;
    // Only move elements that are strictly greater (maintains stability)
    while (j >= 0 && arr[j].depth > current.depth) {
      arr[j + 1] = arr[j];
      j--;
    }
    arr[j + 1] = current;
  }
}
