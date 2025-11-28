/**
 * Boat update logic for water navigation.
 * Extracted from CanvasIsometricGrid.tsx for better code organization.
 */

import { Boat, TourWaypoint, WorldRenderState, TILE_WIDTH, TILE_HEIGHT } from './types';
import {
  BOAT_COLORS,
  BOAT_MIN_ZOOM,
  WAKE_MAX_AGE,
  WAKE_SPAWN_INTERVAL,
} from './constants';
import { gridToScreen, screenToGrid } from './utils';
import { findMarinasAndPiers, findAdjacentWaterTile, generateTourWaypoints, isOverWater } from './gridFinders';

// ============================================================================
// Types
// ============================================================================

export type BoatRefs = {
  boats: React.MutableRefObject<Boat[]>;
  boatId: React.MutableRefObject<number>;
  boatSpawnTimer: React.MutableRefObject<number>;
};

// ============================================================================
// Boat Functions
// ============================================================================

/**
 * Update boats - spawn, move, and manage lifecycle.
 */
export function updateBoats(
  delta: number,
  worldState: WorldRenderState,
  boatsRef: React.MutableRefObject<Boat[]>,
  boatIdRef: React.MutableRefObject<number>,
  boatSpawnTimerRef: React.MutableRefObject<number>,
  isMobile: boolean
): void {
  const { grid, gridSize, speed, zoom } = worldState;

  if (!grid || gridSize <= 0 || speed === 0) {
    return;
  }

  // Clear boats if zoomed out too far
  if (zoom < BOAT_MIN_ZOOM) {
    boatsRef.current = [];
    return;
  }

  // Find marinas and piers
  const docks = findMarinasAndPiers(grid, gridSize);

  // No boats if no docks
  if (docks.length === 0) {
    boatsRef.current = [];
    return;
  }

  // Calculate max boats based on number of docks
  const maxBoats = Math.min(25, docks.length * 3);

  // Speed multiplier based on game speed
  const speedMultiplier = speed === 1 ? 1 : speed === 2 ? 1.5 : 2;

  // Spawn timer
  boatSpawnTimerRef.current -= delta;
  if (boatsRef.current.length < maxBoats && boatSpawnTimerRef.current <= 0) {
    // Pick a random dock as home base
    const homeDock = docks[Math.floor(Math.random() * docks.length)];

    // Find adjacent water tile for positioning
    const waterTile = findAdjacentWaterTile(grid, gridSize, homeDock.x, homeDock.y);
    if (waterTile) {
      // Generate tour waypoints within the connected body of water
      const tourWaypoints = generateTourWaypoints(grid, gridSize, waterTile.x, waterTile.y);

      // Convert to screen coordinates
      const { screenX: originScreenX, screenY: originScreenY } = gridToScreen(waterTile.x, waterTile.y, 0, 0);
      const homeScreenX = originScreenX + TILE_WIDTH / 2;
      const homeScreenY = originScreenY + TILE_HEIGHT / 2;

      // Set first tour waypoint as initial destination
      let firstDestScreenX = homeScreenX;
      let firstDestScreenY = homeScreenY;
      if (tourWaypoints.length > 0) {
        firstDestScreenX = tourWaypoints[0].screenX;
        firstDestScreenY = tourWaypoints[0].screenY;
      }

      // Calculate angle to first destination
      const angle = Math.atan2(firstDestScreenY - originScreenY, firstDestScreenX - originScreenX);

      boatsRef.current.push({
        id: boatIdRef.current++,
        x: homeScreenX,
        y: homeScreenY,
        angle: angle,
        targetAngle: angle,
        state: 'departing',
        speed: 15 + Math.random() * 10,
        originX: homeDock.x,
        originY: homeDock.y,
        destX: homeDock.x,
        destY: homeDock.y,
        destScreenX: firstDestScreenX,
        destScreenY: firstDestScreenY,
        age: 0,
        color: BOAT_COLORS[Math.floor(Math.random() * BOAT_COLORS.length)],
        wake: [],
        wakeSpawnProgress: 0,
        sizeVariant: Math.random() < 0.7 ? 0 : 1,
        tourWaypoints: tourWaypoints,
        tourWaypointIndex: 0,
        homeScreenX: homeScreenX,
        homeScreenY: homeScreenY,
      });
    }

    boatSpawnTimerRef.current = 1 + Math.random() * 2;
  }

  // Update existing boats
  const updatedBoats: Boat[] = [];

  for (const boat of boatsRef.current) {
    boat.age += delta;

    // Update wake particles
    const wakeMaxAge = isMobile ? 0.6 : WAKE_MAX_AGE;
    boat.wake = boat.wake
      .map(p => ({ ...p, age: p.age + delta, opacity: Math.max(0, 1 - p.age / wakeMaxAge) }))
      .filter(p => p.age < wakeMaxAge);

    // Distance to destination
    const distToDest = Math.hypot(boat.x - boat.destScreenX, boat.y - boat.destScreenY);

    // Calculate next position
    let nextX = boat.x;
    let nextY = boat.y;

    switch (boat.state) {
      case 'departing': {
        nextX = boat.x + Math.cos(boat.angle) * boat.speed * delta * speedMultiplier;
        nextY = boat.y + Math.sin(boat.angle) * boat.speed * delta * speedMultiplier;

        if (boat.age > 2) {
          if (boat.tourWaypoints.length > 0) {
            boat.state = 'touring';
            boat.tourWaypointIndex = 0;
            boat.destScreenX = boat.tourWaypoints[0].screenX;
            boat.destScreenY = boat.tourWaypoints[0].screenY;
          } else {
            boat.state = 'sailing';
            boat.destScreenX = boat.homeScreenX;
            boat.destScreenY = boat.homeScreenY;
          }
        }
        break;
      }

      case 'touring': {
        const angleToWaypoint = Math.atan2(boat.destScreenY - boat.y, boat.destScreenX - boat.x);
        boat.targetAngle = angleToWaypoint;

        // Smooth turning
        let angleDiff = boat.targetAngle - boat.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        boat.angle += angleDiff * Math.min(1, delta * 1.8);

        nextX = boat.x + Math.cos(boat.angle) * boat.speed * delta * speedMultiplier;
        nextY = boat.y + Math.sin(boat.angle) * boat.speed * delta * speedMultiplier;

        // Check if reached current waypoint
        if (distToDest < 40) {
          boat.tourWaypointIndex++;

          if (boat.tourWaypointIndex < boat.tourWaypoints.length) {
            const nextWaypoint = boat.tourWaypoints[boat.tourWaypointIndex];
            boat.destScreenX = nextWaypoint.screenX;
            boat.destScreenY = nextWaypoint.screenY;
          } else {
            boat.state = 'sailing';
            boat.destScreenX = boat.homeScreenX;
            boat.destScreenY = boat.homeScreenY;
            boat.age = 0;
          }
        }

        // Safety: remove boats that have been touring too long
        if (boat.age > 120) {
          continue;
        }
        break;
      }

      case 'sailing': {
        const angleToDestination = Math.atan2(boat.destScreenY - boat.y, boat.destScreenX - boat.x);
        boat.targetAngle = angleToDestination;

        // Smooth turning
        let angleDiff = boat.targetAngle - boat.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        boat.angle += angleDiff * Math.min(1, delta * 2);

        nextX = boat.x + Math.cos(boat.angle) * boat.speed * delta * speedMultiplier;
        nextY = boat.y + Math.sin(boat.angle) * boat.speed * delta * speedMultiplier;

        if (distToDest < 60) {
          boat.state = 'arriving';
        }

        // Safety: remove boats that have been sailing too long
        if (boat.age > 60) {
          continue;
        }
        break;
      }

      case 'arriving': {
        boat.speed = Math.max(5, boat.speed - delta * 8);

        const angleToDestination = Math.atan2(boat.destScreenY - boat.y, boat.destScreenX - boat.x);
        boat.targetAngle = angleToDestination;

        // Smooth turning
        let angleDiff = boat.targetAngle - boat.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        boat.angle += angleDiff * Math.min(1, delta * 3);

        nextX = boat.x + Math.cos(boat.angle) * boat.speed * delta * speedMultiplier;
        nextY = boat.y + Math.sin(boat.angle) * boat.speed * delta * speedMultiplier;

        if (distToDest < 15) {
          boat.state = 'docked';
          boat.age = 0;
          boat.wake = [];
        }
        break;
      }

      case 'docked': {
        // Wait at dock, then generate a new tour and depart
        if (boat.age > 3 + Math.random() * 3) {
          const waterTile = findAdjacentWaterTile(grid, gridSize, boat.originX, boat.originY);
          if (waterTile) {
            boat.tourWaypoints = generateTourWaypoints(grid, gridSize, waterTile.x, waterTile.y);
            boat.tourWaypointIndex = 0;
          }

          boat.state = 'departing';
          boat.speed = 15 + Math.random() * 10;
          boat.age = 0;

          if (boat.tourWaypoints.length > 0) {
            boat.destScreenX = boat.tourWaypoints[0].screenX;
            boat.destScreenY = boat.tourWaypoints[0].screenY;
          } else {
            boat.destScreenX = boat.homeScreenX + (Math.random() - 0.5) * 200;
            boat.destScreenY = boat.homeScreenY + (Math.random() - 0.5) * 200;
          }

          const angle = Math.atan2(boat.destScreenY - boat.y, boat.destScreenX - boat.x);
          boat.angle = angle;
          boat.targetAngle = angle;
        }
        break;
      }
    }

    // Check if next position is over water (skip for docked boats)
    if (boat.state !== 'docked') {
      if (!isOverWater(grid, gridSize, nextX, nextY)) {
        continue;
      }

      boat.x = nextX;
      boat.y = nextY;

      // Add wake particles when moving
      const wakeSpawnInterval = isMobile ? 0.08 : WAKE_SPAWN_INTERVAL;
      boat.wakeSpawnProgress += delta;
      if (boat.wakeSpawnProgress >= wakeSpawnInterval) {
        boat.wakeSpawnProgress -= wakeSpawnInterval;

        const behindBoat = -6;
        boat.wake.push({
          x: boat.x + Math.cos(boat.angle) * behindBoat,
          y: boat.y + Math.sin(boat.angle) * behindBoat,
          age: 0,
          opacity: 1
        });
      }
    }

    updatedBoats.push(boat);
  }

  boatsRef.current = updatedBoats;
}
