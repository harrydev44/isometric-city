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

/**
 * Smart road extension - builds roads to form proper city blocks
 * Instead of random sprawl, extends roads to create new intersections
 */
function findRoadExtension(state: GameState, analysis: CityAnalysis, aggressive: boolean = false): AIAction | null {
  const { grid, gridSize } = state;
  const BLOCK_SIZE = 5; // Distance between intersections

  // Find the bounding box of existing roads
  let minX = gridSize, maxX = 0, minY = gridSize, maxY = 0;
  for (const road of analysis.roadTiles) {
    minX = Math.min(minX, road.x);
    maxX = Math.max(maxX, road.x);
    minY = Math.min(minY, road.y);
    maxY = Math.max(maxY, road.y);
  }

  // Priority 1: Complete any incomplete road segments (fill gaps)
  // Look for roads that stop abruptly and could connect to other roads
  for (const road of analysis.roadTiles) {
    const directions = [
      { dx: 1, dy: 0, name: 'east' },
      { dx: -1, dy: 0, name: 'west' },
      { dx: 0, dy: 1, name: 'south' },
      { dx: 0, dy: -1, name: 'north' },
    ];

    for (const dir of directions) {
      const nx = road.x + dir.dx;
      const ny = road.y + dir.dy;

      if (nx < 2 || nx >= gridSize - 2 || ny < 2 || ny >= gridSize - 2) continue;

      const tile = grid[ny][nx];
      if (tile.building.type !== 'grass' && tile.building.type !== 'tree') continue;

      // Check if extending here would connect to another road (creating T or + intersection)
      const beyondX = nx + dir.dx;
      const beyondY = ny + dir.dy;
      if (beyondX >= 0 && beyondX < gridSize && beyondY >= 0 && beyondY < gridSize) {
        const beyondTile = grid[beyondY][beyondX];
        if (beyondTile.building.type === 'road') {
          return {
            type: 'place_road',
            x: nx,
            y: ny,
            cost: 25,
            description: `Connect roads`,
            reason: 'creating intersection for better traffic flow',
          };
        }
      }
    }
  }

  // Priority 2: Extend the grid outward in a structured way (only if aggressive or expansionist)
  if (aggressive) {
    // Extend south or east to create new blocks
    const extendDirections = [
      { primary: 'south', dx: 0, dy: 1 },
      { primary: 'east', dx: 1, dy: 0 },
      { primary: 'north', dx: 0, dy: -1 },
      { primary: 'west', dx: -1, dy: 0 },
    ];

    for (const ext of extendDirections) {
      // Find a road on the edge that could be extended
      for (const road of analysis.roadTiles) {
        const isOnEdge = (ext.dx !== 0 && road.x === (ext.dx > 0 ? maxX : minX)) ||
                         (ext.dy !== 0 && road.y === (ext.dy > 0 ? maxY : minY));

        if (!isOnEdge) continue;

        const nx = road.x + ext.dx;
        const ny = road.y + ext.dy;

        if (nx < 3 || nx >= gridSize - 3 || ny < 3 || ny >= gridSize - 3) continue;

        const tile = grid[ny][nx];
        if (tile.building.type === 'grass' || tile.building.type === 'tree') {
          return {
            type: 'place_road',
            x: nx,
            y: ny,
            cost: 25,
            description: `Expand ${ext.primary}ward`,
            reason: 'growing the city boundaries',
          };
        }
      }
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
// Each character has distinct priorities and decision-making style
// ============================================================================

function decideAsIndustrialist(state: GameState, analysis: CityAnalysis): AIAction | null {
  // "Growth at any cost" - Prioritizes industrial production
  // Power > Industrial > More Industrial > Residential for workers

  if (!analysis.hasPower && analysis.money >= 3000) {
    const action = findServicePlacement(state, analysis, 'power_plant');
    if (action) {
      action.description = 'Build power plant';
      action.reason = 'factories need electricity to run!';
      return action;
    }
  }

  // Always try industrial first, even at lower demand
  if (analysis.demand.industrial > 10) {
    const action = findZonePlacement(state, analysis, 'industrial');
    if (action) {
      action.description = 'Zone industrial';
      action.reason = 'more factories = more jobs = more growth';
      return action;
    }
  }

  // Need workers for the factories
  if (analysis.demand.residential > 60) {
    const action = findZonePlacement(state, analysis, 'residential');
    if (action) {
      action.description = 'Zone residential';
      action.reason = 'workers needed for the factories';
      return action;
    }
  }

  // Expand infrastructure conservatively
  if (analysis.money >= 25) {
    const action = findRoadExtension(state, analysis, false);
    if (action) return action;
  }

  return null;
}

function decideAsEnvironmentalist(state: GameState, analysis: CityAnalysis): AIAction | null {
  // "Green is good" - Parks, happiness, minimal industry
  // Parks > Water > Residential > Commercial (no industrial!)

  // Always prioritize parks for happiness
  if (analysis.money >= 150 && analysis.parkCount < 8) {
    const action = findServicePlacement(state, analysis, 'park');
    if (action) {
      action.description = 'Build park';
      action.reason = analysis.happiness < 60
        ? 'citizens need green spaces to be happy'
        : 'adding more nature to the city';
      return action;
    }
  }

  if (!analysis.hasWater && analysis.money >= 1000) {
    const action = findServicePlacement(state, analysis, 'water_tower');
    if (action) {
      action.description = 'Build water tower';
      action.reason = 'clean water for healthy citizens';
      return action;
    }
  }

  // Residential only - avoid industrial at all costs
  if (analysis.demand.residential > 30) {
    const action = findZonePlacement(state, analysis, 'residential');
    if (action) {
      action.description = 'Zone residential';
      action.reason = 'homes among the trees';
      return action;
    }
  }

  // Some commercial is okay
  if (analysis.demand.commercial > 50) {
    const action = findZonePlacement(state, analysis, 'commercial');
    if (action) {
      action.description = 'Zone commercial';
      action.reason = 'local shops reduce commuting';
      return action;
    }
  }

  return null;
}

function decideAsCapitalist(state: GameState, analysis: CityAnalysis): AIAction | null {
  // "Money talks" - Commercial focus, maximize tax revenue
  // Power > Commercial > Commercial > Commercial > Residential

  if (!analysis.hasPower && analysis.money >= 3000) {
    const action = findServicePlacement(state, analysis, 'power_plant');
    if (action) {
      action.description = 'Build power plant';
      action.reason = 'businesses need reliable power';
      return action;
    }
  }

  // Commercial is king - lower threshold than others
  if (analysis.demand.commercial > 15) {
    const action = findZonePlacement(state, analysis, 'commercial');
    if (action) {
      action.description = 'Zone commercial';
      action.reason = 'shops and offices generate tax revenue';
      return action;
    }
  }

  // Workers need homes to spend money
  if (analysis.demand.residential > 40) {
    const action = findZonePlacement(state, analysis, 'residential');
    if (action) {
      action.description = 'Zone residential';
      action.reason = 'consumers need places to live';
      return action;
    }
  }

  // Some industry for a complete economy
  if (analysis.demand.industrial > 60) {
    const action = findZonePlacement(state, analysis, 'industrial');
    if (action) {
      action.description = 'Zone industrial';
      action.reason = 'supply chain for commercial sector';
      return action;
    }
  }

  return null;
}

function decideAsExpansionist(state: GameState, analysis: CityAnalysis): AIAction | null {
  // "Manifest destiny" - Always pushing boundaries outward
  // Roads > Roads > Roads > Zones > Services

  // Aggressive road expansion is the #1 priority
  if (analysis.money >= 25) {
    const action = findRoadExtension(state, analysis, true); // aggressive=true
    if (action) {
      action.description = 'Extend road network';
      action.reason = 'claiming new territory for the city';
      return action;
    }
  }

  // Need power to support growth
  if (!analysis.hasPower && analysis.money >= 3000) {
    const action = findServicePlacement(state, analysis, 'power_plant');
    if (action) {
      action.description = 'Build power plant';
      action.reason = 'powering the expansion';
      return action;
    }
  }

  // Zone whatever has highest demand
  const { residential, commercial, industrial } = analysis.demand;
  const highestDemand = Math.max(residential, commercial, industrial);
  if (highestDemand > 20) {
    const zoneType: BuildableZone = residential >= commercial && residential >= industrial
      ? 'residential'
      : commercial >= industrial ? 'commercial' : 'industrial';
    const action = findZonePlacement(state, analysis, zoneType);
    if (action) {
      action.description = `Zone ${zoneType}`;
      action.reason = 'filling in the new territory';
      return action;
    }
  }

  return null;
}

function decideAsPlanner(state: GameState, analysis: CityAnalysis): AIAction | null {
  // "By the book" - Balanced, methodical, follows best practices
  // Services when needed > Balanced zoning > Careful expansion

  // Infrastructure first
  if (!analysis.hasPower && analysis.money >= 3000) {
    const action = findServicePlacement(state, analysis, 'power_plant');
    if (action) {
      action.description = 'Build power plant';
      action.reason = 'essential infrastructure first';
      return action;
    }
  }

  if (!analysis.hasWater && analysis.money >= 1000) {
    const action = findServicePlacement(state, analysis, 'water_tower');
    if (action) {
      action.description = 'Build water tower';
      action.reason = 'water service is fundamental';
      return action;
    }
  }

  // Safety services based on population
  if (analysis.population > 100 && !analysis.hasFireStation && analysis.money >= 500) {
    const action = findServicePlacement(state, analysis, 'fire_station');
    if (action) {
      action.description = 'Build fire station';
      action.reason = 'population requires fire protection';
      return action;
    }
  }

  if (analysis.population > 200 && !analysis.hasPoliceStation && analysis.money >= 500) {
    const action = findServicePlacement(state, analysis, 'police_station');
    if (action) {
      action.description = 'Build police station';
      action.reason = 'growing city needs law enforcement';
      return action;
    }
  }

  // Zone based on demand - balanced approach
  const { residential, commercial, industrial } = analysis.demand;
  if (residential > 50 || commercial > 50 || industrial > 50) {
    const zoneType: BuildableZone = residential >= commercial && residential >= industrial
      ? 'residential'
      : commercial >= industrial ? 'commercial' : 'industrial';
    const action = findZonePlacement(state, analysis, zoneType);
    if (action) {
      action.description = `Zone ${zoneType}`;
      action.reason = `responding to ${Math.round(analysis.demand[zoneType])}% demand`;
      return action;
    }
  }

  // Careful road expansion
  if (analysis.money >= 25) {
    const action = findRoadExtension(state, analysis, false);
    if (action) {
      action.description = 'Extend roads';
      action.reason = 'planned growth for future development';
      return action;
    }
  }

  return null;
}

function decideAsGambler(state: GameState, analysis: CityAnalysis): AIAction | null {
  // "Feeling lucky" - Random, unpredictable, sometimes brilliant
  // Could do anything!

  const roll = Math.random();
  const thoughts = [
    'rolling the dice on this one',
    'going with my gut',
    'why not?',
    'feeling lucky today',
    'let\'s see what happens',
    'fortune favors the bold',
  ];
  const thought = thoughts[Math.floor(Math.random() * thoughts.length)];

  // 25% - Random road expansion
  if (roll < 0.25 && analysis.money >= 25) {
    const aggressive = Math.random() > 0.5;
    const action = findRoadExtension(state, analysis, aggressive);
    if (action) {
      action.description = aggressive ? 'Aggressive expansion' : 'Build road';
      action.reason = thought;
      return action;
    }
  }

  // 25% - Random zone
  if (roll < 0.50 && analysis.money >= 50) {
    const zones: BuildableZone[] = ['residential', 'commercial', 'industrial'];
    const randomZone = zones[Math.floor(Math.random() * zones.length)];
    const action = findZonePlacement(state, analysis, randomZone);
    if (action) {
      action.description = `Zone ${randomZone}`;
      action.reason = thought;
      return action;
    }
  }

  // 20% - Random service (including expensive ones!)
  if (roll < 0.70 && analysis.money >= 150) {
    const services: BuildingType[] = ['fire_station', 'police_station', 'park', 'hospital'];
    const randomService = services[Math.floor(Math.random() * services.length)];
    const action = findServicePlacement(state, analysis, randomService);
    if (action) {
      action.description = `Build ${randomService.replace('_', ' ')}`;
      action.reason = thought;
      return action;
    }
  }

  // 15% - Power plant if needed
  if (roll < 0.85 && !analysis.hasPower && analysis.money >= 3000) {
    const action = findServicePlacement(state, analysis, 'power_plant');
    if (action) {
      action.description = 'Build power plant';
      action.reason = 'even gamblers need electricity';
      return action;
    }
  }

  // 15% - Save money (strategic patience)
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

  // Create decision record with character-specific idle messages
  let decision: AgentDecision;

  if (action) {
    decision = {
      action: action.description,
      reason: action.reason,
      success: true,
    };
  } else {
    // Character-specific reasons for not acting
    const idleReasons: Record<AgentCharacter, { action: string; reason: string }> = {
      industrialist: { action: 'Building reserves', reason: 'saving for next factory expansion' },
      environmentalist: { action: 'Observing nature', reason: 'the city is balanced for now' },
      capitalist: { action: 'Analyzing markets', reason: 'waiting for better investment opportunity' },
      expansionist: { action: 'Surveying land', reason: 'planning the next expansion route' },
      planner: { action: 'Reviewing plans', reason: 'all metrics are within acceptable ranges' },
      gambler: { action: 'Holding cards', reason: 'sometimes the best move is no move' },
    };
    decision = {
      ...idleReasons[personality.character],
      success: true,
    };
  }

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
