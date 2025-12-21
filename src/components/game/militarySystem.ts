/**
 * Military System for Competitive Mode
 * 
 * Handles:
 * - Military unit creation and management
 * - Unit movement and pathfinding
 * - Combat between units and buildings
 * - Attack mechanics using fire system for building destruction
 */

import { Tile, BuildingType } from '@/types/game';
import {
  MilitaryUnit,
  MilitaryUnitType,
  PlayerId,
  MILITARY_UNIT_STATS,
  PLAYER_COLORS,
  CompetitiveState,
} from '@/types/competitive';
import { TILE_WIDTH, TILE_HEIGHT, CarDirection } from './types';

// Convert tile coordinates to screen position
export function tileToScreen(tileX: number, tileY: number): { x: number; y: number } {
  const screenX = (tileX - tileY) * (TILE_WIDTH / 2);
  const screenY = (tileX + tileY) * (TILE_HEIGHT / 2);
  return { x: screenX + TILE_WIDTH / 2, y: screenY + TILE_HEIGHT / 2 };
}

// Convert screen position to tile coordinates
export function screenToTile(screenX: number, screenY: number): { tileX: number; tileY: number } {
  const tileX = Math.floor((screenX / (TILE_WIDTH / 2) + screenY / (TILE_HEIGHT / 2)) / 2);
  const tileY = Math.floor((screenY / (TILE_HEIGHT / 2) - screenX / (TILE_WIDTH / 2)) / 2);
  return { tileX, tileY };
}

// Create a new military unit
export function createMilitaryUnit(
  id: number,
  type: MilitaryUnitType,
  ownerId: PlayerId,
  tileX: number,
  tileY: number
): MilitaryUnit {
  const stats = MILITARY_UNIT_STATS[type];
  const screenPos = tileToScreen(tileX, tileY);
  
  return {
    id,
    type,
    ownerId,
    x: screenPos.x,
    y: screenPos.y,
    tileX,
    tileY,
    targetX: null,
    targetY: null,
    path: [],
    pathIndex: 0,
    speed: stats.speed,
    health: stats.health,
    maxHealth: stats.health,
    damage: stats.damage,
    attackRange: stats.range,
    attackCooldown: 1, // 1 second between attacks
    currentCooldown: 0,
    state: 'idle',
    targetUnitId: null,
    targetBuildingX: null,
    targetBuildingY: null,
    direction: 'south',
    animationFrame: 0,
    selected: false,
  };
}

// Get direction from current position to target
export function getDirection(fromX: number, fromY: number, toX: number, toY: number): CarDirection {
  const dx = toX - fromX;
  const dy = toY - fromY;
  
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'east' : 'west';
  } else {
    return dy > 0 ? 'south' : 'north';
  }
}

// Simple A* pathfinding for units (can walk on any non-water tile)
export function findUnitPath(
  grid: Tile[][],
  gridSize: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  isAirUnit: boolean = false
): { x: number; y: number }[] {
  // Air units can fly in straight lines
  if (isAirUnit) {
    return [{ x: startX, y: startY }, { x: endX, y: endY }];
  }
  
  // Simple BFS for ground units
  const queue: { x: number; y: number; path: { x: number; y: number }[] }[] = [
    { x: startX, y: startY, path: [{ x: startX, y: startY }] }
  ];
  const visited = new Set<string>();
  visited.add(`${startX},${startY}`);
  
  const directions = [
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
  ];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    
    if (current.x === endX && current.y === endY) {
      return current.path;
    }
    
    for (const dir of directions) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      const key = `${nx},${ny}`;
      
      if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) continue;
      if (visited.has(key)) continue;
      
      const tile = grid[ny]?.[nx];
      if (!tile) continue;
      
      // Can walk on any tile except water (unless it's destination)
      const isDestination = nx === endX && ny === endY;
      if (tile.building.type === 'water' && !isDestination) continue;
      
      visited.add(key);
      queue.push({
        x: nx,
        y: ny,
        path: [...current.path, { x: nx, y: ny }]
      });
    }
  }
  
  // No path found
  return [];
}

// Update a single military unit
export function updateMilitaryUnit(
  unit: MilitaryUnit,
  delta: number,
  grid: Tile[][],
  gridSize: number,
  allUnits: MilitaryUnit[],
  competitiveState: CompetitiveState
): { unit: MilitaryUnit; setBuildingOnFire?: { x: number; y: number } } {
  // Update cooldown
  if (unit.currentCooldown > 0) {
    unit.currentCooldown -= delta;
  }
  
  // Update animation
  unit.animationFrame += delta * 8;
  
  // Handle different states
  switch (unit.state) {
    case 'idle': {
      // Check for nearby enemies to auto-attack
      const nearestEnemy = findNearestEnemy(unit, allUnits, unit.attackRange);
      if (nearestEnemy) {
        unit.targetUnitId = nearestEnemy.id;
        unit.state = 'attacking';
      }
      break;
    }
    
    case 'moving': {
      if (unit.path.length === 0 || unit.pathIndex >= unit.path.length) {
        unit.state = 'idle';
        unit.targetX = null;
        unit.targetY = null;
        break;
      }
      
      const target = unit.path[unit.pathIndex];
      const targetScreen = tileToScreen(target.x, target.y);
      const dx = targetScreen.x - unit.x;
      const dy = targetScreen.y - unit.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 5) {
        // Reached waypoint
        unit.tileX = target.x;
        unit.tileY = target.y;
        unit.pathIndex++;
        
        if (unit.pathIndex >= unit.path.length) {
          unit.state = 'idle';
          unit.targetX = null;
          unit.targetY = null;
          
          // Check if we have an attack target
          if (unit.targetBuildingX !== null && unit.targetBuildingY !== null) {
            unit.state = 'attacking';
          }
        }
      } else {
        // Move toward waypoint
        const moveX = (dx / dist) * unit.speed * delta;
        const moveY = (dy / dist) * unit.speed * delta;
        unit.x += moveX;
        unit.y += moveY;
        unit.direction = getDirection(unit.x, unit.y, targetScreen.x, targetScreen.y);
      }
      break;
    }
    
    case 'attacking': {
      // Attacking a unit
      if (unit.targetUnitId !== null) {
        const targetUnit = allUnits.find(u => u.id === unit.targetUnitId);
        
        if (!targetUnit || targetUnit.state === 'dead') {
          unit.targetUnitId = null;
          unit.state = 'idle';
          break;
        }
        
        const dx = targetUnit.x - unit.x;
        const dy = targetUnit.y - unit.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > unit.attackRange) {
          // Move toward target
          const path = findUnitPath(
            grid, gridSize,
            unit.tileX, unit.tileY,
            targetUnit.tileX, targetUnit.tileY,
            unit.type === 'military_helicopter'
          );
          if (path.length > 0) {
            unit.path = path;
            unit.pathIndex = 0;
            unit.state = 'moving';
          }
        } else if (unit.currentCooldown <= 0) {
          // Attack!
          targetUnit.health -= unit.damage;
          unit.currentCooldown = unit.attackCooldown;
          unit.direction = getDirection(unit.x, unit.y, targetUnit.x, targetUnit.y);
          
          if (targetUnit.health <= 0) {
            targetUnit.state = 'dead';
            unit.targetUnitId = null;
            unit.state = 'idle';
          }
        }
        break;
      }
      
      // Attacking a building
      if (unit.targetBuildingX !== null && unit.targetBuildingY !== null) {
        const targetScreen = tileToScreen(unit.targetBuildingX, unit.targetBuildingY);
        const dx = targetScreen.x - unit.x;
        const dy = targetScreen.y - unit.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > unit.attackRange) {
          // Move toward target
          const path = findUnitPath(
            grid, gridSize,
            unit.tileX, unit.tileY,
            unit.targetBuildingX, unit.targetBuildingY,
            unit.type === 'military_helicopter'
          );
          if (path.length > 0) {
            unit.path = path;
            unit.pathIndex = 0;
            // Keep attacking state but also move
          }
        } else if (unit.currentCooldown <= 0) {
          // Attack the building - set it on fire!
          unit.currentCooldown = unit.attackCooldown;
          unit.direction = getDirection(unit.x, unit.y, targetScreen.x, targetScreen.y);
          
          const tile = grid[unit.targetBuildingY]?.[unit.targetBuildingX];
          if (tile && tile.building.type !== 'grass' && tile.building.type !== 'water' && tile.building.type !== 'empty') {
            // Return signal to set building on fire
            return {
              unit,
              setBuildingOnFire: { x: unit.targetBuildingX, y: unit.targetBuildingY }
            };
          } else {
            // Building destroyed or doesn't exist
            unit.targetBuildingX = null;
            unit.targetBuildingY = null;
            unit.state = 'idle';
          }
        }
        break;
      }
      
      // No target, go idle
      unit.state = 'idle';
      break;
    }
    
    case 'dead':
      // Unit is dead, will be cleaned up
      break;
  }
  
  return { unit };
}

// Find nearest enemy unit within range
function findNearestEnemy(
  unit: MilitaryUnit,
  allUnits: MilitaryUnit[],
  maxRange: number
): MilitaryUnit | null {
  let nearest: MilitaryUnit | null = null;
  let nearestDist = maxRange;
  
  for (const other of allUnits) {
    if (other.ownerId === unit.ownerId) continue;
    if (other.state === 'dead') continue;
    
    const dx = other.x - unit.x;
    const dy = other.y - unit.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < nearestDist) {
      nearest = other;
      nearestDist = dist;
    }
  }
  
  return nearest;
}

// Command units to move to a position
export function commandUnitsMove(
  units: MilitaryUnit[],
  selectedIds: number[],
  targetTileX: number,
  targetTileY: number,
  grid: Tile[][],
  gridSize: number
): MilitaryUnit[] {
  return units.map(unit => {
    if (!selectedIds.includes(unit.id)) return unit;
    
    const path = findUnitPath(
      grid, gridSize,
      unit.tileX, unit.tileY,
      targetTileX, targetTileY,
      unit.type === 'military_helicopter'
    );
    
    if (path.length > 0) {
      return {
        ...unit,
        path,
        pathIndex: 0,
        targetX: targetTileX,
        targetY: targetTileY,
        state: 'moving' as const,
        targetUnitId: null,
        targetBuildingX: null,
        targetBuildingY: null,
      };
    }
    
    return unit;
  });
}

// Command units to attack a building
export function commandUnitsAttack(
  units: MilitaryUnit[],
  selectedIds: number[],
  targetTileX: number,
  targetTileY: number,
  grid: Tile[][],
  gridSize: number
): MilitaryUnit[] {
  return units.map(unit => {
    if (!selectedIds.includes(unit.id)) return unit;
    
    const path = findUnitPath(
      grid, gridSize,
      unit.tileX, unit.tileY,
      targetTileX, targetTileY,
      unit.type === 'military_helicopter'
    );
    
    return {
      ...unit,
      path,
      pathIndex: 0,
      targetX: targetTileX,
      targetY: targetTileY,
      state: 'moving' as const,
      targetUnitId: null,
      targetBuildingX: targetTileX,
      targetBuildingY: targetTileY,
    };
  });
}

// Draw military units
export function drawMilitaryUnits(
  ctx: CanvasRenderingContext2D,
  units: MilitaryUnit[],
  offset: { x: number; y: number },
  zoom: number,
  selectedIds: number[]
) {
  ctx.save();
  
  for (const unit of units) {
    if (unit.state === 'dead') continue;
    
    const screenX = (unit.x + offset.x) * zoom;
    const screenY = (unit.y + offset.y) * zoom;
    
    const isSelected = selectedIds.includes(unit.id);
    const color = PLAYER_COLORS[unit.ownerId];
    
    ctx.save();
    ctx.translate(screenX, screenY);
    
    // Draw selection circle
    if (isSelected) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 4 * zoom, 15 * zoom, 8 * zoom, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Draw health bar
    const healthPercent = unit.health / unit.maxHealth;
    const barWidth = 20 * zoom;
    const barHeight = 3 * zoom;
    
    ctx.fillStyle = '#333';
    ctx.fillRect(-barWidth / 2, -25 * zoom, barWidth, barHeight);
    
    ctx.fillStyle = healthPercent > 0.5 ? '#22c55e' : healthPercent > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(-barWidth / 2, -25 * zoom, barWidth * healthPercent, barHeight);
    
    // Draw unit based on type
    switch (unit.type) {
      case 'infantry': {
        // Draw infantry soldier
        ctx.fillStyle = color.primary;
        ctx.beginPath();
        ctx.arc(0, -8 * zoom, 4 * zoom, 0, Math.PI * 2);
        ctx.fill();
        
        // Body
        ctx.fillStyle = color.secondary;
        ctx.fillRect(-4 * zoom, -4 * zoom, 8 * zoom, 12 * zoom);
        
        // Legs (animated)
        const legOffset = Math.sin(unit.animationFrame) * 3 * zoom;
        ctx.fillStyle = '#333';
        ctx.fillRect(-3 * zoom, 8 * zoom + legOffset, 2 * zoom, 6 * zoom);
        ctx.fillRect(1 * zoom, 8 * zoom - legOffset, 2 * zoom, 6 * zoom);
        break;
      }
      
      case 'tank': {
        // Draw tank
        const angle = unit.direction === 'north' ? -Math.PI / 2 :
                     unit.direction === 'south' ? Math.PI / 2 :
                     unit.direction === 'east' ? 0 : Math.PI;
        
        ctx.save();
        ctx.rotate(angle);
        
        // Tank body
        ctx.fillStyle = color.secondary;
        ctx.fillRect(-12 * zoom, -8 * zoom, 24 * zoom, 16 * zoom);
        
        // Turret
        ctx.fillStyle = color.primary;
        ctx.beginPath();
        ctx.arc(0, 0, 6 * zoom, 0, Math.PI * 2);
        ctx.fill();
        
        // Barrel
        ctx.fillStyle = '#333';
        ctx.fillRect(0, -2 * zoom, 15 * zoom, 4 * zoom);
        
        // Tracks
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-14 * zoom, -10 * zoom, 28 * zoom, 3 * zoom);
        ctx.fillRect(-14 * zoom, 7 * zoom, 28 * zoom, 3 * zoom);
        
        ctx.restore();
        break;
      }
      
      case 'military_helicopter': {
        // Draw attack helicopter
        ctx.save();
        
        // Shadow on ground
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(0, 15 * zoom, 12 * zoom, 6 * zoom, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Helicopter body (elevated)
        ctx.translate(0, -20 * zoom);
        
        ctx.fillStyle = color.primary;
        ctx.beginPath();
        ctx.moveTo(-15 * zoom, 0);
        ctx.lineTo(15 * zoom, 0);
        ctx.lineTo(10 * zoom, 5 * zoom);
        ctx.lineTo(-10 * zoom, 5 * zoom);
        ctx.closePath();
        ctx.fill();
        
        // Tail
        ctx.fillStyle = color.secondary;
        ctx.fillRect(-25 * zoom, -2 * zoom, 15 * zoom, 4 * zoom);
        
        // Cockpit
        ctx.fillStyle = 'rgba(135, 206, 235, 0.8)';
        ctx.beginPath();
        ctx.ellipse(8 * zoom, 0, 6 * zoom, 4 * zoom, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Rotor (animated)
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2 * zoom;
        const rotorAngle = unit.animationFrame * 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(rotorAngle) * 18 * zoom, Math.sin(rotorAngle) * 6 * zoom - 8 * zoom);
        ctx.lineTo(Math.cos(rotorAngle + Math.PI) * 18 * zoom, Math.sin(rotorAngle + Math.PI) * 6 * zoom - 8 * zoom);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(Math.cos(rotorAngle + Math.PI / 2) * 18 * zoom, Math.sin(rotorAngle + Math.PI / 2) * 6 * zoom - 8 * zoom);
        ctx.lineTo(Math.cos(rotorAngle + Math.PI * 1.5) * 18 * zoom, Math.sin(rotorAngle + Math.PI * 1.5) * 6 * zoom - 8 * zoom);
        ctx.stroke();
        
        ctx.restore();
        break;
      }
    }
    
    ctx.restore();
  }
  
  ctx.restore();
}

// Draw selection box
export function drawSelectionBox(
  ctx: CanvasRenderingContext2D,
  box: { startX: number; startY: number; endX: number; endY: number },
  zoom: number
) {
  const left = Math.min(box.startX, box.endX);
  const top = Math.min(box.startY, box.endY);
  const width = Math.abs(box.endX - box.startX);
  const height = Math.abs(box.endY - box.startY);
  
  ctx.save();
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(left, top, width, height);
  
  ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
  ctx.fillRect(left, top, width, height);
  ctx.restore();
}

// Get units within a selection box
export function getUnitsInSelectionBox(
  units: MilitaryUnit[],
  box: { startX: number; startY: number; endX: number; endY: number },
  offset: { x: number; y: number },
  zoom: number,
  ownerId: PlayerId
): number[] {
  const left = Math.min(box.startX, box.endX);
  const top = Math.min(box.startY, box.endY);
  const right = Math.max(box.startX, box.endX);
  const bottom = Math.max(box.startY, box.endY);
  
  const selected: number[] = [];
  
  for (const unit of units) {
    if (unit.ownerId !== ownerId) continue;
    if (unit.state === 'dead') continue;
    
    const screenX = (unit.x + offset.x) * zoom;
    const screenY = (unit.y + offset.y) * zoom;
    
    if (screenX >= left && screenX <= right && screenY >= top && screenY <= bottom) {
      selected.push(unit.id);
    }
  }
  
  return selected;
}
