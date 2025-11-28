/**
 * Vehicle update logic for cars, emergency vehicles, and pedestrians.
 * Extracted from CanvasIsometricGrid.tsx for better code organization.
 */

import { Tile, BuildingType } from '@/types/game';
import {
  Car,
  CarDirection,
  EmergencyVehicle,
  EmergencyVehicleType,
  Pedestrian,
  PedestrianDestType,
  WorldRenderState,
} from './types';
import {
  CAR_COLORS,
  PEDESTRIAN_SKIN_COLORS,
  PEDESTRIAN_SHIRT_COLORS,
  DIRECTION_META,
} from './constants';
import {
  isRoadTile,
  getDirectionOptions,
  pickNextDirection,
  findPathOnRoads,
  getDirectionToTile,
} from './utils';
import {
  findResidentialBuildings,
  findPedestrianDestinations,
  findStations,
  findFires,
} from './gridFinders';

// ============================================================================
// Types
// ============================================================================

export type CrimeIncident = {
  x: number;
  y: number;
  type: 'robbery' | 'burglary' | 'disturbance' | 'traffic';
  timeRemaining: number;
};

export type VehicleRefs = {
  cars: React.MutableRefObject<Car[]>;
  carId: React.MutableRefObject<number>;
  carSpawnTimer: React.MutableRefObject<number>;
  emergencyVehicles: React.MutableRefObject<EmergencyVehicle[]>;
  emergencyVehicleId: React.MutableRefObject<number>;
  emergencyDispatchTimer: React.MutableRefObject<number>;
  activeFires: React.MutableRefObject<Set<string>>;
  activeCrimes: React.MutableRefObject<Set<string>>;
  activeCrimeIncidents: React.MutableRefObject<Map<string, CrimeIncident>>;
  crimeSpawnTimer: React.MutableRefObject<number>;
  pedestrians: React.MutableRefObject<Pedestrian[]>;
  pedestrianId: React.MutableRefObject<number>;
  pedestrianSpawnTimer: React.MutableRefObject<number>;
};

// ============================================================================
// Car Functions
// ============================================================================

/**
 * Spawn a random car on a road tile.
 */
export function spawnRandomCar(
  worldState: WorldRenderState,
  carsRef: React.MutableRefObject<Car[]>,
  carIdRef: React.MutableRefObject<number>
): boolean {
  const { grid, gridSize } = worldState;
  if (!grid || gridSize <= 0) return false;

  for (let attempt = 0; attempt < 20; attempt++) {
    const tileX = Math.floor(Math.random() * gridSize);
    const tileY = Math.floor(Math.random() * gridSize);
    if (!isRoadTile(grid, gridSize, tileX, tileY)) continue;

    const options = getDirectionOptions(grid, gridSize, tileX, tileY);
    if (options.length === 0) continue;

    const direction = options[Math.floor(Math.random() * options.length)];
    carsRef.current.push({
      id: carIdRef.current++,
      tileX,
      tileY,
      direction,
      progress: Math.random() * 0.8,
      speed: (0.35 + Math.random() * 0.35) * 0.7,
      age: 0,
      maxAge: 1800 + Math.random() * 2700,
      color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
      laneOffset: (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 3),
    });
    return true;
  }

  return false;
}

/**
 * Update all cars - movement, spawning, and lifecycle.
 */
export function updateCars(
  delta: number,
  worldState: WorldRenderState,
  carsRef: React.MutableRefObject<Car[]>,
  carIdRef: React.MutableRefObject<number>,
  carSpawnTimerRef: React.MutableRefObject<number>,
  isMobile: boolean
): void {
  const { grid, gridSize, speed } = worldState;
  if (!grid || gridSize <= 0) {
    carsRef.current = [];
    return;
  }

  // Speed multiplier: 0 = paused, 1 = normal, 2 = fast (2x), 3 = very fast (4x)
  const speedMultiplier = speed === 0 ? 0 : speed === 1 ? 1 : speed === 2 ? 2.5 : 4;

  // Reduce max cars on mobile for better performance
  const baseMaxCars = 160;
  const maxCars = Math.min(baseMaxCars, Math.max(16, Math.floor(gridSize * 2)));
  carSpawnTimerRef.current -= delta;
  if (carsRef.current.length < maxCars && carSpawnTimerRef.current <= 0) {
    if (spawnRandomCar(worldState, carsRef, carIdRef)) {
      carSpawnTimerRef.current = 0.9 + Math.random() * 1.3;
    } else {
      carSpawnTimerRef.current = 0.5;
    }
  }

  const updatedCars: Car[] = [];
  for (const car of [...carsRef.current]) {
    let alive = true;

    car.age += delta;
    if (car.age > car.maxAge) {
      continue;
    }

    if (!isRoadTile(grid, gridSize, car.tileX, car.tileY)) {
      continue;
    }

    car.progress += car.speed * delta * speedMultiplier;
    let guard = 0;
    while (car.progress >= 1 && guard < 4) {
      guard++;
      const meta = DIRECTION_META[car.direction];
      car.tileX += meta.step.x;
      car.tileY += meta.step.y;

      if (!isRoadTile(grid, gridSize, car.tileX, car.tileY)) {
        alive = false;
        break;
      }

      car.progress -= 1;
      const nextDirection = pickNextDirection(car.direction, grid, gridSize, car.tileX, car.tileY);
      if (!nextDirection) {
        alive = false;
        break;
      }
      car.direction = nextDirection;
    }

    if (alive) {
      updatedCars.push(car);
    }
  }

  carsRef.current = updatedCars;
}

// ============================================================================
// Pedestrian Functions
// ============================================================================

/**
 * Spawn a pedestrian from a residential building to a destination.
 */
export function spawnPedestrian(
  worldState: WorldRenderState,
  pedestriansRef: React.MutableRefObject<Pedestrian[]>,
  pedestrianIdRef: React.MutableRefObject<number>
): boolean {
  const { grid, gridSize } = worldState;
  if (!grid || gridSize <= 0) return false;

  const residentials = findResidentialBuildings(grid, gridSize);
  if (residentials.length === 0) {
    return false;
  }

  const destinations = findPedestrianDestinations(grid, gridSize);
  if (destinations.length === 0) {
    return false;
  }

  // Pick a random residential building as home
  const home = residentials[Math.floor(Math.random() * residentials.length)];

  // Pick a random destination
  const dest = destinations[Math.floor(Math.random() * destinations.length)];

  // Find path from home to destination via roads
  const path = findPathOnRoads(grid, gridSize, home.x, home.y, dest.x, dest.y);
  if (!path || path.length === 0) {
    return false;
  }

  // Start at a random point along the path for better distribution
  const startIndex = Math.floor(Math.random() * path.length);
  const startTile = path[startIndex];

  // Determine initial direction based on next tile in path
  let direction: CarDirection = 'south';
  if (startIndex + 1 < path.length) {
    const nextTile = path[startIndex + 1];
    const dir = getDirectionToTile(startTile.x, startTile.y, nextTile.x, nextTile.y);
    if (dir) direction = dir;
  } else if (startIndex > 0) {
    // At end of path, use previous tile to determine direction
    const prevTile = path[startIndex - 1];
    const dir = getDirectionToTile(prevTile.x, prevTile.y, startTile.x, startTile.y);
    if (dir) direction = dir;
  }

  pedestriansRef.current.push({
    id: pedestrianIdRef.current++,
    tileX: startTile.x,
    tileY: startTile.y,
    direction,
    progress: Math.random(),
    speed: 0.12 + Math.random() * 0.08, // Pedestrians are slower than cars
    pathIndex: startIndex,
    age: 0,
    maxAge: 60 + Math.random() * 90, // 60-150 seconds lifespan
    skinColor: PEDESTRIAN_SKIN_COLORS[Math.floor(Math.random() * PEDESTRIAN_SKIN_COLORS.length)],
    shirtColor: PEDESTRIAN_SHIRT_COLORS[Math.floor(Math.random() * PEDESTRIAN_SHIRT_COLORS.length)],
    walkOffset: Math.random() * Math.PI * 2,
    sidewalkSide: Math.random() < 0.5 ? 'left' : 'right',
    destType: dest.type,
    homeX: home.x,
    homeY: home.y,
    destX: dest.x,
    destY: dest.y,
    returningHome: startIndex >= path.length - 1, // If starting at end, they're returning
    path,
  });

  return true;
}

/**
 * Update all pedestrians - movement and lifecycle.
 */
export function updatePedestrians(
  delta: number,
  worldState: WorldRenderState,
  pedestriansRef: React.MutableRefObject<Pedestrian[]>,
  pedestrianIdRef: React.MutableRefObject<number>,
  pedestrianSpawnTimerRef: React.MutableRefObject<number>,
  cachedRoadTileCountRef: React.MutableRefObject<{ count: number; gridVersion: number }>,
  gridVersionRef: React.MutableRefObject<number>,
  minZoomForPedestrians: number,
  isMobile: boolean
): void {
  const { grid, gridSize, speed, zoom } = worldState;

  // Clear pedestrians if zoomed out
  if (zoom < minZoomForPedestrians) {
    pedestriansRef.current = [];
    return;
  }

  if (!grid || gridSize <= 0) {
    pedestriansRef.current = [];
    return;
  }

  // Speed multiplier
  const speedMultiplier = speed === 0 ? 0 : speed === 1 ? 1 : speed === 2 ? 2.5 : 4;

  // Get cached road tile count (only recalculate when grid changes)
  const currentGridVersion = gridVersionRef.current;
  let roadTileCount: number;
  if (cachedRoadTileCountRef.current.gridVersion === currentGridVersion) {
    roadTileCount = cachedRoadTileCountRef.current.count;
  } else {
    // Recalculate and cache
    roadTileCount = 0;
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        if (grid[y][x].building.type === 'road') {
          roadTileCount++;
        }
      }
    }
    cachedRoadTileCountRef.current = { count: roadTileCount, gridVersion: currentGridVersion };
  }

  // Spawn pedestrians - scale with road network size, reduced on mobile
  const maxPedestrians = isMobile
    ? Math.min(50, Math.max(20, Math.floor(roadTileCount * 0.8)))
    : Math.max(200, roadTileCount * 3);
  pedestrianSpawnTimerRef.current -= delta;
  if (pedestriansRef.current.length < maxPedestrians && pedestrianSpawnTimerRef.current <= 0) {
    // Spawn fewer pedestrians at once on mobile
    let spawnedCount = 0;
    const spawnBatch = isMobile
      ? Math.min(8, Math.max(3, Math.floor(roadTileCount / 25)))
      : Math.min(50, Math.max(20, Math.floor(roadTileCount / 10)));
    for (let i = 0; i < spawnBatch; i++) {
      if (spawnPedestrian(worldState, pedestriansRef, pedestrianIdRef)) {
        spawnedCount++;
      }
    }
    // Slower spawn rate on mobile
    pedestrianSpawnTimerRef.current = spawnedCount > 0 ? (isMobile ? 0.15 : 0.02) : (isMobile ? 0.08 : 0.01);
  }

  const updatedPedestrians: Pedestrian[] = [];

  for (const ped of [...pedestriansRef.current]) {
    let alive = true;

    // Update age
    ped.age += delta;
    if (ped.age > ped.maxAge) {
      continue;
    }

    // Update walk animation
    ped.walkOffset += delta * 8;

    // Check if still on valid road
    if (!isRoadTile(grid, gridSize, ped.tileX, ped.tileY)) {
      continue;
    }

    // Move pedestrian along path
    ped.progress += ped.speed * delta * speedMultiplier;

    // Handle single-tile paths (already at destination)
    if (ped.path.length === 1 && ped.progress >= 1) {
      if (!ped.returningHome) {
        ped.returningHome = true;
        const returnPath = findPathOnRoads(grid, gridSize, ped.destX, ped.destY, ped.homeX, ped.homeY);
        if (returnPath && returnPath.length > 0) {
          ped.path = returnPath;
          ped.pathIndex = 0;
          ped.progress = 0;
          ped.tileX = returnPath[0].x;
          ped.tileY = returnPath[0].y;
          if (returnPath.length > 1) {
            const nextTile = returnPath[1];
            const dir = getDirectionToTile(returnPath[0].x, returnPath[0].y, nextTile.x, nextTile.y);
            if (dir) ped.direction = dir;
          }
        } else {
          continue; // Remove pedestrian
        }
      } else {
        continue; // Arrived home, remove
      }
    }

    while (ped.progress >= 1 && ped.pathIndex < ped.path.length - 1) {
      ped.pathIndex++;
      ped.progress -= 1;

      const currentTile = ped.path[ped.pathIndex];

      // Bounds check
      if (currentTile.x < 0 || currentTile.x >= gridSize ||
          currentTile.y < 0 || currentTile.y >= gridSize) {
        alive = false;
        break;
      }

      ped.tileX = currentTile.x;
      ped.tileY = currentTile.y;

      // Check if reached end of path
      if (ped.pathIndex >= ped.path.length - 1) {
        if (!ped.returningHome) {
          // Arrived at destination - start returning home
          ped.returningHome = true;
          const returnPath = findPathOnRoads(grid, gridSize, ped.destX, ped.destY, ped.homeX, ped.homeY);
          if (returnPath && returnPath.length > 0) {
            ped.path = returnPath;
            ped.pathIndex = 0;
            ped.progress = 0;
            // Update direction for return trip
            if (returnPath.length > 1) {
              const nextTile = returnPath[1];
              const dir = getDirectionToTile(returnPath[0].x, returnPath[0].y, nextTile.x, nextTile.y);
              if (dir) ped.direction = dir;
            }
          } else {
            alive = false;
          }
        } else {
          // Arrived back home - remove pedestrian
          alive = false;
        }
        break;
      }

      // Update direction for next segment
      if (ped.pathIndex + 1 < ped.path.length) {
        const nextTile = ped.path[ped.pathIndex + 1];
        const dir = getDirectionToTile(ped.tileX, ped.tileY, nextTile.x, nextTile.y);
        if (dir) ped.direction = dir;
      }
    }

    // Handle case where pedestrian is already at the last tile with progress >= 1
    if (alive && ped.progress >= 1 && ped.pathIndex >= ped.path.length - 1) {
      if (!ped.returningHome) {
        ped.returningHome = true;
        const returnPath = findPathOnRoads(grid, gridSize, ped.destX, ped.destY, ped.homeX, ped.homeY);
        if (returnPath && returnPath.length > 0) {
          ped.path = returnPath;
          ped.pathIndex = 0;
          ped.progress = 0;
          ped.tileX = returnPath[0].x;
          ped.tileY = returnPath[0].y;
          if (returnPath.length > 1) {
            const nextTile = returnPath[1];
            const dir = getDirectionToTile(returnPath[0].x, returnPath[0].y, nextTile.x, nextTile.y);
            if (dir) ped.direction = dir;
          }
        } else {
          alive = false;
        }
      } else {
        alive = false;
      }
    }

    if (alive) {
      updatedPedestrians.push(ped);
    }
  }

  pedestriansRef.current = updatedPedestrians;
}

// ============================================================================
// Emergency Vehicle Functions
// ============================================================================

/**
 * Dispatch an emergency vehicle from a station to a target location.
 */
export function dispatchEmergencyVehicle(
  type: EmergencyVehicleType,
  stationX: number,
  stationY: number,
  targetX: number,
  targetY: number,
  worldState: WorldRenderState,
  emergencyVehiclesRef: React.MutableRefObject<EmergencyVehicle[]>,
  emergencyVehicleIdRef: React.MutableRefObject<number>
): boolean {
  const { grid, gridSize } = worldState;
  if (!grid || gridSize <= 0) return false;

  const path = findPathOnRoads(grid, gridSize, stationX, stationY, targetX, targetY);
  if (!path || path.length === 0) return false;

  const startTile = path[0];
  let direction: CarDirection = 'south';

  // If path has at least 2 tiles, get direction from first to second
  if (path.length >= 2) {
    const nextTile = path[1];
    const dir = getDirectionToTile(startTile.x, startTile.y, nextTile.x, nextTile.y);
    if (dir) direction = dir;
  }

  emergencyVehiclesRef.current.push({
    id: emergencyVehicleIdRef.current++,
    type,
    tileX: startTile.x,
    tileY: startTile.y,
    direction,
    progress: 0,
    speed: type === 'fire_truck' ? 0.8 : 0.9, // Emergency vehicles are faster
    state: 'dispatching',
    stationX,
    stationY,
    targetX,
    targetY,
    path,
    pathIndex: 0,
    respondTime: 0,
    laneOffset: 0, // Emergency vehicles drive in the center
    flashTimer: 0,
  });

  return true;
}

/**
 * Update emergency dispatch logic - find fires and crimes, dispatch vehicles.
 */
export function updateEmergencyDispatch(
  worldState: WorldRenderState,
  emergencyVehiclesRef: React.MutableRefObject<EmergencyVehicle[]>,
  emergencyVehicleIdRef: React.MutableRefObject<number>,
  activeFiresRef: React.MutableRefObject<Set<string>>,
  activeCrimesRef: React.MutableRefObject<Set<string>>,
  activeCrimeIncidentsRef: React.MutableRefObject<Map<string, CrimeIncident>>
): void {
  const { grid, gridSize, speed } = worldState;
  if (!grid || gridSize <= 0 || speed === 0) return;

  const fires = findFires(grid, gridSize);
  const fireStations = findStations(grid, gridSize, 'fire_station');

  for (const fire of fires) {
    const fireKey = `${fire.x},${fire.y}`;
    if (activeFiresRef.current.has(fireKey)) continue;

    // Find nearest fire station
    let nearestStation: { x: number; y: number } | null = null;
    let nearestDist = Infinity;

    for (const station of fireStations) {
      const dist = Math.abs(station.x - fire.x) + Math.abs(station.y - fire.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestStation = station;
      }
    }

    if (nearestStation) {
      if (dispatchEmergencyVehicle(
        'fire_truck', nearestStation.x, nearestStation.y, fire.x, fire.y,
        worldState, emergencyVehiclesRef, emergencyVehicleIdRef
      )) {
        activeFiresRef.current.add(fireKey);
      }
    }
  }

  // Find crimes that need police dispatched
  const crimes = Array.from(activeCrimeIncidentsRef.current.values()).map(c => ({ x: c.x, y: c.y }));
  const policeStations = findStations(grid, gridSize, 'police_station');

  // Limit police dispatches per update
  let dispatched = 0;
  const maxDispatchPerCheck = Math.max(3, Math.min(6, policeStations.length * 2));
  for (const crime of crimes) {
    if (dispatched >= maxDispatchPerCheck) break;

    const crimeKey = `${crime.x},${crime.y}`;
    if (activeCrimesRef.current.has(crimeKey)) continue;

    // Find nearest police station
    let nearestStation: { x: number; y: number } | null = null;
    let nearestDist = Infinity;

    for (const station of policeStations) {
      const dist = Math.abs(station.x - crime.x) + Math.abs(station.y - crime.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestStation = station;
      }
    }

    if (nearestStation) {
      if (dispatchEmergencyVehicle(
        'police_car', nearestStation.x, nearestStation.y, crime.x, crime.y,
        worldState, emergencyVehiclesRef, emergencyVehicleIdRef
      )) {
        activeCrimesRef.current.add(crimeKey);
        dispatched++;
      }
    }
  }
}

/**
 * Update emergency vehicles movement and state.
 */
export function updateEmergencyVehicles(
  delta: number,
  worldState: WorldRenderState,
  emergencyVehiclesRef: React.MutableRefObject<EmergencyVehicle[]>,
  emergencyDispatchTimerRef: React.MutableRefObject<number>,
  emergencyVehicleIdRef: React.MutableRefObject<number>,
  activeFiresRef: React.MutableRefObject<Set<string>>,
  activeCrimesRef: React.MutableRefObject<Set<string>>,
  activeCrimeIncidentsRef: React.MutableRefObject<Map<string, CrimeIncident>>
): void {
  const { grid, gridSize, speed } = worldState;
  if (!grid || gridSize <= 0) {
    emergencyVehiclesRef.current = [];
    return;
  }

  const speedMultiplier = speed === 0 ? 0 : speed === 1 ? 1 : speed === 2 ? 2.5 : 4;

  // Dispatch check every second or so
  emergencyDispatchTimerRef.current -= delta;
  if (emergencyDispatchTimerRef.current <= 0) {
    updateEmergencyDispatch(
      worldState,
      emergencyVehiclesRef,
      emergencyVehicleIdRef,
      activeFiresRef,
      activeCrimesRef,
      activeCrimeIncidentsRef
    );
    emergencyDispatchTimerRef.current = 1.5;
  }

  const updatedVehicles: EmergencyVehicle[] = [];

  for (const vehicle of [...emergencyVehiclesRef.current]) {
    // Update flash timer for lights
    vehicle.flashTimer += delta * 8;

    const targetKey = `${vehicle.targetX},${vehicle.targetY}`;

    // Helper function to clear tracking
    const clearTracking = () => {
      if (vehicle.type === 'fire_truck') {
        activeFiresRef.current.delete(targetKey);
      } else {
        activeCrimesRef.current.delete(targetKey);
        activeCrimeIncidentsRef.current.delete(targetKey);
      }
    };

    if (vehicle.state === 'responding') {
      // Check if vehicle is still on a valid road
      if (!isRoadTile(grid, gridSize, vehicle.tileX, vehicle.tileY)) {
        clearTracking();
        continue;
      }

      // At the scene - spend some time responding
      vehicle.respondTime += delta * speedMultiplier;
      const respondDuration = vehicle.type === 'fire_truck' ? 8 : 5;

      if (vehicle.respondTime >= respondDuration) {
        // Done responding - clear crime incident for police
        if (vehicle.type === 'police_car') {
          activeCrimeIncidentsRef.current.delete(targetKey);
        }

        const returnPath = findPathOnRoads(
          grid, gridSize,
          vehicle.tileX, vehicle.tileY,
          vehicle.stationX, vehicle.stationY
        );

        if (returnPath && returnPath.length >= 2) {
          vehicle.path = returnPath;
          vehicle.pathIndex = 0;
          vehicle.state = 'returning';
          vehicle.progress = 0;

          const nextTile = returnPath[1];
          const dir = getDirectionToTile(vehicle.tileX, vehicle.tileY, nextTile.x, nextTile.y);
          if (dir) vehicle.direction = dir;
        } else if (returnPath && returnPath.length === 1) {
          clearTracking();
          continue;
        } else {
          clearTracking();
          continue;
        }
      }

      updatedVehicles.push(vehicle);
      continue;
    }

    // Check if vehicle is still on a valid road
    if (!isRoadTile(grid, gridSize, vehicle.tileX, vehicle.tileY)) {
      clearTracking();
      continue;
    }

    // Bounds check
    if (vehicle.tileX < 0 || vehicle.tileX >= gridSize ||
        vehicle.tileY < 0 || vehicle.tileY >= gridSize) {
      clearTracking();
      continue;
    }

    // Move vehicle along path
    vehicle.progress += vehicle.speed * delta * speedMultiplier;

    let shouldRemove = false;

    // Handle edge case: path has only 1 tile
    if (vehicle.path.length === 1 && vehicle.state === 'dispatching') {
      vehicle.state = 'responding';
      vehicle.respondTime = 0;
      vehicle.progress = 0;
      updatedVehicles.push(vehicle);
      continue;
    }

    while (vehicle.progress >= 1 && vehicle.pathIndex < vehicle.path.length - 1) {
      vehicle.pathIndex++;
      vehicle.progress -= 1;

      const currentTile = vehicle.path[vehicle.pathIndex];

      // Validate next tile is in bounds
      if (currentTile.x < 0 || currentTile.x >= gridSize ||
          currentTile.y < 0 || currentTile.y >= gridSize) {
        shouldRemove = true;
        break;
      }

      vehicle.tileX = currentTile.x;
      vehicle.tileY = currentTile.y;

      // Check if reached destination
      if (vehicle.pathIndex >= vehicle.path.length - 1) {
        if (vehicle.state === 'dispatching') {
          vehicle.state = 'responding';
          vehicle.respondTime = 0;
          vehicle.progress = 0;
        } else if (vehicle.state === 'returning') {
          shouldRemove = true;
        }
        break;
      }

      // Update direction for next segment
      if (vehicle.pathIndex + 1 < vehicle.path.length) {
        const nextTile = vehicle.path[vehicle.pathIndex + 1];
        const dir = getDirectionToTile(vehicle.tileX, vehicle.tileY, nextTile.x, nextTile.y);
        if (dir) vehicle.direction = dir;
      }
    }

    if (shouldRemove) {
      clearTracking();
      continue;
    }

    updatedVehicles.push(vehicle);
  }

  emergencyVehiclesRef.current = updatedVehicles;
}

// ============================================================================
// Crime Incident Functions
// ============================================================================

/**
 * Spawn new crime incidents periodically.
 */
export function spawnCrimeIncidents(
  delta: number,
  worldState: WorldRenderState,
  activeCrimeIncidentsRef: React.MutableRefObject<Map<string, CrimeIncident>>,
  crimeSpawnTimerRef: React.MutableRefObject<number>,
  policeServices: number[][],
  population: number
): void {
  const { grid, gridSize, speed } = worldState;
  if (!grid || gridSize <= 0 || speed === 0) return;

  const speedMultiplier = speed === 1 ? 1 : speed === 2 ? 2 : 3;
  crimeSpawnTimerRef.current -= delta * speedMultiplier;

  // Spawn new crimes every 3-5 seconds (game time adjusted)
  if (crimeSpawnTimerRef.current > 0) return;
  crimeSpawnTimerRef.current = 3 + Math.random() * 2;

  // Collect eligible tiles for crime (buildings with activity)
  const eligibleTiles: { x: number; y: number; policeCoverage: number }[] = [];

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const tile = grid[y][x];
      const isBuilding = tile.building.type !== 'grass' &&
          tile.building.type !== 'water' &&
          tile.building.type !== 'road' &&
          tile.building.type !== 'tree' &&
          tile.building.type !== 'empty';
      const hasActivity = tile.building.population > 0 || tile.building.jobs > 0;

      if (isBuilding && hasActivity) {
        const policeCoverage = policeServices[y]?.[x] || 0;
        eligibleTiles.push({ x, y, policeCoverage });
      }
    }
  }

  if (eligibleTiles.length === 0) return;

  // Determine crime spawn probability based on coverage
  const avgCoverage = eligibleTiles.reduce((sum, t) => sum + t.policeCoverage, 0) / eligibleTiles.length;
  const baseChance = avgCoverage < 20 ? 0.4 : avgCoverage < 40 ? 0.25 : avgCoverage < 60 ? 0.15 : 0.08;

  // Max active crimes based on population
  const maxActiveCrimes = Math.max(2, Math.floor(population / 500));

  if (activeCrimeIncidentsRef.current.size >= maxActiveCrimes) return;

  // Try to spawn 1-2 crimes
  const crimesToSpawn = Math.random() < 0.3 ? 2 : 1;

  for (let i = 0; i < crimesToSpawn; i++) {
    if (activeCrimeIncidentsRef.current.size >= maxActiveCrimes) break;
    if (Math.random() > baseChance) continue;

    // Weight selection toward low-coverage areas
    const weightedTiles = eligibleTiles.filter(t => {
      const key = `${t.x},${t.y}`;
      if (activeCrimeIncidentsRef.current.has(key)) return false;
      const weight = Math.max(0.1, 1 - t.policeCoverage / 100);
      return Math.random() < weight;
    });

    if (weightedTiles.length === 0) continue;

    const target = weightedTiles[Math.floor(Math.random() * weightedTiles.length)];
    const key = `${target.x},${target.y}`;

    // Different crime types with different durations
    const crimeTypes: Array<'robbery' | 'burglary' | 'disturbance' | 'traffic'> = ['robbery', 'burglary', 'disturbance', 'traffic'];
    const crimeType = crimeTypes[Math.floor(Math.random() * crimeTypes.length)];
    const duration = crimeType === 'traffic' ? 15 : crimeType === 'disturbance' ? 20 : 30;

    activeCrimeIncidentsRef.current.set(key, {
      x: target.x,
      y: target.y,
      type: crimeType,
      timeRemaining: duration,
    });
  }
}

/**
 * Update crime incidents - decay over time if not responded to.
 */
export function updateCrimeIncidents(
  delta: number,
  worldState: WorldRenderState,
  activeCrimeIncidentsRef: React.MutableRefObject<Map<string, CrimeIncident>>,
  activeCrimesRef: React.MutableRefObject<Set<string>>
): void {
  const { speed } = worldState;
  if (speed === 0) return;

  const speedMultiplier = speed === 1 ? 1 : speed === 2 ? 2 : 3;
  const keysToDelete: string[] = [];

  activeCrimeIncidentsRef.current.forEach((crime, key) => {
    // If police car is responding, don't decay
    if (activeCrimesRef.current.has(key)) return;

    // Update time remaining
    const newTimeRemaining = crime.timeRemaining - delta * speedMultiplier;
    if (newTimeRemaining <= 0) {
      keysToDelete.push(key);
    } else {
      activeCrimeIncidentsRef.current.set(key, { ...crime, timeRemaining: newTimeRemaining });
    }
  });

  keysToDelete.forEach(key => activeCrimeIncidentsRef.current.delete(key));
}
