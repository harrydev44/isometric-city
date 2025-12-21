import { createInitialGameState, placeBuilding } from '@/lib/simulation';
import type {
  BuildingType,
  CompetitiveAge,
  CompetitivePlayer,
  CompetitiveState,
  GameState,
  MilitaryOrder,
  MilitaryUnit,
  MilitaryUnitKind,
  Tile,
} from '@/types/game';

// ============================================================================
// Competitive mode configuration
// ============================================================================

export const COMPETITIVE_GRID_SIZE_DESKTOP = 110;
export const COMPETITIVE_GRID_SIZE_MOBILE = 80;

export const UNIT_COST: Record<MilitaryUnitKind, number> = {
  infantry: 120,
  tank: 600,
  helicopter: 900,
};

export const UNIT_POP: Record<MilitaryUnitKind, number> = {
  infantry: 1,
  tank: 2,
  helicopter: 2,
};

export const UNIT_ATTACK_RANGE: Record<MilitaryUnitKind, number> = {
  infantry: 2.2,
  tank: 3.0,
  helicopter: 3.6,
};

export const UNIT_ATTACK_DAMAGE: Record<MilitaryUnitKind, number> = {
  infantry: 4,
  tank: 12,
  helicopter: 8,
};

export const UNIT_HP: Record<MilitaryUnitKind, { hp: number; maxHp: number }> = {
  infantry: { hp: 30, maxHp: 30 },
  tank: { hp: 120, maxHp: 120 },
  helicopter: { hp: 80, maxHp: 80 },
};

export const AGE_UP_COST: Record<Exclude<CompetitiveAge, 1>, number> = {
  2: 1200,
  3: 2800,
};

export function getDefaultCompetitivePlayers(
  size: number,
  localPlayerId: string,
  opponentCount: 2 | 3 = 3
): CompetitivePlayer[] {
  const padding = Math.max(12, Math.floor(size * 0.12));
  const points: Array<{ x: number; y: number }> = [
    { x: padding, y: padding }, // top-left
    { x: size - padding - 2, y: padding }, // top-right
    { x: padding, y: size - padding - 2 }, // bottom-left
  ];

  const palette = ['#60a5fa', '#f87171', '#34d399', '#fbbf24'] as const;

  const local: CompetitivePlayer = {
    id: localPlayerId,
    name: 'You',
    color: palette[0],
    isAI: false,
    eliminated: false,
    money: 800,
    score: 0,
    age: 1,
    popCap: 10,
    baseX: points[0].x,
    baseY: points[0].y,
  };

  const aiNames = ['AI: Red', 'AI: Green', 'AI: Gold'];
  const aiPlayers: CompetitivePlayer[] = [];
  for (let i = 0; i < opponentCount; i++) {
    const pt = points[i + 1];
    aiPlayers.push({
      id: `ai-${i + 1}-${Math.random().toString(16).slice(2)}`,
      name: aiNames[i] ?? `AI ${i + 1}`,
      color: palette[i + 1] ?? '#f87171',
      isAI: true,
      eliminated: false,
      money: 900,
      score: 0,
      age: 1,
      popCap: 10,
      baseX: pt.x,
      baseY: pt.y,
      aiNextActionTick: 0,
    });
  }

  return [local, ...aiPlayers];
}

function isBuildableLand(tile: Tile | undefined): boolean {
  if (!tile) return false;
  const t = tile.building.type;
  return t !== 'water';
}

function clampBaseToLand(grid: Tile[][], size: number, x: number, y: number): { x: number; y: number } {
  if (isBuildableLand(grid[y]?.[x])) return { x, y };
  // Spiral search outward for nearest non-water tile
  for (let r = 1; r <= 12; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        if (isBuildableLand(grid[ny]?.[nx])) return { x: nx, y: ny };
      }
    }
  }
  return { x, y };
}

function setOwnerForBuildingOrigin(state: GameState, x: number, y: number, ownerId: string): GameState {
  const row = state.grid[y];
  const tile = row?.[x];
  if (!tile) return state;
  if (tile.building.type === 'water') return state;

  // Shallow clone row + tile + building (fast, isolated)
  const newRow = row.slice();
  const newTile = { ...tile, building: { ...tile.building, ownerId } };
  newRow[x] = newTile;
  const newGrid = state.grid.slice();
  newGrid[y] = newRow;
  return { ...state, grid: newGrid };
}

function placeStarterBase(state: GameState, player: CompetitivePlayer): GameState {
  const size = state.gridSize;
  const adjusted = clampBaseToLand(state.grid, size, player.baseX, player.baseY);
  player.baseX = adjusted.x;
  player.baseY = adjusted.y;

  let next = state;

  // Town center
  next = placeBuilding(next, player.baseX, player.baseY, 'city_hall', null);
  next = setOwnerForBuildingOrigin(next, player.baseX, player.baseY, player.id);

  // A little infrastructure (gives the map some life)
  const baseRoads: Array<{ x: number; y: number }> = [
    { x: player.baseX + 2, y: player.baseY + 1 },
    { x: player.baseX + 1, y: player.baseY + 2 },
    { x: player.baseX + 2, y: player.baseY + 2 },
    { x: player.baseX + 3, y: player.baseY + 2 },
    { x: player.baseX + 2, y: player.baseY + 3 },
  ];
  for (const r of baseRoads) {
    if (r.x < 0 || r.y < 0 || r.x >= size || r.y >= size) continue;
    next = placeBuilding(next, r.x, r.y, 'road', null);
  }

  // A couple "houses" to seed a population cap mechanic
  const houses: Array<{ x: number; y: number; type: BuildingType }> = [
    { x: player.baseX + 4, y: player.baseY + 2, type: 'house_small' },
    { x: player.baseX + 2, y: player.baseY + 4, type: 'house_small' },
  ];
  for (const h of houses) {
    if (h.x < 0 || h.y < 0 || h.x >= size || h.y >= size) continue;
    next = placeBuilding(next, h.x, h.y, h.type, null);
    next = setOwnerForBuildingOrigin(next, h.x, h.y, player.id);
  }

  // A "factory" so tanks feel thematically grounded later
  const factory = { x: player.baseX + 5, y: player.baseY + 3, type: 'factory_small' as const };
  if (factory.x >= 0 && factory.y >= 0 && factory.x < size && factory.y < size) {
    next = placeBuilding(next, factory.x, factory.y, factory.type, null);
    next = setOwnerForBuildingOrigin(next, factory.x, factory.y, player.id);
  }

  // An airport tile (for helicopters) – keep it simple for now
  const airport = { x: player.baseX + 6, y: player.baseY + 1, type: 'airport' as const };
  if (airport.x >= 0 && airport.y >= 0 && airport.x < size && airport.y < size) {
    next = placeBuilding(next, airport.x, airport.y, airport.type, null);
    next = setOwnerForBuildingOrigin(next, airport.x, airport.y, player.id);
  }

  return next;
}

export function createCompetitiveGameState(options?: { opponentCount?: 2 | 3; cityName?: string }): GameState {
  const isMobile =
    typeof window !== 'undefined' &&
    (window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
  const size = isMobile ? COMPETITIVE_GRID_SIZE_MOBILE : COMPETITIVE_GRID_SIZE_DESKTOP;

  const base = createInitialGameState(size, options?.cityName ?? 'Warfront');
  const localPlayerId = base.id;
  const players = getDefaultCompetitivePlayers(size, localPlayerId, options?.opponentCount ?? 3);

  let next: GameState = {
    ...base,
    cityName: options?.cityName ?? 'Warfront',
    gameMode: 'competitive',
    disastersEnabled: true, // keep fire simulation enabled; random fires are disabled in competitive tick logic
    stats: {
      ...base.stats,
      money: players.find(p => p.id === localPlayerId)?.money ?? 800,
      population: 0,
      jobs: 0,
      income: 0,
      expenses: 0,
    },
    competitive: {
      localPlayerId,
      players,
      selectedUnitIds: [],
    } satisfies CompetitiveState,
    militaryUnits: [],
  };

  // Place starter bases for each player
  for (const p of players) {
    next = placeStarterBase(next, p);
  }

  // Seed each player with a couple of scouts
  next = trainUnit(next, localPlayerId, 'infantry');
  next = trainUnit(next, localPlayerId, 'infantry');
  for (const p of players) {
    if (!p.isAI) continue;
    next = trainUnit(next, p.id, 'infantry');
    next = trainUnit(next, p.id, 'infantry');
  }

  // Compute initial score/caps
  next = recomputeCompetitiveDerived(next);
  return next;
}

// ============================================================================
// Runtime / tick
// ============================================================================

function tileDistance(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function computePopCapFromBuildings(grid: Tile[][], size: number, ownerId: string): number {
  let cap = 10;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const b = grid[y][x].building;
      if (b.ownerId !== ownerId) continue;
      if (b.type === 'house_small') cap += 4;
      else if (b.type === 'house_medium') cap += 8;
      else if (b.type === 'apartment_low') cap += 16;
      else if (b.type === 'apartment_high') cap += 24;
    }
  }
  return cap;
}

function computeScore(grid: Tile[][], size: number, ownerId: string, money: number, units: MilitaryUnit[]): number {
  let buildingScore = 0;
  let popScore = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const b = grid[y][x].building;
      if (b.ownerId !== ownerId) continue;
      if (b.type === 'grass' || b.type === 'water' || b.type === 'road' || b.type === 'rail' || b.type === 'tree' || b.type === 'empty') continue;
      buildingScore += 10;
      popScore += b.population || 0;
    }
  }
  const unitScore = units.filter(u => u.ownerId === ownerId).length * 5;
  return Math.floor(money + buildingScore + unitScore + popScore * 0.2);
}

function computePassiveIncome(grid: Tile[][], size: number, ownerId: string): number {
  // A small RTS-like trickle + bonuses for owning key buildings.
  let income = 10;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const b = grid[y][x].building;
      if (b.ownerId !== ownerId) continue;
      if (b.type === 'city_hall') income += 12;
      else if (b.type === 'factory_small' || b.type === 'factory_medium' || b.type === 'factory_large') income += 6;
      else if (b.type === 'airport') income += 5;
      else if (b.type === 'shop_small' || b.type === 'shop_medium' || b.type === 'mall') income += 3;
    }
  }
  return income;
}

function findBuildingOrigin(grid: Tile[][], x: number, y: number, size: number): { originX: number; originY: number } | null {
  const tile = grid[y]?.[x];
  if (!tile) return null;
  const t = tile.building.type;
  const isStructural =
    t !== 'empty' && t !== 'grass' && t !== 'water' && t !== 'road' && t !== 'rail' && t !== 'tree';
  if (isStructural) {
    return { originX: x, originY: y };
  }
  if (t === 'empty') {
    const maxSize = 4;
    for (let dy = 0; dy < maxSize; dy++) {
      for (let dx = 0; dx < maxSize; dx++) {
        const checkX = x - dx;
        const checkY = y - dy;
        if (checkX < 0 || checkY < 0 || checkX >= size || checkY >= size) continue;
        const bt = grid[checkY][checkX].building.type;
        const isOriginStructural =
          bt !== 'empty' && bt !== 'grass' && bt !== 'water' && bt !== 'road' && bt !== 'rail' && bt !== 'tree';
        if (isOriginStructural) return { originX: checkX, originY: checkY };
      }
    }
  }
  return null;
}

function createGrassBuilding(): Tile['building'] {
  return {
    type: 'grass',
    level: 0,
    population: 0,
    jobs: 0,
    powered: false,
    watered: false,
    onFire: false,
    fireProgress: 0,
    age: 0,
    constructionProgress: 100,
    abandoned: false,
  };
}

function applyCombatDamage(
  state: GameState,
  x: number,
  y: number,
  amount: number
): GameState {
  const size = state.gridSize;
  const origin = findBuildingOrigin(state.grid, x, y, size);
  if (!origin) return state;
  const { originX, originY } = origin;

  const row = state.grid[originY];
  const tile = row?.[originX];
  if (!tile) return state;

  // Clone only what we touch
  const newRow = row.slice();
  const building = { ...tile.building };

  // Only burn down structural (non-terrain) buildings
  const t = building.type;
  const isStructural =
    t !== 'empty' && t !== 'grass' && t !== 'water' && t !== 'road' && t !== 'rail' && t !== 'tree';
  if (!isStructural) return state;

  building.onFire = true;
  building.fireProgress = Math.min(100, (building.fireProgress || 0) + amount);

  const newTile = { ...tile, building };
  newRow[originX] = newTile;
  const newGrid = state.grid.slice();
  newGrid[originY] = newRow;

  // If the building is fully burned, remove it immediately (AoE-style feedback)
  if (building.fireProgress >= 100) {
    const clearedRow = newGrid[originY].slice();
    const clearedTile = { ...clearedRow[originX], building: createGrassBuilding(), zone: 'none' as const };
    clearedRow[originX] = clearedTile;
    newGrid[originY] = clearedRow;
  }

  return { ...state, grid: newGrid };
}

function countUnitsByOwner(units: MilitaryUnit[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const u of units) {
    m.set(u.ownerId, (m.get(u.ownerId) ?? 0) + 1);
  }
  return m;
}

function isPlayerAlive(grid: Tile[][], size: number, playerId: string): boolean {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const b = grid[y][x].building;
      if (b.type === 'city_hall' && b.ownerId === playerId) {
        return true;
      }
    }
  }
  return false;
}

function makeUnitId(ownerId: string): string {
  return `${ownerId}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function trainUnit(state: GameState, ownerId: string, kind: MilitaryUnitKind): GameState {
  if (!state.competitive) return state;
  const players = state.competitive.players.map(p => ({ ...p }));
  const player = players.find(p => p.id === ownerId);
  if (!player || player.eliminated) return state;

  const unitsByOwner = countUnitsByOwner(state.militaryUnits);
  const currentPop = (unitsByOwner.get(ownerId) ?? 0) * 1; // infantry=1, but tanks/helis will count as 2; adjust below
  const currentPopExact = state.militaryUnits
    .filter(u => u.ownerId === ownerId)
    .reduce((sum, u) => sum + (UNIT_POP[u.kind] ?? 1), 0);

  const popCost = UNIT_POP[kind] ?? 1;
  if (currentPopExact + popCost > player.popCap) return state;

  const cost = UNIT_COST[kind] ?? 0;
  if (player.money < cost) return state;

  // Age gates (simple progression)
  if (kind === 'helicopter' && player.age < 2) return state;
  if (kind === 'tank' && player.age < 3) return state;

  player.money -= cost;

  const hp = UNIT_HP[kind];
  const unit: MilitaryUnit = {
    id: makeUnitId(ownerId),
    ownerId,
    kind,
    tileX: player.baseX + 1,
    tileY: player.baseY + 1,
    path: [],
    pathIndex: 0,
    progress: 0,
    order: { type: 'idle' },
    attackCooldown: 0,
    hp: hp.hp,
    maxHp: hp.maxHp,
  };

  const nextUnits = [...state.militaryUnits, unit];

  // Keep local stats.money in sync (used all over existing UI)
  const localId = state.competitive.localPlayerId;
  const localPlayer = players.find(p => p.id === localId);
  const nextStatsMoney = localPlayer ? localPlayer.money : state.stats.money;

  return recomputeCompetitiveDerived({
    ...state,
    stats: { ...state.stats, money: nextStatsMoney },
    competitive: { ...state.competitive!, players },
    militaryUnits: nextUnits,
  });
}

export function setSelectedUnits(state: GameState, ids: string[]): GameState {
  if (!state.competitive) return state;
  return {
    ...state,
    competitive: {
      ...state.competitive!,
      selectedUnitIds: ids,
    },
  };
}

function computeDirectPath(fromX: number, fromY: number, toX: number, toY: number): Array<{ x: number; y: number }> {
  const path: Array<{ x: number; y: number }> = [{ x: fromX, y: fromY }];
  let x = fromX;
  let y = fromY;
  const maxSteps = 300;
  let steps = 0;
  while ((x !== toX || y !== toY) && steps < maxSteps) {
    steps++;
    if (x < toX) x++;
    else if (x > toX) x--;
    if (y < toY) y++;
    else if (y > toY) y--;
    path.push({ x, y });
  }
  return path;
}

export function issueOrder(
  state: GameState,
  unitIds: string[],
  order: MilitaryOrder
): GameState {
  if (!state.competitive) return state;
  if (!unitIds.length) return state;

  const size = state.gridSize;
  const nextUnits = state.militaryUnits.map(u => {
    if (!unitIds.includes(u.id)) return u;
    const next: MilitaryUnit = { ...u, order: { ...order } };
    if (order.type === 'move' || order.type === 'attack') {
      const tx = Math.max(0, Math.min(size - 1, order.targetX ?? u.tileX));
      const ty = Math.max(0, Math.min(size - 1, order.targetY ?? u.tileY));
      next.path = computeDirectPath(u.tileX, u.tileY, tx, ty);
      next.pathIndex = 0;
      next.progress = 0;
    } else {
      next.path = [];
      next.pathIndex = 0;
      next.progress = 0;
    }
    return next;
  });

  return { ...state, militaryUnits: nextUnits };
}

export function upgradeAge(state: GameState, playerId: string): GameState {
  if (!state.competitive) return state;
  const players = state.competitive.players.map(p => ({ ...p }));
  const p = players.find(pp => pp.id === playerId);
  if (!p || p.eliminated) return state;

  if (p.age === 1) {
    const cost = AGE_UP_COST[2];
    if (p.money < cost) return state;
    p.money -= cost;
    p.age = 2;
  } else if (p.age === 2) {
    const cost = AGE_UP_COST[3];
    if (p.money < cost) return state;
    p.money -= cost;
    p.age = 3;
  } else {
    return state;
  }

  const localId = state.competitive.localPlayerId;
  const localPlayer = players.find(pp => pp.id === localId);
  const nextStatsMoney = localPlayer ? localPlayer.money : state.stats.money;

  return recomputeCompetitiveDerived({
    ...state,
    stats: { ...state.stats, money: nextStatsMoney },
    competitive: { ...state.competitive!, players },
  });
}

export function simulateCompetitiveTick(state: GameState): GameState {
  if (state.gameMode !== 'competitive' || !state.competitive) return state;
  const size = state.gridSize;
  const competitive: CompetitiveState = state.competitive;

  // Approximate tick dt (seconds) based on the sim tick interval
  const dt = state.speed === 1 ? 0.5 : state.speed === 2 ? 0.22 : state.speed === 3 ? 0.05 : 0;
  if (dt <= 0) return state;

  let next: GameState = state;

  // Update elimination state
  const players = state.competitive.players.map(p => ({ ...p }));
  for (const p of players) {
    const alive = isPlayerAlive(next.grid, size, p.id);
    if (!alive) {
      p.eliminated = true;
    }
  }

  // Remove units for eliminated players
  let units = next.militaryUnits.filter(u => !players.find(p => p.id === u.ownerId)?.eliminated);

  // Economy tick (trickle + owned buildings)
  for (const p of players) {
    if (p.eliminated) continue;
    const income = computePassiveIncome(next.grid, size, p.id);
    p.money += Math.floor(income * dt);
  }

  // Recompute pop cap from owned buildings
  for (const p of players) {
    if (p.eliminated) continue;
    p.popCap = computePopCapFromBuildings(next.grid, size, p.id);
  }

  // AI actions (simple: train units + attack closest enemy base)
  const localId = competitive.localPlayerId;
  const localPlayer = players.find(p => p.id === localId);
  const enemyTownCenters: Array<{ ownerId: string; x: number; y: number }> = players
    .filter(p => !p.eliminated)
    .map(p => ({ ownerId: p.id, x: p.baseX, y: p.baseY }));

  for (const p of players) {
    if (!p.isAI || p.eliminated) continue;
    if ((p.aiNextActionTick ?? 0) > state.tick) continue;

    // Age up opportunistically
    if (p.age === 1 && p.money >= AGE_UP_COST[2] + 300) {
      p.money -= AGE_UP_COST[2];
      p.age = 2;
    } else if (p.age === 2 && p.money >= AGE_UP_COST[3] + 500) {
      p.money -= AGE_UP_COST[3];
      p.age = 3;
    }

    // Train: keep a small standing army
    const currentPop = units.filter(u => u.ownerId === p.id).reduce((sum, u) => sum + (UNIT_POP[u.kind] ?? 1), 0);
    const desiredPop = Math.min(p.popCap, 14);
    if (currentPop < desiredPop) {
      const kind: MilitaryUnitKind = p.age >= 3 ? 'tank' : p.age >= 2 ? (Math.random() < 0.35 ? 'helicopter' : 'infantry') : 'infantry';
      const cost = UNIT_COST[kind];
      if (p.money >= cost && currentPop + UNIT_POP[kind] <= p.popCap) {
        p.money -= cost;
        const hp = UNIT_HP[kind];
        units.push({
          id: makeUnitId(p.id),
          ownerId: p.id,
          kind,
          tileX: p.baseX + 1,
          tileY: p.baseY + 1,
          path: [],
          pathIndex: 0,
          progress: 0,
          order: { type: 'idle' },
          attackCooldown: 0,
          hp: hp.hp,
          maxHp: hp.maxHp,
        });
      }
    }

    // Attack the nearest enemy town center (prefer the human)
    const target: { x: number; y: number; ownerId: string } | undefined = localPlayer && !localPlayer.eliminated
      ? { x: localPlayer.baseX, y: localPlayer.baseY, ownerId: localPlayer.id }
      : enemyTownCenters.find(t => t.ownerId !== p.id);

    if (target) {
      const aiUnits = units.filter(u => u.ownerId === p.id);
      if (aiUnits.length >= 3) {
        const ids = new Set(aiUnits.map(u => u.id));
        const order: MilitaryOrder = { type: 'attack', targetX: target.x, targetY: target.y, targetBuildingOwnerId: target.ownerId };
        units = units.map(u => {
          if (!ids.has(u.id)) return u;
          const updated: MilitaryUnit = { ...u, order: { ...order } };
          updated.path = computeDirectPath(u.tileX, u.tileY, target.x, target.y);
          updated.pathIndex = 0;
          updated.progress = 0;
          return updated;
        });
      }
    }

    // Next action in a few ticks
    p.aiNextActionTick = state.tick + 6 + Math.floor(Math.random() * 6);
  }

  // Unit movement + combat
  const updatedUnits: MilitaryUnit[] = [];
  for (const u of units) {
    const unit: MilitaryUnit = { ...u };
    // Cooldown decay
    unit.attackCooldown = Math.max(0, unit.attackCooldown - dt);

    // Move along path
    if (unit.path.length > 1 && unit.pathIndex < unit.path.length - 1) {
      const speedTilesPerSecond =
        unit.kind === 'infantry' ? 2.4 :
        unit.kind === 'tank' ? 2.1 :
        3.0; // helicopter
      unit.progress += dt * speedTilesPerSecond;
      while (unit.progress >= 1 && unit.pathIndex < unit.path.length - 1) {
        unit.progress -= 1;
        unit.pathIndex += 1;
        const pos = unit.path[unit.pathIndex];
        unit.tileX = pos.x;
        unit.tileY = pos.y;
      }
    }

    // Attack buildings
    if (unit.order.type === 'attack' && unit.order.targetX !== undefined && unit.order.targetY !== undefined) {
      const dist = tileDistance(unit.tileX, unit.tileY, unit.order.targetX, unit.order.targetY);
      const range = UNIT_ATTACK_RANGE[unit.kind];
      if (dist <= range && unit.attackCooldown <= 0) {
        // Only attack if target tile currently belongs to an enemy building (owner check)
        const origin = findBuildingOrigin(next.grid, unit.order.targetX, unit.order.targetY, size);
        if (origin) {
          const b = next.grid[origin.originY][origin.originX].building;
          const targetOwner = b.ownerId;
          if (targetOwner && targetOwner !== unit.ownerId && !players.find(p => p.id === targetOwner)?.eliminated) {
            next = applyCombatDamage(next, origin.originX, origin.originY, UNIT_ATTACK_DAMAGE[unit.kind]);
            unit.attackCooldown = 0.7; // one shot every ~0.7s
          } else {
            // Target already neutral/friendly/dead: stop
            unit.order = { type: 'idle' };
            unit.path = [];
            unit.pathIndex = 0;
            unit.progress = 0;
          }
        }
      }
    }

    updatedUnits.push(unit);
  }

  // Winner detection
  const alivePlayers = players.filter(p => !p.eliminated);
  let winnerId = (next.competitive as CompetitiveState | undefined)?.winnerId;
  if (alivePlayers.length === 1) {
    winnerId = alivePlayers[0].id;
  }

  // Sync local stats.money and recompute scores
  const syncedLocalPlayer = players.find(p => p.id === localId);
  const nextStatsMoney = syncedLocalPlayer ? syncedLocalPlayer.money : next.stats.money;

  const compFinal = next.competitive as CompetitiveState;
  next = {
    ...next,
    stats: { ...next.stats, money: nextStatsMoney },
    competitive: {
      localPlayerId: compFinal.localPlayerId,
      selectedUnitIds: compFinal.selectedUnitIds,
      players,
      winnerId,
    } as CompetitiveState,
    militaryUnits: updatedUnits,
  };

  return recomputeCompetitiveDerived(next);
}

export function recomputeCompetitiveDerived(state: GameState): GameState {
  if (!state.competitive) return state;
  const size = state.gridSize;
  const players = state.competitive.players.map(p => ({ ...p }));
  for (const p of players) {
    p.popCap = computePopCapFromBuildings(state.grid, size, p.id);
    p.score = computeScore(state.grid, size, p.id, p.money, state.militaryUnits);
  }

  // Keep local stats.money synchronized (legacy UI)
  const local = players.find(p => p.id === state.competitive!.localPlayerId);
  const nextStatsMoney = local ? local.money : state.stats.money;

  return {
    ...state,
    stats: { ...state.stats, money: nextStatsMoney },
    competitive: { ...state.competitive!, players },
  };
}

