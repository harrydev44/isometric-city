/**
 * AI System for Competitive Mode
 * 
 * Handles:
 * - AI player city management
 * - AI decision making for building and military production
 * - AI combat tactics
 */

import { Tile, BuildingType, BUILDING_STATS } from '@/types/game';
import {
  AIPlayer,
  PlayerId,
  MilitaryUnit,
  MilitaryUnitType,
  MILITARY_UNIT_STATS,
  COMPETITIVE_SETTINGS,
  AI_CITY_NAMES,
  PLAYER_COLORS,
  CompetitiveState,
} from '@/types/competitive';
import { createMilitaryUnit, findUnitPath, tileToScreen } from './militarySystem';

// Create an AI player with a city at the specified location
export function createAIPlayer(
  id: PlayerId,
  cityX: number,
  cityY: number,
  grid: Tile[][],
  gridSize: number
): AIPlayer {
  const nameIndex = parseInt(id.replace('ai', '')) - 1;
  const name = AI_CITY_NAMES[nameIndex % AI_CITY_NAMES.length];
  
  return {
    id,
    name,
    color: PLAYER_COLORS[id].primary,
    cityX,
    cityY,
    cityRadius: 10,
    money: COMPETITIVE_SETTINGS.startingMoney,
    score: 100, // Starting score
    eliminated: false,
    eliminatedAt: null,
    aggressiveness: 0.3 + Math.random() * 0.4, // 0.3-0.7
    expansionRate: 0.3 + Math.random() * 0.4, // 0.3-0.7
    lastActionTime: 0,
    unitProductionTimer: 0,
  };
}

// Initialize AI city on the grid
export function initializeAICity(
  grid: Tile[][],
  gridSize: number,
  cityX: number,
  cityY: number,
  playerId: PlayerId
): void {
  // Create a small starting city for the AI
  const buildingPositions: { x: number; y: number; type: BuildingType }[] = [
    // City center
    { x: cityX, y: cityY, type: 'city_hall' },
    // Roads around center
    { x: cityX - 2, y: cityY, type: 'road' },
    { x: cityX + 2, y: cityY, type: 'road' },
    { x: cityX, y: cityY - 2, type: 'road' },
    { x: cityX, y: cityY + 2, type: 'road' },
    // Residential
    { x: cityX - 3, y: cityY, type: 'house_small' },
    { x: cityX - 3, y: cityY - 1, type: 'house_small' },
    { x: cityX - 3, y: cityY + 1, type: 'house_small' },
    // Commercial
    { x: cityX + 3, y: cityY, type: 'shop_small' },
    { x: cityX + 3, y: cityY - 1, type: 'shop_small' },
    // Industrial
    { x: cityX, y: cityY + 3, type: 'factory_small' },
    // Power
    { x: cityX + 2, y: cityY + 2, type: 'power_plant' },
    // Barracks for military
    { x: cityX - 2, y: cityY + 2, type: 'barracks' },
  ];
  
  for (const pos of buildingPositions) {
    if (pos.x < 0 || pos.x >= gridSize || pos.y < 0 || pos.y >= gridSize) continue;
    
    const tile = grid[pos.y]?.[pos.x];
    if (!tile) continue;
    if (tile.building.type === 'water') continue;
    
    tile.building.type = pos.type;
    tile.building.level = 1;
    tile.building.constructionProgress = 100;
    tile.building.powered = true;
    tile.building.watered = true;
    
    // Set zone for zoned buildings
    if (['house_small', 'house_medium', 'apartment_low'].includes(pos.type)) {
      tile.zone = 'residential';
      tile.building.population = BUILDING_STATS[pos.type]?.maxPop || 0;
    } else if (['shop_small', 'shop_medium', 'office_low'].includes(pos.type)) {
      tile.zone = 'commercial';
      tile.building.jobs = BUILDING_STATS[pos.type]?.maxJobs || 0;
    } else if (['factory_small', 'factory_medium', 'warehouse'].includes(pos.type)) {
      tile.zone = 'industrial';
      tile.building.jobs = BUILDING_STATS[pos.type]?.maxJobs || 0;
    }
  }
}

// Update AI player logic
export function updateAIPlayer(
  ai: AIPlayer,
  delta: number,
  grid: Tile[][],
  gridSize: number,
  units: MilitaryUnit[],
  competitiveState: CompetitiveState,
  nextUnitId: number
): { 
  ai: AIPlayer; 
  newUnits: MilitaryUnit[];
  nextUnitId: number;
  unitCommands: { unitId: number; targetX: number; targetY: number; isAttack: boolean }[];
} {
  const newUnits: MilitaryUnit[] = [];
  const unitCommands: { unitId: number; targetX: number; targetY: number; isAttack: boolean }[] = [];
  
  if (ai.eliminated) {
    return { ai, newUnits, nextUnitId, unitCommands };
  }
  
  // Update production timer
  ai.unitProductionTimer += delta;
  
  // Count AI's buildings and units
  const aiUnits = units.filter(u => u.ownerId === ai.id && u.state !== 'dead');
  const aiBuildings = countPlayerBuildings(grid, gridSize, ai.cityX, ai.cityY, ai.cityRadius);
  
  // Calculate score
  ai.score = aiBuildings * COMPETITIVE_SETTINGS.scorePerBuilding + 
             aiUnits.length * COMPETITIVE_SETTINGS.scorePerUnit;
  
  // Check for elimination
  if (ai.score <= COMPETITIVE_SETTINGS.eliminationThreshold && aiUnits.length === 0 && aiBuildings <= 1) {
    ai.eliminated = true;
    ai.eliminatedAt = Date.now();
    return { ai, newUnits, nextUnitId, unitCommands };
  }
  
  // Passive income
  ai.money += aiBuildings * 2 * delta;
  
  // Produce units periodically
  const productionInterval = 10 / ai.expansionRate; // 10-33 seconds based on rate
  if (ai.unitProductionTimer >= productionInterval && ai.money >= MILITARY_UNIT_STATS.infantry.cost) {
    // Find barracks
    const barracks = findBuildingOfType(grid, gridSize, ai.cityX, ai.cityY, ai.cityRadius, 'barracks');
    if (barracks) {
      // Decide which unit to produce
      let unitType: MilitaryUnitType = 'infantry';
      if (ai.money >= MILITARY_UNIT_STATS.tank.cost && Math.random() < 0.3) {
        unitType = 'tank';
      } else if (ai.money >= MILITARY_UNIT_STATS.military_helicopter.cost && Math.random() < 0.15) {
        unitType = 'military_helicopter';
      }
      
      const cost = MILITARY_UNIT_STATS[unitType].cost;
      if (ai.money >= cost) {
        ai.money -= cost;
        const newUnit = createMilitaryUnit(nextUnitId++, unitType, ai.id, barracks.x, barracks.y);
        newUnits.push(newUnit);
        ai.unitProductionTimer = 0;
      }
    }
  }
  
  // AI decision making for combat
  if (Math.random() < ai.aggressiveness * delta) {
    // Send idle units to attack enemies
    const idleUnits = aiUnits.filter(u => u.state === 'idle');
    if (idleUnits.length > 2) { // Attack with groups of 3+
      // Find enemy units or buildings
      const enemyUnits = units.filter(u => u.ownerId !== ai.id && u.state !== 'dead');
      const playerCity = competitiveState.players.find(p => p.id === 'player');
      
      if (enemyUnits.length > 0) {
        // Attack nearest enemy unit
        const target = enemyUnits[Math.floor(Math.random() * enemyUnits.length)];
        for (const unit of idleUnits.slice(0, 3)) {
          unitCommands.push({
            unitId: unit.id,
            targetX: target.tileX,
            targetY: target.tileY,
            isAttack: true
          });
        }
      } else if (playerCity) {
        // Attack player's city
        for (const unit of idleUnits.slice(0, 3)) {
          unitCommands.push({
            unitId: unit.id,
            targetX: playerCity.cityX + Math.floor(Math.random() * 6) - 3,
            targetY: playerCity.cityY + Math.floor(Math.random() * 6) - 3,
            isAttack: true
          });
        }
      }
    }
  }
  
  return { ai, newUnits, nextUnitId, unitCommands };
}

// Count buildings in a player's territory
function countPlayerBuildings(
  grid: Tile[][],
  gridSize: number,
  centerX: number,
  centerY: number,
  radius: number
): number {
  let count = 0;
  
  for (let y = Math.max(0, centerY - radius); y < Math.min(gridSize, centerY + radius); y++) {
    for (let x = Math.max(0, centerX - radius); x < Math.min(gridSize, centerX + radius); x++) {
      const tile = grid[y]?.[x];
      if (!tile) continue;
      
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      if (dist > radius) continue;
      
      const type = tile.building.type;
      if (type !== 'grass' && type !== 'water' && type !== 'empty' && type !== 'road') {
        count++;
      }
    }
  }
  
  return count;
}

// Find a specific building type near a location
function findBuildingOfType(
  grid: Tile[][],
  gridSize: number,
  centerX: number,
  centerY: number,
  radius: number,
  buildingType: BuildingType
): { x: number; y: number } | null {
  for (let y = Math.max(0, centerY - radius); y < Math.min(gridSize, centerY + radius); y++) {
    for (let x = Math.max(0, centerX - radius); x < Math.min(gridSize, centerX + radius); x++) {
      const tile = grid[y]?.[x];
      if (!tile) continue;
      
      if (tile.building.type === buildingType) {
        return { x, y };
      }
    }
  }
  
  return null;
}

// Place AI cities on the map at strategic positions
export function placeAICities(
  grid: Tile[][],
  gridSize: number,
  playerCityX: number,
  playerCityY: number,
  aiCount: number
): { id: PlayerId; x: number; y: number }[] {
  const cities: { id: PlayerId; x: number; y: number }[] = [];
  const minDist = Math.floor(gridSize / 3); // Minimum distance between cities
  
  // AI positions - spread around the map
  const positions = [
    { x: Math.floor(gridSize * 0.75), y: Math.floor(gridSize * 0.25) },
    { x: Math.floor(gridSize * 0.25), y: Math.floor(gridSize * 0.75) },
    { x: Math.floor(gridSize * 0.75), y: Math.floor(gridSize * 0.75) },
  ];
  
  for (let i = 0; i < Math.min(aiCount, 3); i++) {
    const pos = positions[i];
    const id = `ai${i + 1}` as PlayerId;
    
    // Find a valid location near the target position (not on water)
    let foundX = pos.x;
    let foundY = pos.y;
    
    for (let attempt = 0; attempt < 50; attempt++) {
      const testX = pos.x + Math.floor(Math.random() * 10) - 5;
      const testY = pos.y + Math.floor(Math.random() * 10) - 5;
      
      if (testX < 5 || testX >= gridSize - 5 || testY < 5 || testY >= gridSize - 5) continue;
      
      const tile = grid[testY]?.[testX];
      if (tile && tile.building.type !== 'water') {
        // Check distance from player
        const distToPlayer = Math.sqrt((testX - playerCityX) ** 2 + (testY - playerCityY) ** 2);
        if (distToPlayer >= minDist) {
          foundX = testX;
          foundY = testY;
          break;
        }
      }
    }
    
    cities.push({ id, x: foundX, y: foundY });
  }
  
  return cities;
}

// Calculate overall score for each player
export function calculatePlayerScores(
  grid: Tile[][],
  gridSize: number,
  players: AIPlayer[],
  units: MilitaryUnit[]
): { id: PlayerId; score: number; buildings: number; units: number; money: number }[] {
  return players.map(player => {
    const playerUnits = units.filter(u => u.ownerId === player.id && u.state !== 'dead');
    const buildings = countPlayerBuildings(grid, gridSize, player.cityX, player.cityY, player.cityRadius);
    
    return {
      id: player.id,
      score: buildings * COMPETITIVE_SETTINGS.scorePerBuilding + 
             playerUnits.length * COMPETITIVE_SETTINGS.scorePerUnit,
      buildings,
      units: playerUnits.length,
      money: player.money,
    };
  });
}
