/**
 * Traffic system for sophisticated road networks
 * Handles road merging, traffic lights, and lane detection
 */

import { Tile } from '@/types/game';
import { TILE_WIDTH, TILE_HEIGHT } from './types';

// Road network types
export type RoadType = 'single' | 'two_lane' | 'four_lane' | 'avenue' | 'highway';
export type RoadOrientation = 'horizontal' | 'vertical' | 'intersection';

// Traffic light states
export type TrafficLightState = 'red' | 'yellow' | 'green';
export type TrafficLightDirection = 'north_south' | 'east_west';

// Traffic light configuration
export interface TrafficLight {
  x: number;
  y: number;
  direction: TrafficLightDirection;
  state: TrafficLightState;
  timer: number; // Time in current state
  cycleTime: number; // Total cycle time for this light
}

// Road network analysis result for a single tile
export interface RoadNetworkInfo {
  type: RoadType;
  orientation: RoadOrientation;
  hasNorth: boolean;
  hasEast: boolean;
  hasSouth: boolean;
  hasWest: boolean;
  adjacentRoads: {
    north: boolean;
    east: boolean;
    south: boolean;
    west: boolean;
  };
  // For multi-lane roads
  lanes: number;
  hasCentralDivider: boolean;
  hasTurnLanes: boolean;
}

// Traffic light timing constants (in seconds)
const TRAFFIC_LIGHT_CYCLE_TIME = 8.0; // Total cycle time (red + yellow + green)
const TRAFFIC_LIGHT_RED_TIME = 3.5;
const TRAFFIC_LIGHT_YELLOW_TIME = 1.0;
const TRAFFIC_LIGHT_GREEN_TIME = 3.5;

/**
 * Check if a tile is a road
 */
function isRoad(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  return grid[y][x].building.type === 'road';
}

/**
 * Analyze road network for a specific tile
 */
export function analyzeRoadNetwork(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): RoadNetworkInfo | null {
  if (!isRoad(grid, gridSize, x, y)) return null;

  // Check adjacent roads in all 4 directions
  const hasNorth = isRoad(grid, gridSize, x - 1, y);
  const hasEast = isRoad(grid, gridSize, x, y - 1);
  const hasSouth = isRoad(grid, gridSize, x + 1, y);
  const hasWest = isRoad(grid, gridSize, x, y + 1);

  // Check for parallel roads (roads drawn side-by-side that should merge)
  // When roads are drawn next to each other, they create wider roads
  // For a horizontal road (east-west), parallel roads would be at (x-1,y) or (x+1,y) if they also go east-west
  // For a vertical road (north-south), parallel roads would be at (x,y-1) or (x,y+1) if they also go north-south
  let hasParallelNorth = false;
  let hasParallelSouth = false;
  let hasParallelEast = false;
  let hasParallelWest = false;
  
  // Check if adjacent roads in perpendicular direction are also roads (parallel roads)
  // For horizontal roads, check north/south tiles
  if (hasEast || hasWest) {
    // Check if north tile is a road (and it's not just a connection, but a parallel road)
    if (isRoad(grid, gridSize, x - 1, y)) {
      const northHasEast = isRoad(grid, gridSize, x - 1, y - 1);
      const northHasWest = isRoad(grid, gridSize, x - 1, y + 1);
      // If the north road also goes east-west, it's parallel
      if (northHasEast || northHasWest) hasParallelNorth = true;
    }
    // Check if south tile is a road
    if (isRoad(grid, gridSize, x + 1, y)) {
      const southHasEast = isRoad(grid, gridSize, x + 1, y - 1);
      const southHasWest = isRoad(grid, gridSize, x + 1, y + 1);
      // If the south road also goes east-west, it's parallel
      if (southHasEast || southHasWest) hasParallelSouth = true;
    }
  }
  
  // For vertical roads, check east/west tiles
  if (hasNorth || hasSouth) {
    // Check if east tile is a road
    if (isRoad(grid, gridSize, x, y - 1)) {
      const eastHasNorth = isRoad(grid, gridSize, x - 1, y - 1);
      const eastHasSouth = isRoad(grid, gridSize, x + 1, y - 1);
      // If the east road also goes north-south, it's parallel
      if (eastHasNorth || eastHasSouth) hasParallelEast = true;
    }
    // Check if west tile is a road
    if (isRoad(grid, gridSize, x, y + 1)) {
      const westHasNorth = isRoad(grid, gridSize, x - 1, y + 1);
      const westHasSouth = isRoad(grid, gridSize, x + 1, y + 1);
      // If the west road also goes north-south, it's parallel
      if (westHasNorth || westHasSouth) hasParallelWest = true;
    }
  }

  // Determine orientation
  const isHorizontal = (hasEast && hasWest) || (!hasNorth && !hasSouth && (hasEast || hasWest));
  const isVertical = (hasNorth && hasSouth) || (!hasEast && !hasWest && (hasNorth || hasSouth));
  const isIntersection = (hasNorth || hasSouth) && (hasEast || hasWest);

  let orientation: RoadOrientation = 'intersection';
  if (isHorizontal && !isIntersection) orientation = 'horizontal';
  else if (isVertical && !isIntersection) orientation = 'vertical';

  // Count parallel roads to determine road type
  let parallelCount = 0;
  if (orientation === 'horizontal') {
    if (hasParallelNorth) parallelCount++;
    if (hasParallelSouth) parallelCount++;
  } else if (orientation === 'vertical') {
    if (hasParallelEast) parallelCount++;
    if (hasParallelWest) parallelCount++;
  }

  // Determine road type based on parallel roads
  let type: RoadType = 'single';
  let lanes = 1;
  let hasCentralDivider = false;
  let hasTurnLanes = false;

  if (parallelCount >= 2) {
    // Multiple parallel roads = highway
    type = 'highway';
    lanes = 4;
    hasCentralDivider = true;
  } else if (parallelCount === 1) {
    // One parallel road = avenue with divider
    type = 'avenue';
    lanes = 4;
    hasCentralDivider = true;
  } else if (isIntersection && (hasNorth || hasSouth) && (hasEast || hasWest)) {
    // Intersection might have turn lanes
    type = 'two_lane';
    lanes = 2;
    hasTurnLanes = true;
  } else if ((hasNorth && hasSouth) || (hasEast && hasWest)) {
    // Straight road with traffic = two lane
    type = 'two_lane';
    lanes = 2;
  }

  return {
    type,
    orientation,
    hasNorth,
    hasEast,
    hasSouth,
    hasWest,
    adjacentRoads: {
      north: hasNorth,
      east: hasEast,
      south: hasSouth,
      west: hasWest,
    },
    lanes,
    hasCentralDivider,
    hasTurnLanes,
  };
}

/**
 * Check if a tile is an intersection (has roads in perpendicular directions)
 */
export function isIntersection(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): boolean {
  if (!isRoad(grid, gridSize, x, y)) return false;

  const hasNorth = isRoad(grid, gridSize, x - 1, y);
  const hasEast = isRoad(grid, gridSize, x, y - 1);
  const hasSouth = isRoad(grid, gridSize, x + 1, y);
  const hasWest = isRoad(grid, gridSize, x, y + 1);

  // Intersection if roads exist in perpendicular directions
  return (hasNorth || hasSouth) && (hasEast || hasWest);
}

/**
 * Find all intersections in the grid
 */
export function findIntersections(
  grid: Tile[][],
  gridSize: number
): Array<{ x: number; y: number }> {
  const intersections: Array<{ x: number; y: number }> = [];

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (isIntersection(grid, gridSize, x, y)) {
        intersections.push({ x, y });
      }
    }
  }

  return intersections;
}

/**
 * Initialize traffic lights for all intersections
 */
export function initializeTrafficLights(
  grid: Tile[][],
  gridSize: number
): Map<string, TrafficLight> {
  const lights = new Map<string, TrafficLight>();
  const intersections = findIntersections(grid, gridSize);

  // Determine direction for each intersection
  for (const { x, y } of intersections) {
    const hasNorth = isRoad(grid, gridSize, x - 1, y);
    const hasSouth = isRoad(grid, gridSize, x + 1, y);
    const hasEast = isRoad(grid, gridSize, x, y - 1);
    const hasWest = isRoad(grid, gridSize, x, y + 1);

    // Determine primary direction (north-south vs east-west)
    // If more roads in one direction, use that as primary
    const nsCount = (hasNorth ? 1 : 0) + (hasSouth ? 1 : 0);
    const ewCount = (hasEast ? 1 : 0) + (hasWest ? 1 : 0);

    let direction: TrafficLightDirection = 'north_south';
    if (ewCount > nsCount) {
      direction = 'east_west';
    } else if (ewCount === nsCount && ewCount > 0) {
      // Default to east-west if equal
      direction = 'east_west';
    }

    // Stagger initial states to avoid all lights being synchronized
    const key = `${x},${y}`;
    const offset = (x + y) % 2; // Alternate pattern
    const initialTimer = offset * (TRAFFIC_LIGHT_CYCLE_TIME / 2);

    lights.set(key, {
      x,
      y,
      direction,
      state: 'red',
      timer: initialTimer,
      cycleTime: TRAFFIC_LIGHT_CYCLE_TIME,
    });
  }

  return lights;
}

/**
 * Update traffic light states
 */
export function updateTrafficLights(
  lights: Map<string, TrafficLight>,
  delta: number
): void {
  for (const light of lights.values()) {
    light.timer += delta;

    // Update state based on timer
    if (light.state === 'red') {
      if (light.timer >= TRAFFIC_LIGHT_RED_TIME) {
        light.state = 'yellow';
        light.timer = 0;
      }
    } else if (light.state === 'yellow') {
      if (light.timer >= TRAFFIC_LIGHT_YELLOW_TIME) {
        light.state = 'green';
        light.timer = 0;
      }
    } else if (light.state === 'green') {
      if (light.timer >= TRAFFIC_LIGHT_GREEN_TIME) {
        light.state = 'red';
        light.timer = 0;
      }
    }
  }
}

/**
 * Get traffic light state for a specific intersection
 */
export function getTrafficLightState(
  lights: Map<string, TrafficLight>,
  x: number,
  y: number
): TrafficLight | null {
  const key = `${x},${y}`;
  return lights.get(key) || null;
}
