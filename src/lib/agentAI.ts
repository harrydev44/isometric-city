/**
 * Urban Planner AI for Agent Cities
 *
 * Agents behave like urban planners, not random builders.
 * Key principles:
 * 1. ROAD-FIRST: Roads must exist before any development
 * 2. CONNECTIVITY: All zones must connect to the road network
 * 3. COHERENT ZONING: Zones are clustered, not scattered
 * 4. PHASED GROWTH: Core → Services → Expansion → Densification
 */

import { GameState, Tile } from '@/games/isocity/types/game';
import { BuildingType } from '@/games/isocity/types/buildings';
import { ZoneType } from '@/games/isocity/types/zones';
import { AgentPersonality, AIAction, AIDecisionResult } from '@/types/civilization';
import { getBuildingSize } from '@/lib/simulation';

// ============================================================================
// SPATIAL ANALYSIS - Understanding the city layout
// ============================================================================

interface CityAnalysis {
  // Road network
  roadTiles: { x: number; y: number }[];
  roadEndpoints: { x: number; y: number; direction: string }[];

  // Zones
  zonedTiles: { x: number; y: number; zone: ZoneType }[];
  emptyZonedTiles: { x: number; y: number; zone: ZoneType }[]; // Zoned but no building
  builtZonedTiles: { x: number; y: number; zone: ZoneType }[];

  // Expansion opportunities
  tilesAdjacentToRoads: { x: number; y: number }[]; // Grass tiles next to roads
  zoneClusters: Map<ZoneType, { x: number; y: number }[]>;

  // Services
  hasPower: boolean;
  hasWater: boolean;
  hasFireStation: boolean;
  hasPoliceStation: boolean;

  // Metrics
  population: number;
  jobs: number;
  money: number;
  happiness: number;
}

/**
 * Analyze the current city state
 */
function analyzeCity(state: GameState): CityAnalysis {
  const analysis: CityAnalysis = {
    roadTiles: [],
    roadEndpoints: [],
    zonedTiles: [],
    emptyZonedTiles: [],
    builtZonedTiles: [],
    tilesAdjacentToRoads: [],
    zoneClusters: new Map([
      ['residential', []],
      ['commercial', []],
      ['industrial', []],
    ]),
    hasPower: false,
    hasWater: false,
    hasFireStation: false,
    hasPoliceStation: false,
    population: state.stats.population,
    jobs: state.stats.jobs,
    money: state.stats.money,
    happiness: state.stats.happiness,
  };

  const { grid, gridSize } = state;
  const directions = [
    { dx: 0, dy: -1, name: 'north' },
    { dx: 1, dy: 0, name: 'east' },
    { dx: 0, dy: 1, name: 'south' },
    { dx: -1, dy: 0, name: 'west' },
  ];

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const tile = grid[y][x];
      const buildingType = tile.building.type;

      // Track roads
      if (buildingType === 'road' || buildingType === 'bridge') {
        analysis.roadTiles.push({ x, y });

        // Check if this is a road endpoint (only 1 adjacent road)
        let adjacentRoads = 0;
        let openDirection = '';
        for (const dir of directions) {
          const nx = x + dir.dx;
          const ny = y + dir.dy;
          if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
            const neighborType = grid[ny][nx].building.type;
            if (neighborType === 'road' || neighborType === 'bridge') {
              adjacentRoads++;
            } else if (neighborType === 'grass' || neighborType === 'tree') {
              openDirection = dir.name;
            }
          }
        }
        if (adjacentRoads <= 2 && openDirection) {
          analysis.roadEndpoints.push({ x, y, direction: openDirection });
        }
      }

      // Track zones
      if (tile.zone !== 'none') {
        analysis.zonedTiles.push({ x, y, zone: tile.zone });
        analysis.zoneClusters.get(tile.zone)?.push({ x, y });

        if (buildingType === 'grass' || buildingType === 'tree') {
          analysis.emptyZonedTiles.push({ x, y, zone: tile.zone });
        } else {
          analysis.builtZonedTiles.push({ x, y, zone: tile.zone });
        }
      }

      // Track services
      if (buildingType === 'power_plant') analysis.hasPower = true;
      if (buildingType === 'water_tower') analysis.hasWater = true;
      if (buildingType === 'fire_station') analysis.hasFireStation = true;
      if (buildingType === 'police_station') analysis.hasPoliceStation = true;

      // Track tiles adjacent to roads (expansion opportunities)
      if (buildingType === 'grass' || buildingType === 'tree') {
        for (const dir of directions) {
          const nx = x + dir.dx;
          const ny = y + dir.dy;
          if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
            const neighborType = grid[ny][nx].building.type;
            if (neighborType === 'road' || neighborType === 'bridge') {
              analysis.tilesAdjacentToRoads.push({ x, y });
              break;
            }
          }
        }
      }
    }
  }

  return analysis;
}

// ============================================================================
// GROWTH PHASE DETECTION
// ============================================================================

type GrowthPhase = 'core' | 'services' | 'expansion' | 'densification';

/**
 * Determine current growth phase based on city state
 */
function determineGrowthPhase(analysis: CityAnalysis): GrowthPhase {
  const { population, roadTiles, zonedTiles, hasPower, hasWater, hasFireStation, hasPoliceStation } = analysis;

  // Phase 1: Core - Need basic roads and zones
  if (roadTiles.length < 15 || zonedTiles.length < 10) {
    return 'core';
  }

  // Phase 2: Services - Need infrastructure
  if (!hasPower || !hasWater || (population > 50 && !hasFireStation)) {
    return 'services';
  }

  // Phase 3: Expansion - Grow the city
  if (population < 500 || roadTiles.length < 50) {
    return 'expansion';
  }

  // Phase 4: Densification - Fill in gaps, upgrade
  return 'densification';
}

// ============================================================================
// PLANNING FUNCTIONS
// ============================================================================

/**
 * Plan road extension from an endpoint
 */
function planRoadExtension(
  state: GameState,
  analysis: CityAnalysis,
  personality: AgentPersonality
): AIAction | null {
  const { grid, gridSize } = state;

  // Get road endpoints that can be extended
  const extendableEndpoints = analysis.roadEndpoints.filter(ep => {
    const dirs: Record<string, { dx: number; dy: number }> = {
      north: { dx: 0, dy: -1 },
      east: { dx: 1, dy: 0 },
      south: { dx: 0, dy: 1 },
      west: { dx: -1, dy: 0 },
    };
    const dir = dirs[ep.direction];
    if (!dir) return false;

    const nx = ep.x + dir.dx;
    const ny = ep.y + dir.dy;
    if (nx < 1 || nx >= gridSize - 1 || ny < 1 || ny >= gridSize - 1) return false;

    const tile = grid[ny][nx];
    return tile.building.type === 'grass' || tile.building.type === 'tree';
  });

  if (extendableEndpoints.length === 0) return null;

  // Choose endpoint - prefer extending toward city center for connectivity
  const centerX = Math.floor(gridSize / 2);
  const centerY = Math.floor(gridSize / 2);

  // Sort by distance from center (closer is better for core phase)
  extendableEndpoints.sort((a, b) => {
    const distA = Math.abs(a.x - centerX) + Math.abs(a.y - centerY);
    const distB = Math.abs(b.x - centerX) + Math.abs(b.y - centerY);
    return distA - distB;
  });

  // Pick based on personality (aggressive = further expansion)
  const pickIndex = Math.min(
    Math.floor(personality.aggressiveness * extendableEndpoints.length),
    extendableEndpoints.length - 1
  );
  const endpoint = extendableEndpoints[pickIndex];

  const dirs: Record<string, { dx: number; dy: number }> = {
    north: { dx: 0, dy: -1 },
    east: { dx: 1, dy: 0 },
    south: { dx: 0, dy: 1 },
    west: { dx: -1, dy: 0 },
  };
  const dir = dirs[endpoint.direction];
  const newX = endpoint.x + dir.dx;
  const newY = endpoint.y + dir.dy;

  return {
    type: 'place_road',
    x: newX,
    y: newY,
    priority: 100,
    cost: 25,
    reason: `Extend road network ${endpoint.direction}`,
  };
}

/**
 * Plan a new road branch (perpendicular to existing road)
 */
function planRoadBranch(
  state: GameState,
  analysis: CityAnalysis
): AIAction | null {
  const { grid, gridSize } = state;

  // Find road tiles that could have a perpendicular branch
  for (const road of analysis.roadTiles) {
    const { x, y } = road;

    // Check if this road has neighbors only in 2 opposite directions (straight road)
    const hasNorth = y > 0 && (grid[y - 1][x].building.type === 'road');
    const hasSouth = y < gridSize - 1 && (grid[y + 1][x].building.type === 'road');
    const hasEast = x < gridSize - 1 && (grid[y][x + 1].building.type === 'road');
    const hasWest = x > 0 && (grid[y][x - 1].building.type === 'road');

    // Horizontal road - can branch north or south
    if (hasEast && hasWest && !hasNorth && !hasSouth) {
      if (y > 1 && grid[y - 1][x].building.type === 'grass') {
        return {
          type: 'place_road',
          x,
          y: y - 1,
          priority: 90,
          cost: 25,
          reason: 'Create road branch north',
        };
      }
      if (y < gridSize - 2 && grid[y + 1][x].building.type === 'grass') {
        return {
          type: 'place_road',
          x,
          y: y + 1,
          priority: 90,
          cost: 25,
          reason: 'Create road branch south',
        };
      }
    }

    // Vertical road - can branch east or west
    if (hasNorth && hasSouth && !hasEast && !hasWest) {
      if (x < gridSize - 2 && grid[y][x + 1].building.type === 'grass') {
        return {
          type: 'place_road',
          x: x + 1,
          y,
          priority: 90,
          cost: 25,
          reason: 'Create road branch east',
        };
      }
      if (x > 1 && grid[y][x - 1].building.type === 'grass') {
        return {
          type: 'place_road',
          x: x - 1,
          y,
          priority: 90,
          cost: 25,
          reason: 'Create road branch west',
        };
      }
    }
  }

  return null;
}

/**
 * Plan zone placement adjacent to roads, extending existing clusters
 */
function planZonePlacement(
  state: GameState,
  analysis: CityAnalysis,
  personality: AgentPersonality
): AIAction | null {
  const { grid, gridSize } = state;

  // Determine which zone type to prioritize
  const demand = state.stats.demand;
  let zoneType: ZoneType;

  // Weight by demand and personality
  const residentialScore = demand.residential * (1 - personality.industrialFocus * 0.3);
  const commercialScore = demand.commercial;
  const industrialScore = demand.industrial * (0.7 + personality.industrialFocus * 0.3);

  if (residentialScore >= commercialScore && residentialScore >= industrialScore) {
    zoneType = 'residential';
  } else if (commercialScore >= industrialScore) {
    zoneType = 'commercial';
  } else {
    zoneType = 'industrial';
  }

  // Find tiles adjacent to roads that are near existing clusters of this zone type
  const cluster = analysis.zoneClusters.get(zoneType) || [];
  const candidates: { x: number; y: number; score: number }[] = [];

  for (const tile of analysis.tilesAdjacentToRoads) {
    // Skip if already zoned
    if (grid[tile.y][tile.x].zone !== 'none') continue;

    let score = 50;

    // Bonus for being near existing cluster of same type
    for (const clusterTile of cluster) {
      const dist = Math.abs(tile.x - clusterTile.x) + Math.abs(tile.y - clusterTile.y);
      if (dist <= 3) {
        score += 30 - dist * 5;
      }
    }

    // Industrial should be away from residential
    if (zoneType === 'industrial') {
      const residentialCluster = analysis.zoneClusters.get('residential') || [];
      for (const resTile of residentialCluster) {
        const dist = Math.abs(tile.x - resTile.x) + Math.abs(tile.y - resTile.y);
        if (dist < 5) {
          score -= 20;
        }
      }
    }

    // Commercial should be near residential
    if (zoneType === 'commercial') {
      const residentialCluster = analysis.zoneClusters.get('residential') || [];
      for (const resTile of residentialCluster) {
        const dist = Math.abs(tile.x - resTile.x) + Math.abs(tile.y - resTile.y);
        if (dist <= 4) {
          score += 15;
        }
      }
    }

    candidates.push({ ...tile, score });
  }

  if (candidates.length === 0) return null;

  // Sort by score and pick top candidate
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  return {
    type: 'place_zone',
    zoneType,
    x: best.x,
    y: best.y,
    priority: 70,
    cost: 50,
    reason: `Zone ${zoneType} (demand: ${Math.round(demand[zoneType])})`,
  };
}

/**
 * Plan service building placement
 */
function planServicePlacement(
  state: GameState,
  analysis: CityAnalysis,
  serviceType: BuildingType
): AIAction | null {
  const { grid, gridSize } = state;
  const size = getBuildingSize(serviceType);

  // Find location near zones but adjacent to roads
  for (const roadTile of analysis.tilesAdjacentToRoads) {
    const { x, y } = roadTile;

    // Check if we can place the building here
    let canPlace = true;
    for (let dy = 0; dy < size.height && canPlace; dy++) {
      for (let dx = 0; dx < size.width && canPlace; dx++) {
        const tx = x + dx;
        const ty = y + dy;
        if (tx >= gridSize || ty >= gridSize) {
          canPlace = false;
        } else if (grid[ty][tx].building.type !== 'grass' && grid[ty][tx].building.type !== 'tree') {
          canPlace = false;
        }
      }
    }

    if (canPlace) {
      const costs: Record<string, number> = {
        power_plant: 3000,
        water_tower: 1000,
        fire_station: 500,
        police_station: 500,
        hospital: 1000,
        school: 400,
        park: 150,
      };

      return {
        type: 'place_building',
        buildingType: serviceType,
        x,
        y,
        priority: 95,
        cost: costs[serviceType] || 500,
        reason: `Build ${serviceType}`,
      };
    }
  }

  return null;
}

// ============================================================================
// MAIN DECISION FUNCTION
// ============================================================================

/**
 * Main AI decision function
 * Returns actions based on urban planning principles
 */
export function decide(
  state: GameState,
  personality: AgentPersonality
): AIDecisionResult {
  const actions: AIAction[] = [];
  const analysis = analyzeCity(state);
  const phase = determineGrowthPhase(analysis);
  const budget = state.stats.money;

  // Minimum reserve
  const minReserve = 500;
  let availableBudget = budget - minReserve;

  // === PHASE-BASED PLANNING ===

  if (phase === 'core' || phase === 'expansion') {
    // Priority 1: Extend road network
    const roadExtension = planRoadExtension(state, analysis, personality);
    if (roadExtension && availableBudget >= roadExtension.cost) {
      actions.push(roadExtension);
      availableBudget -= roadExtension.cost;
    }

    // Maybe add a branch road for grid structure
    if (analysis.roadTiles.length > 10 && Math.random() < 0.3) {
      const roadBranch = planRoadBranch(state, analysis);
      if (roadBranch && availableBudget >= roadBranch.cost) {
        actions.push(roadBranch);
        availableBudget -= roadBranch.cost;
      }
    }
  }

  if (phase === 'services') {
    // Add missing infrastructure
    if (!analysis.hasPower && availableBudget >= 3000) {
      const powerAction = planServicePlacement(state, analysis, 'power_plant');
      if (powerAction) {
        actions.push(powerAction);
        availableBudget -= powerAction.cost;
      }
    }

    if (!analysis.hasWater && availableBudget >= 1000) {
      const waterAction = planServicePlacement(state, analysis, 'water_tower');
      if (waterAction) {
        actions.push(waterAction);
        availableBudget -= waterAction.cost;
      }
    }

    if (!analysis.hasFireStation && analysis.population > 50 && availableBudget >= 500) {
      const fireAction = planServicePlacement(state, analysis, 'fire_station');
      if (fireAction) {
        actions.push(fireAction);
        availableBudget -= fireAction.cost;
      }
    }

    if (!analysis.hasPoliceStation && analysis.population > 100 && availableBudget >= 500) {
      const policeAction = planServicePlacement(state, analysis, 'police_station');
      if (policeAction) {
        actions.push(policeAction);
        availableBudget -= policeAction.cost;
      }
    }
  }

  // Zone placement (all phases except pure services)
  if (phase !== 'services') {
    // Number of zones to place depends on personality and phase
    const zonesToPlace = phase === 'core' ? 2 : (phase === 'expansion' ? 3 : 1);

    for (let i = 0; i < zonesToPlace && availableBudget >= 50; i++) {
      const zoneAction = planZonePlacement(state, analysis, personality);
      if (zoneAction) {
        actions.push(zoneAction);
        availableBudget -= zoneAction.cost;
      }
    }
  }

  // Parks for happiness (expansion and densification phases)
  if ((phase === 'expansion' || phase === 'densification') &&
      analysis.happiness < 60 &&
      availableBudget >= 150 &&
      personality.environmentFocus > 0.4) {
    const parkAction = planServicePlacement(state, analysis, 'park');
    if (parkAction) {
      actions.push(parkAction);
      availableBudget -= parkAction.cost;
    }
  }

  // Sort by priority
  actions.sort((a, b) => b.priority - a.priority);

  // Calculate totals
  const totalCost = actions.reduce((sum, a) => sum + a.cost, 0);

  return {
    actions,
    totalCost,
    remainingBudget: budget - totalCost,
  };
}

/**
 * Execute a single AI action on the game state
 */
export function executeAction(
  state: GameState,
  action: AIAction
): GameState {
  const { placeBuilding } = require('@/lib/simulation');

  let newState = state;

  switch (action.type) {
    case 'place_building':
      if (action.buildingType) {
        newState = placeBuilding(state, action.x, action.y, action.buildingType, null);
      }
      break;

    case 'place_zone':
      if (action.zoneType) {
        newState = placeBuilding(state, action.x, action.y, null, action.zoneType);
      }
      break;

    case 'place_road':
      newState = placeBuilding(state, action.x, action.y, 'road', null);
      break;
  }

  // Deduct cost if action was successful
  if (newState !== state) {
    return {
      ...newState,
      stats: {
        ...newState.stats,
        money: newState.stats.money - action.cost,
      },
    };
  }

  return state;
}
