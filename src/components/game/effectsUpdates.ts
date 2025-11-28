/**
 * Visual effects update logic for fireworks and factory smog.
 * Extracted from CanvasIsometricGrid.tsx for better code organization.
 */

import { BuildingType } from '@/types/game';
import { Firework, FactorySmog, WorldRenderState, TILE_WIDTH, TILE_HEIGHT } from './types';
import {
  FIREWORK_BUILDINGS,
  FIREWORK_COLORS,
  FIREWORK_PARTICLE_COUNT,
  FIREWORK_PARTICLE_SPEED,
  FIREWORK_PARTICLE_MAX_AGE,
  FIREWORK_LAUNCH_SPEED,
  FIREWORK_SPAWN_INTERVAL_MIN,
  FIREWORK_SPAWN_INTERVAL_MAX,
  FIREWORK_SHOW_DURATION,
  FIREWORK_SHOW_CHANCE,
  SMOG_PARTICLE_MAX_AGE,
  SMOG_PARTICLE_MAX_AGE_MOBILE,
  SMOG_SPAWN_INTERVAL_MEDIUM,
  SMOG_SPAWN_INTERVAL_LARGE,
  SMOG_SPAWN_INTERVAL_MOBILE_MULTIPLIER,
  SMOG_DRIFT_SPEED,
  SMOG_RISE_SPEED,
  SMOG_FADE_ZOOM,
  SMOG_BASE_OPACITY,
  SMOG_PARTICLE_SIZE_MIN,
  SMOG_PARTICLE_SIZE_MAX,
  SMOG_PARTICLE_GROWTH,
  SMOG_MAX_PARTICLES_PER_FACTORY,
  SMOG_MAX_PARTICLES_PER_FACTORY_MOBILE,
} from './constants';
import { gridToScreen } from './utils';
import { findFireworkBuildings, findSmogFactories } from './gridFinders';

// ============================================================================
// Types
// ============================================================================

export type EffectsRefs = {
  fireworks: React.MutableRefObject<Firework[]>;
  fireworkId: React.MutableRefObject<number>;
  fireworkSpawnTimer: React.MutableRefObject<number>;
  fireworkShowActive: React.MutableRefObject<boolean>;
  fireworkShowStartTime: React.MutableRefObject<number>;
  fireworkLastHour: React.MutableRefObject<number>;
  factorySmog: React.MutableRefObject<FactorySmog[]>;
  smogLastGridVersion: React.MutableRefObject<number>;
};

// ============================================================================
// Firework Functions
// ============================================================================

/**
 * Update fireworks - spawn, animate, and manage lifecycle.
 */
export function updateFireworks(
  delta: number,
  currentHour: number,
  worldState: WorldRenderState,
  fireworksRef: React.MutableRefObject<Firework[]>,
  fireworkIdRef: React.MutableRefObject<number>,
  fireworkSpawnTimerRef: React.MutableRefObject<number>,
  fireworkShowActiveRef: React.MutableRefObject<boolean>,
  fireworkShowStartTimeRef: React.MutableRefObject<number>,
  fireworkLastHourRef: React.MutableRefObject<number>,
  isMobile: boolean
): void {
  const { grid, gridSize, speed } = worldState;

  if (!grid || gridSize <= 0 || speed === 0) {
    return;
  }

  // Disable fireworks on mobile for performance
  if (isMobile) {
    fireworksRef.current = [];
    return;
  }

  // Check if it's night time
  const isNight = currentHour >= 20 || currentHour < 5;

  // Detect transition to night - decide if this will be a firework night
  if (currentHour !== fireworkLastHourRef.current) {
    const wasNight = fireworkLastHourRef.current >= 20 || (fireworkLastHourRef.current >= 0 && fireworkLastHourRef.current < 5);
    fireworkLastHourRef.current = currentHour;

    // If we just transitioned into night (hour 20)
    if (currentHour === 20 && !wasNight) {
      if (Math.random() < FIREWORK_SHOW_CHANCE) {
        const fireworkBuildings = findFireworkBuildings(grid, gridSize, FIREWORK_BUILDINGS);
        if (fireworkBuildings.length > 0) {
          fireworkShowActiveRef.current = true;
          fireworkShowStartTimeRef.current = 0;
        }
      }
    }

    // End firework show if transitioning out of night
    if (!isNight && wasNight) {
      fireworkShowActiveRef.current = false;
      fireworksRef.current = [];
    }
  }

  // No fireworks during day or if no show is active
  if (!isNight || !fireworkShowActiveRef.current) {
    if (fireworksRef.current.length > 0 && !fireworkShowActiveRef.current) {
      fireworksRef.current = [];
    }
    return;
  }

  // Update show timer
  fireworkShowStartTimeRef.current += delta;

  // End show after duration
  if (fireworkShowStartTimeRef.current > FIREWORK_SHOW_DURATION) {
    fireworkShowActiveRef.current = false;
    return;
  }

  // Find buildings that can launch fireworks
  const fireworkBuildings = findFireworkBuildings(grid, gridSize, FIREWORK_BUILDINGS);
  if (fireworkBuildings.length === 0) {
    fireworkShowActiveRef.current = false;
    return;
  }

  // Speed multiplier based on game speed
  const speedMultiplier = speed === 1 ? 1 : speed === 2 ? 1.5 : 2;

  // Spawn timer
  fireworkSpawnTimerRef.current -= delta;
  if (fireworkSpawnTimerRef.current <= 0) {
    // Pick a random building to launch from
    const building = fireworkBuildings[Math.floor(Math.random() * fireworkBuildings.length)];

    const { screenX, screenY } = gridToScreen(building.x, building.y, 0, 0);

    const launchX = screenX + TILE_WIDTH / 2 + (Math.random() - 0.5) * TILE_WIDTH * 0.5;
    const launchY = screenY + TILE_HEIGHT / 2;
    const targetY = launchY - 50 - Math.random() * 50;

    fireworksRef.current.push({
      id: fireworkIdRef.current++,
      x: launchX,
      y: launchY,
      vx: (Math.random() - 0.5) * 20,
      vy: -FIREWORK_LAUNCH_SPEED,
      state: 'launching',
      targetY: targetY,
      color: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
      particles: [],
      age: 0,
      sourceTileX: building.x,
      sourceTileY: building.y,
    });

    fireworkSpawnTimerRef.current = FIREWORK_SPAWN_INTERVAL_MIN + Math.random() * (FIREWORK_SPAWN_INTERVAL_MAX - FIREWORK_SPAWN_INTERVAL_MIN);
  }

  // Update existing fireworks
  const updatedFireworks: Firework[] = [];

  for (const firework of fireworksRef.current) {
    firework.age += delta;

    switch (firework.state) {
      case 'launching': {
        firework.x += firework.vx * delta * speedMultiplier;
        firework.y += firework.vy * delta * speedMultiplier;

        if (firework.y <= firework.targetY) {
          firework.state = 'exploding';
          firework.age = 0;

          // Create explosion particles
          const particleCount = FIREWORK_PARTICLE_COUNT;
          for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2 + Math.random() * 0.3;
            const speed = FIREWORK_PARTICLE_SPEED * (0.5 + Math.random() * 0.5);

            firework.particles.push({
              x: firework.x,
              y: firework.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              age: 0,
              maxAge: FIREWORK_PARTICLE_MAX_AGE * (0.7 + Math.random() * 0.3),
              color: firework.color,
              size: 2 + Math.random() * 2,
              trail: [],
            });
          }
        }
        break;
      }

      case 'exploding': {
        let allFaded = true;
        for (const particle of firework.particles) {
          // Add current position to trail
          particle.trail.push({ x: particle.x, y: particle.y, age: 0 });
          while (particle.trail.length > 8) {
            particle.trail.shift();
          }
          for (const tp of particle.trail) {
            tp.age += delta;
          }
          particle.trail = particle.trail.filter(tp => tp.age < 0.3);

          particle.age += delta;
          particle.x += particle.vx * delta * speedMultiplier;
          particle.y += particle.vy * delta * speedMultiplier;

          // Apply gravity
          particle.vy += 150 * delta;

          // Apply drag
          particle.vx *= 0.98;
          particle.vy *= 0.98;

          if (particle.age < particle.maxAge) {
            allFaded = false;
          }
        }

        if (allFaded) {
          firework.state = 'fading';
          firework.age = 0;
        }
        break;
      }

      case 'fading': {
        if (firework.age > 0.5) {
          continue;
        }
        break;
      }
    }

    updatedFireworks.push(firework);
  }

  fireworksRef.current = updatedFireworks;
}

// ============================================================================
// Smog Functions
// ============================================================================

/**
 * Update smog particles - spawn new particles and update existing ones.
 */
export function updateSmog(
  delta: number,
  worldState: WorldRenderState,
  factorySmogRef: React.MutableRefObject<FactorySmog[]>,
  smogLastGridVersionRef: React.MutableRefObject<number>,
  gridVersionRef: React.MutableRefObject<number>,
  isMobile: boolean
): void {
  const { grid, gridSize, speed, zoom } = worldState;

  if (!grid || gridSize <= 0 || speed === 0) {
    return;
  }

  // Skip smog updates entirely when zoomed in enough that it won't be visible
  if (zoom > SMOG_FADE_ZOOM) {
    return;
  }

  const speedMultiplier = [0, 1, 2, 4][speed] || 1;
  const adjustedDelta = delta * speedMultiplier;

  // Mobile performance optimizations
  const maxParticles = isMobile ? SMOG_MAX_PARTICLES_PER_FACTORY_MOBILE : SMOG_MAX_PARTICLES_PER_FACTORY;
  const particleMaxAge = isMobile ? SMOG_PARTICLE_MAX_AGE_MOBILE : SMOG_PARTICLE_MAX_AGE;
  const spawnMultiplier = isMobile ? SMOG_SPAWN_INTERVAL_MOBILE_MULTIPLIER : 1;

  // Rebuild factory list if grid has changed
  const currentGridVersion = gridVersionRef.current;
  if (smogLastGridVersionRef.current !== currentGridVersion) {
    smogLastGridVersionRef.current = currentGridVersion;

    const factories = findSmogFactories(grid, gridSize);

    // Create new smog entries for factories, preserving existing particles
    const existingSmogMap = new Map<string, FactorySmog>();
    for (const smog of factorySmogRef.current) {
      existingSmogMap.set(`${smog.tileX},${smog.tileY}`, smog);
    }

    factorySmogRef.current = factories.map(factory => {
      const key = `${factory.x},${factory.y}`;
      const existing = existingSmogMap.get(key);

      // Calculate screen position for the factory (chimney position)
      const { screenX, screenY } = gridToScreen(factory.x, factory.y, 0, 0);
      const chimneyOffsetX = factory.type === 'factory_large' ? TILE_WIDTH * 1.2 : TILE_WIDTH * 0.6;
      const chimneyOffsetY = factory.type === 'factory_large' ? -TILE_HEIGHT * 1.2 : -TILE_HEIGHT * 0.7;

      if (existing && existing.buildingType === factory.type) {
        existing.screenX = screenX + chimneyOffsetX;
        existing.screenY = screenY + chimneyOffsetY;
        return existing;
      }

      return {
        tileX: factory.x,
        tileY: factory.y,
        screenX: screenX + chimneyOffsetX,
        screenY: screenY + chimneyOffsetY,
        buildingType: factory.type,
        particles: [],
        spawnTimer: Math.random(),
      };
    });
  }

  // Update each factory's smog
  for (const smog of factorySmogRef.current) {
    // Update spawn timer
    const baseSpawnInterval = smog.buildingType === 'factory_large'
      ? SMOG_SPAWN_INTERVAL_LARGE
      : SMOG_SPAWN_INTERVAL_MEDIUM;
    const spawnInterval = baseSpawnInterval * spawnMultiplier;

    smog.spawnTimer += adjustedDelta;

    // Spawn new particles
    while (smog.spawnTimer >= spawnInterval && smog.particles.length < maxParticles) {
      smog.spawnTimer -= spawnInterval;

      const spawnX = smog.screenX + (Math.random() - 0.5) * 8;
      const spawnY = smog.screenY + (Math.random() - 0.5) * 4;

      const vx = (Math.random() - 0.5) * SMOG_DRIFT_SPEED * 2;
      const vy = -SMOG_RISE_SPEED * (0.8 + Math.random() * 0.4);

      const size = SMOG_PARTICLE_SIZE_MIN + Math.random() * (SMOG_PARTICLE_SIZE_MAX - SMOG_PARTICLE_SIZE_MIN);
      const maxAge = particleMaxAge * (0.7 + Math.random() * 0.6);

      smog.particles.push({
        x: spawnX,
        y: spawnY,
        vx,
        vy,
        age: 0,
        maxAge,
        size,
        opacity: SMOG_BASE_OPACITY * (0.8 + Math.random() * 0.4),
      });
    }

    // Reset spawn timer if we hit the particle limit
    if (smog.particles.length >= maxParticles) {
      smog.spawnTimer = 0;
    }

    // Update existing particles
    smog.particles = smog.particles.filter(particle => {
      particle.age += adjustedDelta;

      if (particle.age >= particle.maxAge) {
        return false;
      }

      particle.x += particle.vx * adjustedDelta;
      particle.y += particle.vy * adjustedDelta;

      // Slow down drift over time
      particle.vx *= 0.995;
      particle.vy *= 0.998;

      // Grow particle size over time
      particle.size += SMOG_PARTICLE_GROWTH * adjustedDelta;

      return true;
    });
  }
}
