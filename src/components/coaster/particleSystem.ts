/**
 * IsoCoaster Particle System
 * Provides ambient particle effects for enhanced visual fidelity
 * Includes fountain splashes, ride sparkles, path dust, and leaf particles
 */

'use client';

import { useCallback, useRef } from 'react';
import { Tile } from '@/games/coaster/types';

// =============================================================================
// PARTICLE TYPES
// =============================================================================

export type ParticleType = 
  | 'splash'      // Water fountain splashes
  | 'sparkle'     // Ride excitement sparkles
  | 'dust'        // Path dust when guests walk
  | 'leaf'        // Falling leaves from trees
  | 'confetti'    // Celebration confetti
  | 'steam';      // Food cart steam

export interface Particle {
  id: number;
  type: ParticleType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;      // 0 to 1, decreases over time
  maxLife: number;   // Total lifespan in seconds
  size: number;
  color: string;
  rotation?: number;
  rotationSpeed?: number;
  alpha?: number;
  gravity?: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const TILE_WIDTH = 64;
const HEIGHT_RATIO = 0.60;
const TILE_HEIGHT = TILE_WIDTH * HEIGHT_RATIO;

const MAX_PARTICLES = 200;
const MAX_PARTICLES_MOBILE = 80;

// Particle spawn rates (per second)
const FOUNTAIN_SPAWN_RATE = 8;
const RIDE_SPARKLE_RATE = 3;
const STEAM_SPAWN_RATE = 4;
const LEAF_SPAWN_RATE = 0.5;

// Color palettes
const SPLASH_COLORS = ['#bfdbfe', '#93c5fd', '#60a5fa', '#dbeafe', '#ffffff'];
const SPARKLE_COLORS = ['#fef08a', '#fde047', '#facc15', '#ffffff', '#fed7aa'];
const DUST_COLORS = ['#d6d3d1', '#a8a29e', '#78716c'];
const LEAF_COLORS = ['#22c55e', '#16a34a', '#15803d', '#84cc16', '#a3e635'];
const CONFETTI_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];
const STEAM_COLORS = ['rgba(255,255,255,0.6)', 'rgba(240,240,240,0.5)', 'rgba(250,250,250,0.4)'];

// =============================================================================
// PARTICLE SYSTEM HOOK
// =============================================================================

interface ParticleSystemProps {
  canvasWidth: number;
  canvasHeight: number;
  offset: { x: number; y: number };
  zoom: number;
  grid: Tile[][];
  gridSize: number;
  isMobile?: boolean;
}

interface ParticleSystemRefs {
  particlesRef: React.MutableRefObject<Particle[]>;
  particleIdRef: React.MutableRefObject<number>;
  spawnTimersRef: React.MutableRefObject<Record<string, number>>;
}

export function useParticleSystem(
  props: ParticleSystemProps,
  refs: ParticleSystemRefs
) {
  const { canvasWidth, canvasHeight, offset, zoom, grid, gridSize, isMobile = false } = props;
  const { particlesRef, particleIdRef, spawnTimersRef } = refs;

  const maxParticles = isMobile ? MAX_PARTICLES_MOBILE : MAX_PARTICLES;

  // Grid to screen conversion
  const gridToScreen = (gridX: number, gridY: number): { x: number; y: number } => {
    const x = (gridX - gridY) * (TILE_WIDTH / 2);
    const y = (gridX + gridY) * (TILE_HEIGHT / 2);
    return { x, y };
  };

  // Random helper
  const randomInRange = (min: number, max: number) => min + Math.random() * (max - min);
  const randomFromArray = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  // Create a particle
  const createParticle = useCallback((
    type: ParticleType,
    x: number,
    y: number,
    options?: Partial<Particle>
  ): Particle => {
    const id = particleIdRef.current++;
    
    const defaults: Record<ParticleType, Partial<Particle>> = {
      splash: {
        vx: randomInRange(-15, 15),
        vy: randomInRange(-25, -10),
        maxLife: 0.8,
        size: randomInRange(1.5, 3),
        color: randomFromArray(SPLASH_COLORS),
        gravity: 50,
        alpha: 0.8,
      },
      sparkle: {
        vx: randomInRange(-5, 5),
        vy: randomInRange(-10, -3),
        maxLife: 0.6,
        size: randomInRange(1, 2.5),
        color: randomFromArray(SPARKLE_COLORS),
        gravity: -5, // Float upward
        alpha: 1,
      },
      dust: {
        vx: randomInRange(-3, 3),
        vy: randomInRange(-2, 0),
        maxLife: 0.5,
        size: randomInRange(0.8, 1.5),
        color: randomFromArray(DUST_COLORS),
        gravity: 2,
        alpha: 0.4,
      },
      leaf: {
        vx: randomInRange(2, 8),
        vy: randomInRange(5, 12),
        maxLife: 3,
        size: randomInRange(2, 4),
        color: randomFromArray(LEAF_COLORS),
        gravity: 3,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: randomInRange(-2, 2),
        alpha: 0.9,
      },
      confetti: {
        vx: randomInRange(-20, 20),
        vy: randomInRange(-30, -15),
        maxLife: 2,
        size: randomInRange(2, 4),
        color: randomFromArray(CONFETTI_COLORS),
        gravity: 25,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: randomInRange(-5, 5),
        alpha: 1,
      },
      steam: {
        vx: randomInRange(-2, 2),
        vy: randomInRange(-8, -4),
        maxLife: 1.2,
        size: randomInRange(3, 6),
        color: randomFromArray(STEAM_COLORS),
        gravity: -3,
        alpha: 0.5,
      },
    };

    const typeDefaults = defaults[type];
    
    return {
      id,
      type,
      x,
      y,
      vx: typeDefaults.vx ?? 0,
      vy: typeDefaults.vy ?? 0,
      life: 1,
      maxLife: typeDefaults.maxLife ?? 1,
      size: typeDefaults.size ?? 2,
      color: typeDefaults.color ?? '#ffffff',
      rotation: typeDefaults.rotation,
      rotationSpeed: typeDefaults.rotationSpeed,
      alpha: typeDefaults.alpha ?? 1,
      gravity: typeDefaults.gravity ?? 0,
      ...options,
    };
  }, [particleIdRef]);

  // Spawn particles at source locations
  const spawnParticlesFromSources = useCallback((delta: number) => {
    if (particlesRef.current.length >= maxParticles) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const viewWidth = canvasWidth / (dpr * zoom);
    const viewHeight = canvasHeight / (dpr * zoom);
    const viewLeft = -offset.x / zoom - TILE_WIDTH;
    const viewTop = -offset.y / zoom - TILE_HEIGHT;
    const viewRight = viewWidth - offset.x / zoom + TILE_WIDTH;
    const viewBottom = viewHeight - offset.y / zoom + TILE_HEIGHT;

    // Initialize spawn timers
    if (!spawnTimersRef.current.fountain) spawnTimersRef.current.fountain = 0;
    if (!spawnTimersRef.current.ride) spawnTimersRef.current.ride = 0;
    if (!spawnTimersRef.current.steam) spawnTimersRef.current.steam = 0;
    if (!spawnTimersRef.current.leaf) spawnTimersRef.current.leaf = 0;

    spawnTimersRef.current.fountain += delta;
    spawnTimersRef.current.ride += delta;
    spawnTimersRef.current.steam += delta;
    spawnTimersRef.current.leaf += delta;

    // Scan visible tiles for particle sources
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const { x: screenX, y: screenY } = gridToScreen(x, y);
        
        // Viewport culling
        if (screenX < viewLeft || screenX > viewRight || screenY < viewTop || screenY > viewBottom) {
          continue;
        }

        const tile = grid[y]?.[x];
        if (!tile) continue;

        const buildingType = tile.building?.type;
        const centerX = screenX + TILE_WIDTH / 2;
        const centerY = screenY + TILE_HEIGHT / 2;

        // Fountain particles
        if (buildingType?.includes('fountain') && spawnTimersRef.current.fountain >= 1 / FOUNTAIN_SPAWN_RATE) {
          for (let i = 0; i < 3; i++) {
            particlesRef.current.push(createParticle('splash', 
              centerX + randomInRange(-8, 8), 
              centerY - 15 + randomInRange(-5, 0)
            ));
          }
        }

        // Ride sparkles (on exciting rides when operating)
        if (buildingType?.startsWith('ride_ferris') || buildingType?.startsWith('ride_drop') || 
            buildingType?.startsWith('ride_swing') || buildingType?.includes('coaster')) {
          if (spawnTimersRef.current.ride >= 1 / RIDE_SPARKLE_RATE && Math.random() < 0.3) {
            particlesRef.current.push(createParticle('sparkle',
              centerX + randomInRange(-15, 15),
              centerY - 20 + randomInRange(-10, 0)
            ));
          }
        }

        // Food cart steam
        if ((buildingType?.startsWith('food_') || buildingType?.startsWith('cart_')) && 
            spawnTimersRef.current.steam >= 1 / STEAM_SPAWN_RATE) {
          if (Math.random() < 0.2) {
            particlesRef.current.push(createParticle('steam',
              centerX + randomInRange(-3, 3),
              centerY - 12
            ));
          }
        }

        // Falling leaves from trees
        if (buildingType?.startsWith('tree_') && spawnTimersRef.current.leaf >= 1 / LEAF_SPAWN_RATE) {
          if (Math.random() < 0.05) {
            particlesRef.current.push(createParticle('leaf',
              centerX + randomInRange(-10, 10),
              centerY - 20 + randomInRange(-5, 0)
            ));
          }
        }
      }
    }

    // Reset timers
    if (spawnTimersRef.current.fountain >= 1 / FOUNTAIN_SPAWN_RATE) {
      spawnTimersRef.current.fountain = 0;
    }
    if (spawnTimersRef.current.ride >= 1 / RIDE_SPARKLE_RATE) {
      spawnTimersRef.current.ride = 0;
    }
    if (spawnTimersRef.current.steam >= 1 / STEAM_SPAWN_RATE) {
      spawnTimersRef.current.steam = 0;
    }
    if (spawnTimersRef.current.leaf >= 1 / LEAF_SPAWN_RATE) {
      spawnTimersRef.current.leaf = 0;
    }

    // Limit particle count
    if (particlesRef.current.length > maxParticles) {
      particlesRef.current = particlesRef.current.slice(-maxParticles);
    }
  }, [canvasWidth, canvasHeight, offset, zoom, grid, gridSize, maxParticles, particlesRef, spawnTimersRef, createParticle]);

  // Update particles
  const updateParticles = useCallback((delta: number, gameSpeed: number) => {
    if (gameSpeed === 0) return;

    // Spawn new particles
    spawnParticlesFromSources(delta);

    // Update existing particles
    particlesRef.current = particlesRef.current.filter(particle => {
      // Update life
      particle.life -= delta / particle.maxLife;
      if (particle.life <= 0) return false;

      // Apply velocity
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;

      // Apply gravity
      if (particle.gravity) {
        particle.vy += particle.gravity * delta;
      }

      // Apply rotation
      if (particle.rotation !== undefined && particle.rotationSpeed) {
        particle.rotation += particle.rotationSpeed * delta;
      }

      // Add some drag for natural slowdown
      particle.vx *= 0.98;
      if (particle.type !== 'leaf') {
        particle.vy *= 0.98;
      }

      return true;
    });
  }, [particlesRef, spawnParticlesFromSources]);

  // Draw particles
  const drawParticles = useCallback((ctx: CanvasRenderingContext2D) => {
    if (particlesRef.current.length === 0) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    ctx.save();
    ctx.scale(dpr * zoom, dpr * zoom);
    ctx.translate(offset.x / zoom, offset.y / zoom);

    for (const particle of particlesRef.current) {
      const lifeAlpha = particle.life * (particle.alpha ?? 1);
      
      if (lifeAlpha <= 0.01) continue;

      ctx.save();
      ctx.globalAlpha = lifeAlpha;
      ctx.translate(particle.x, particle.y);
      
      if (particle.rotation !== undefined) {
        ctx.rotate(particle.rotation);
      }

      switch (particle.type) {
        case 'splash':
          // Water droplet
          ctx.fillStyle = particle.color;
          ctx.beginPath();
          ctx.arc(0, 0, particle.size * particle.life, 0, Math.PI * 2);
          ctx.fill();
          break;

        case 'sparkle':
          // 4-pointed star sparkle
          ctx.fillStyle = particle.color;
          const s = particle.size * (0.5 + particle.life * 0.5);
          ctx.beginPath();
          ctx.moveTo(0, -s);
          ctx.lineTo(s * 0.3, -s * 0.3);
          ctx.lineTo(s, 0);
          ctx.lineTo(s * 0.3, s * 0.3);
          ctx.lineTo(0, s);
          ctx.lineTo(-s * 0.3, s * 0.3);
          ctx.lineTo(-s, 0);
          ctx.lineTo(-s * 0.3, -s * 0.3);
          ctx.closePath();
          ctx.fill();
          break;

        case 'dust':
          // Small dust mote
          ctx.fillStyle = particle.color;
          ctx.beginPath();
          ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
          ctx.fill();
          break;

        case 'leaf':
          // Simple leaf shape
          ctx.fillStyle = particle.color;
          const ls = particle.size;
          ctx.beginPath();
          ctx.ellipse(0, 0, ls, ls * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
          // Leaf vein
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
          ctx.lineWidth = 0.3;
          ctx.beginPath();
          ctx.moveTo(-ls * 0.8, 0);
          ctx.lineTo(ls * 0.8, 0);
          ctx.stroke();
          break;

        case 'confetti':
          // Rectangular confetti
          ctx.fillStyle = particle.color;
          ctx.fillRect(-particle.size * 0.5, -particle.size * 0.3, particle.size, particle.size * 0.6);
          break;

        case 'steam':
          // Soft steam puff
          const steamSize = particle.size * (0.5 + (1 - particle.life) * 1.5);
          const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, steamSize);
          gradient.addColorStop(0, `rgba(255, 255, 255, ${lifeAlpha * 0.4})`);
          gradient.addColorStop(0.5, `rgba(250, 250, 250, ${lifeAlpha * 0.2})`);
          gradient.addColorStop(1, 'rgba(245, 245, 245, 0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(0, 0, steamSize, 0, Math.PI * 2);
          ctx.fill();
          break;
      }

      ctx.restore();
    }

    ctx.restore();
  }, [particlesRef, offset, zoom]);

  // Spawn confetti burst at a location
  const spawnConfettiBurst = useCallback((screenX: number, screenY: number, count: number = 20) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push(createParticle('confetti', screenX, screenY));
    }
  }, [particlesRef, createParticle]);

  return {
    updateParticles,
    drawParticles,
    spawnConfettiBurst,
  };
}

// Create refs helper
export function createParticleSystemRefs(): ParticleSystemRefs {
  return {
    particlesRef: { current: [] },
    particleIdRef: { current: 0 },
    spawnTimersRef: { current: {} },
  };
}
