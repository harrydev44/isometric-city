/**
 * Agent AI for Civilization Mode
 *
 * Each agent makes ONE decision per turn based on their character type.
 * Characters have distinct behaviors and priorities.
 */

import { GameState, Tile } from '@/games/isocity/types/game';
import { BuildingType } from '@/games/isocity/types/buildings';
import { ZoneType } from '@/games/isocity/types/zones';
import { AgentPersonality, AgentDecision, AgentCharacter } from '@/types/civilization';
import { getBuildingSize } from '@/lib/simulation';

// ============================================================================
// TYPES
// ============================================================================

export interface AIAction {
  type: 'place_building' | 'place_zone' | 'place_road' | 'nothing';
  buildingType?: BuildingType;
  zoneType?: ZoneType;
  x: number;
  y: number;
  cost: number;
  description: string;
  reason: string;
}

// ============================================================================
// CITY ANALYSIS
// ============================================================================

interface CityAnalysis {
  roadTiles: { x: number; y: number }[];
  roadEndpoints: { x: number; y: number; direction: string }[];
  zonedTiles: { x: number; y: number; zone: ZoneType }[];
  emptyZonedTiles: { x: number; y: number; zone: ZoneType }[];
  tilesAdjacentToRoads: { x: number; y: number }[];
  hasPower: boolean;
  hasWater: boolean;
  hasFireStation: boolean;
  hasPoliceStation: boolean;
  hasHospital: boolean;
  parkCount: number;
  population: number;
  money: number;
  happiness: number;
  demand: { residential: number; commercial: number; industrial: number };
}

function analyzeCity(state: GameState): CityAnalysis {
  const { grid, gridSize } = state;
  const analysis: CityAnalysis = {
    roadTiles: [],
    roadEndpoints: [],
    zonedTiles: [],
    emptyZonedTiles: [],
    tilesAdjacentToRoads: [],
    hasPower: false,
    hasWater: false,
    hasFireStation: false,
    hasPoliceStation: false,
    hasHospital: false,
    parkCount: 0,
    population: state.stats.population,
    money: state.stats.money,
    happiness: state.stats.happiness,
    demand: state.stats.demand,
  };

  const directions = [
    { dx: 0, dy: -1, name: 'north' },
    { dx: 1, dy: 0, name: 'east' },
    { dx: 0, dy: 1, name: 'south' },
    { dx: -1, dy: 0, name: 'west' },
  ];

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const tile = grid[y][x];
      const type = tile.building.type;

      // Track roads
      if (type === 'road' || type === 'bridge') {
        analysis.roadTiles.push({ x, y });

        // Find endpoints
        let adjacentRoads = 0;
        let openDir = '';
        for (const dir of directions) {
          const nx = x + dir.dx, ny = y + dir.dy;
          if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
            const nt = grid[ny][nx].building.type;
            if (nt === 'road' || nt === 'bridge') adjacentRoads++;
            else if (nt === 'grass' || nt === 'tree') openDir = dir.name;
          }
        }
        if (adjacentRoads <= 2 && openDir) {
          analysis.roadEndpoints.push({ x, y, direction: openDir });
        }
      }

      // Track zones
      if (tile.zone !== 'none') {
        analysis.zonedTiles.push({ x, y, zone: tile.zone });
        if (type === 'grass' || type === 'tree') {
          analysis.emptyZonedTiles.push({ x, y, zone: tile.zone });
        }
      }

      // Track services
      if (type === 'power_plant') analysis.hasPower = true;
      if (type === 'water_tower') analysis.hasWater = true;
      if (type === 'fire_station') analysis.hasFireStation = true;
      if (type === 'police_station') analysis.hasPoliceStation = true;
      if (type === 'hospital') analysis.hasHospital = true;
      if (type === 'park') analysis.parkCount++;

      // Track buildable tiles adjacent to roads
      if (type === 'grass' || type === 'tree') {
        for (const dir of directions) {
          const nx = x + dir.dx, ny = y + dir.dy;
          if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
            if (grid[ny][nx].building.type === 'road') {
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
// ACTION GENERATORS
// ============================================================================

function findRoadExtension(state: GameState, analysis: CityAnalysis): AIAction | null {
  const { grid, gridSize } = state;
  const dirs: Record<string, { dx: number; dy: number }> = {
    north: { dx: 0, dy: -1 },
    east: { dx: 1, dy: 0 },
    south: { dx: 0, dy: 1 },
    west: { dx: -1, dy: 0 },
  };

  for (const ep of analysis.roadEndpoints) {
    const dir = dirs[ep.direction];
    if (!dir) continue;
    const nx = ep.x + dir.dx, ny = ep.y + dir.dy;
    if (nx < 1 || nx >= gridSize - 1 || ny < 1 || ny >= gridSize - 1) continue;
    const tile = grid[ny][nx];
    if (tile.building.type === 'grass' || tile.building.type === 'tree') {
      return {
        type: 'place_road',
        x: nx,
        y: ny,
        cost: 25,
        description: `Build road ${ep.direction}`,
        reason: 'expanding road network',
      };
    }
  }
  return null;
}

type BuildableZone = 'residential' | 'commercial' | 'industrial';

function findZonePlacement(state: GameState, analysis: CityAnalysis, zoneType: BuildableZone): AIAction | null {
  const { grid } = state;

  for (const tile of analysis.tilesAdjacentToRoads) {
    if (grid[tile.y][tile.x].zone === 'none') {
      return {
        type: 'place_zone',
        zoneType,
        x: tile.x,
        y: tile.y,
        cost: 50,
        description: `Zone ${zoneType}`,
        reason: `demand: ${Math.round(analysis.demand[zoneType])}%`,
      };
    }
  }
  return null;
}

function findServicePlacement(state: GameState, analysis: CityAnalysis, serviceType: BuildingType): AIAction | null {
  const { grid, gridSize } = state;
  const size = getBuildingSize(serviceType);

  const costs: Record<string, number> = {
    power_plant: 3000,
    water_tower: 1000,
    fire_station: 500,
    police_station: 500,
    hospital: 1500,
    park: 150,
  };

  for (const tile of analysis.tilesAdjacentToRoads) {
    let canPlace = true;
    for (let dy = 0; dy < size.height && canPlace; dy++) {
      for (let dx = 0; dx < size.width && canPlace; dx++) {
        const tx = tile.x + dx, ty = tile.y + dy;
        if (tx >= gridSize || ty >= gridSize) canPlace = false;
        else if (grid[ty][tx].building.type !== 'grass' && grid[ty][tx].building.type !== 'tree') {
          canPlace = false;
        }
      }
    }
    if (canPlace) {
      return {
        type: 'place_building',
        buildingType: serviceType,
        x: tile.x,
        y: tile.y,
        cost: costs[serviceType] || 500,
        description: `Build ${serviceType.replace('_', ' ')}`,
        reason: getServiceReason(serviceType, analysis),
      };
    }
  }
  return null;
}

function getServiceReason(serviceType: BuildingType, analysis: CityAnalysis): string {
  switch (serviceType) {
    case 'power_plant': return 'city needs power';
    case 'water_tower': return 'city needs water';
    case 'fire_station': return 'fire protection needed';
    case 'police_station': return 'crime prevention';
    case 'hospital': return 'healthcare for citizens';
    case 'park': return `happiness at ${Math.round(analysis.happiness)}%`;
    default: return 'city improvement';
  }
}

// ============================================================================
// CHARACTER-BASED DECISION MAKING
// ============================================================================

function decideAsIndustrialist(state: GameState, analysis: CityAnalysis): AIAction | null {
  // Priority: Industrial zones > Power > Roads > Any zone
  if (!analysis.hasPower && analysis.money >= 3000) {
    return findServicePlacement(state, analysis, 'power_plant');
  }
  if (analysis.demand.industrial > 30) {
    const action = findZonePlacement(state, analysis, 'industrial');
    if (action) return action;
  }
  if (analysis.roadEndpoints.length > 0 && analysis.money >= 25) {
    return findRoadExtension(state, analysis);
  }
  // Fall back to any high-demand zone
  const highestDemand = Math.max(analysis.demand.residential, analysis.demand.commercial, analysis.demand.industrial);
  if (highestDemand > 20) {
    const zoneType = analysis.demand.industrial >= highestDemand ? 'industrial' :
      analysis.demand.commercial >= analysis.demand.residential ? 'commercial' : 'residential';
    return findZonePlacement(state, analysis, zoneType);
  }
  return null;
}

function decideAsEnvironmentalist(state: GameState, analysis: CityAnalysis): AIAction | null {
  // Priority: Parks > Water > Residential (low density) > Roads
  if (analysis.happiness < 70 && analysis.money >= 150 && analysis.parkCount < 5) {
    const action = findServicePlacement(state, analysis, 'park');
    if (action) return action;
  }
  if (!analysis.hasWater && analysis.money >= 1000) {
    return findServicePlacement(state, analysis, 'water_tower');
  }
  if (analysis.demand.residential > 40) {
    return findZonePlacement(state, analysis, 'residential');
  }
  if (analysis.roadEndpoints.length > 0 && analysis.money >= 25) {
    return findRoadExtension(state, analysis);
  }
  return null;
}

function decideAsCapitalist(state: GameState, analysis: CityAnalysis): AIAction | null {
  // Priority: Commercial zones > Services for growth > Residential for workers
  if (!analysis.hasPower && analysis.money >= 3000) {
    return findServicePlacement(state, analysis, 'power_plant');
  }
  if (analysis.demand.commercial > 30) {
    const action = findZonePlacement(state, analysis, 'commercial');
    if (action) return action;
  }
  if (analysis.demand.residential > 50) {
    return findZonePlacement(state, analysis, 'residential');
  }
  if (analysis.roadEndpoints.length > 0 && analysis.money >= 25) {
    return findRoadExtension(state, analysis);
  }
  return null;
}

function decideAsExpansionist(state: GameState, analysis: CityAnalysis): AIAction | null {
  // Priority: Roads > Zones > Basic services
  if (analysis.roadEndpoints.length > 0 && analysis.money >= 25) {
    return findRoadExtension(state, analysis);
  }
  if (!analysis.hasPower && analysis.money >= 3000) {
    return findServicePlacement(state, analysis, 'power_plant');
  }
  // Zone based on demand
  const highestDemand = Math.max(analysis.demand.residential, analysis.demand.commercial, analysis.demand.industrial);
  if (highestDemand > 20) {
    const zoneType = analysis.demand.residential >= highestDemand ? 'residential' :
      analysis.demand.commercial >= analysis.demand.industrial ? 'commercial' : 'industrial';
    return findZonePlacement(state, analysis, zoneType);
  }
  return null;
}

function decideAsPlanner(state: GameState, analysis: CityAnalysis): AIAction | null {
  // Balanced approach: Follow demand, ensure services
  if (!analysis.hasPower && analysis.money >= 3000) {
    return findServicePlacement(state, analysis, 'power_plant');
  }
  if (!analysis.hasWater && analysis.money >= 1000) {
    return findServicePlacement(state, analysis, 'water_tower');
  }
  if (analysis.population > 100 && !analysis.hasFireStation && analysis.money >= 500) {
    return findServicePlacement(state, analysis, 'fire_station');
  }
  // Zone based on highest demand
  const { residential, commercial, industrial } = analysis.demand;
  if (residential > 50 || commercial > 50 || industrial > 50) {
    const zoneType = residential >= commercial && residential >= industrial ? 'residential' :
      commercial >= industrial ? 'commercial' : 'industrial';
    return findZonePlacement(state, analysis, zoneType);
  }
  // Expand roads if nothing else to do
  if (analysis.roadEndpoints.length > 0 && analysis.money >= 25) {
    return findRoadExtension(state, analysis);
  }
  return null;
}

function decideAsGambler(state: GameState, analysis: CityAnalysis): AIAction | null {
  // Random decisions!
  const roll = Math.random();

  if (roll < 0.3 && analysis.roadEndpoints.length > 0 && analysis.money >= 25) {
    return findRoadExtension(state, analysis);
  }
  if (roll < 0.5 && analysis.money >= 50) {
    const zones: BuildableZone[] = ['residential', 'commercial', 'industrial'];
    const randomZone = zones[Math.floor(Math.random() * zones.length)];
    return findZonePlacement(state, analysis, randomZone);
  }
  if (roll < 0.7 && analysis.money >= 500) {
    const services: BuildingType[] = ['fire_station', 'police_station', 'park'];
    const randomService = services[Math.floor(Math.random() * services.length)];
    return findServicePlacement(state, analysis, randomService);
  }
  if (roll < 0.9 && !analysis.hasPower && analysis.money >= 3000) {
    return findServicePlacement(state, analysis, 'power_plant');
  }
  // 10% chance to do nothing and save money
  return null;
}

// ============================================================================
// MAIN DECISION FUNCTION
// ============================================================================

export function decide(state: GameState, personality: AgentPersonality): { action: AIAction | null; decision: AgentDecision } {
  const analysis = analyzeCity(state);

  // Choose decision function based on character
  let action: AIAction | null = null;

  switch (personality.character) {
    case 'industrialist':
      action = decideAsIndustrialist(state, analysis);
      break;
    case 'environmentalist':
      action = decideAsEnvironmentalist(state, analysis);
      break;
    case 'capitalist':
      action = decideAsCapitalist(state, analysis);
      break;
    case 'expansionist':
      action = decideAsExpansionist(state, analysis);
      break;
    case 'planner':
      action = decideAsPlanner(state, analysis);
      break;
    case 'gambler':
      action = decideAsGambler(state, analysis);
      break;
  }

  // Create decision record
  const decision: AgentDecision = action
    ? {
        action: action.description,
        reason: action.reason,
        success: true,
      }
    : {
        action: 'Saved money',
        reason: 'waiting for opportunity',
        success: true,
      };

  return { action, decision };
}

// ============================================================================
// EXECUTE ACTION
// ============================================================================

export function executeAction(state: GameState, action: AIAction): GameState {
  if (action.type === 'nothing') return state;

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

  // Deduct cost
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
