/**
 * Visual effects drawing functions for fireworks, smog, and incident indicators.
 * Extracted from CanvasIsometricGrid.tsx for better code organization.
 */

import { Firework, FactorySmog, WorldRenderState, TILE_WIDTH, TILE_HEIGHT } from './types';
import { SMOG_MAX_ZOOM, SMOG_FADE_ZOOM } from './constants';
import { gridToScreen } from './utils';
import { CrimeIncident } from './vehicleUpdates';

// ============================================================================
// Firework Drawing
// ============================================================================

/**
 * Draw all fireworks on the canvas.
 */
export function drawFireworks(
  ctx: CanvasRenderingContext2D,
  worldState: WorldRenderState,
  fireworksRef: React.MutableRefObject<Firework[]>
): void {
  const { offset, zoom, grid, gridSize } = worldState;
  const canvas = ctx.canvas;
  const dpr = window.devicePixelRatio || 1;

  if (!grid || gridSize <= 0 || fireworksRef.current.length === 0) {
    return;
  }

  ctx.save();
  ctx.scale(dpr * zoom, dpr * zoom);
  ctx.translate(offset.x / zoom, offset.y / zoom);

  const viewWidth = canvas.width / (dpr * zoom);
  const viewHeight = canvas.height / (dpr * zoom);
  const viewLeft = -offset.x / zoom - 100;
  const viewTop = -offset.y / zoom - 200;
  const viewRight = viewWidth - offset.x / zoom + 100;
  const viewBottom = viewHeight - offset.y / zoom + 100;

  for (const firework of fireworksRef.current) {
    // Skip if outside viewport
    if (firework.x < viewLeft || firework.x > viewRight || firework.y < viewTop || firework.y > viewBottom) {
      continue;
    }

    if (firework.state === 'launching') {
      // Draw launching trail
      const gradient = ctx.createLinearGradient(
        firework.x, firework.y,
        firework.x - firework.vx * 0.1, firework.y - firework.vy * 0.1
      );
      gradient.addColorStop(0, firework.color);
      gradient.addColorStop(1, 'rgba(255, 200, 100, 0)');

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(firework.x, firework.y);
      ctx.lineTo(
        firework.x - firework.vx * 0.08,
        firework.y - firework.vy * 0.08
      );
      ctx.stroke();

      // Draw the firework head
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(firework.x, firework.y, 2, 0, Math.PI * 2);
      ctx.fill();

      // Glow effect
      ctx.fillStyle = firework.color;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(firework.x, firework.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

    } else if (firework.state === 'exploding' || firework.state === 'fading') {
      // Draw particles
      for (const particle of firework.particles) {
        const alpha = Math.max(0, 1 - particle.age / particle.maxAge);
        if (alpha <= 0) continue;

        // Draw particle trail
        if (particle.trail.length > 1) {
          ctx.strokeStyle = particle.color;
          ctx.lineWidth = particle.size * 0.5;
          ctx.lineCap = 'round';
          ctx.globalAlpha = alpha * 0.3;

          ctx.beginPath();
          ctx.moveTo(particle.trail[0].x, particle.trail[0].y);
          for (let i = 1; i < particle.trail.length; i++) {
            ctx.lineTo(particle.trail[i].x, particle.trail[i].y);
          }
          ctx.lineTo(particle.x, particle.y);
          ctx.stroke();
        }

        // Draw particle
        ctx.globalAlpha = alpha;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
        ctx.fill();

        // Bright center
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = alpha * 0.7;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * alpha * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  ctx.restore();
}

// ============================================================================
// Smog Drawing
// ============================================================================

/**
 * Draw factory smog particles on the canvas.
 */
export function drawSmog(
  ctx: CanvasRenderingContext2D,
  worldState: WorldRenderState,
  factorySmogRef: React.MutableRefObject<FactorySmog[]>
): void {
  const { offset, zoom, grid, gridSize } = worldState;
  const canvas = ctx.canvas;
  const dpr = window.devicePixelRatio || 1;

  if (!grid || gridSize <= 0 || factorySmogRef.current.length === 0) {
    return;
  }

  // Calculate zoom-based opacity modifier
  let zoomOpacity = 1;
  if (zoom > SMOG_FADE_ZOOM) {
    return;
  } else if (zoom > SMOG_MAX_ZOOM) {
    zoomOpacity = 1 - (zoom - SMOG_MAX_ZOOM) / (SMOG_FADE_ZOOM - SMOG_MAX_ZOOM);
  }

  ctx.save();
  ctx.scale(dpr * zoom, dpr * zoom);
  ctx.translate(offset.x / zoom, offset.y / zoom);

  const viewWidth = canvas.width / (dpr * zoom);
  const viewHeight = canvas.height / (dpr * zoom);
  const viewLeft = -offset.x / zoom - 100;
  const viewTop = -offset.y / zoom - 200;
  const viewRight = viewWidth - offset.x / zoom + 100;
  const viewBottom = viewHeight - offset.y / zoom + 100;

  // Draw all smog particles
  for (const smog of factorySmogRef.current) {
    for (const particle of smog.particles) {
      if (particle.x < viewLeft || particle.x > viewRight ||
          particle.y < viewTop || particle.y > viewBottom) {
        continue;
      }

      // Calculate age-based opacity
      const ageRatio = particle.age / particle.maxAge;
      let ageOpacity: number;
      if (ageRatio < 0.1) {
        ageOpacity = ageRatio / 0.1;
      } else {
        ageOpacity = 1 - ((ageRatio - 0.1) / 0.9);
      }

      const finalOpacity = particle.opacity * ageOpacity * zoomOpacity;
      if (finalOpacity <= 0.01) continue;

      // Draw smog particle
      ctx.fillStyle = `rgba(100, 100, 110, ${finalOpacity})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();

      // Add lighter inner glow
      const innerSize = particle.size * 0.6;
      ctx.fillStyle = `rgba(140, 140, 150, ${finalOpacity * 0.5})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y - particle.size * 0.1, innerSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

// ============================================================================
// Incident Indicator Drawing
// ============================================================================

/**
 * Draw incident indicators (fires and crimes) with pulsing effect.
 */
export function drawIncidentIndicators(
  ctx: CanvasRenderingContext2D,
  delta: number,
  worldState: WorldRenderState,
  activeCrimeIncidentsRef: React.MutableRefObject<Map<string, CrimeIncident>>,
  incidentAnimTimeRef: React.MutableRefObject<number>
): void {
  const { offset, zoom, grid, gridSize } = worldState;
  const canvas = ctx.canvas;
  const dpr = window.devicePixelRatio || 1;

  if (!grid || gridSize <= 0) return;

  // Update animation time
  incidentAnimTimeRef.current += delta;
  const animTime = incidentAnimTimeRef.current;

  ctx.save();
  ctx.scale(dpr * zoom, dpr * zoom);
  ctx.translate(offset.x / zoom, offset.y / zoom);

  const viewWidth = canvas.width / (dpr * zoom);
  const viewHeight = canvas.height / (dpr * zoom);
  const viewLeft = -offset.x / zoom - TILE_WIDTH * 2;
  const viewTop = -offset.y / zoom - TILE_HEIGHT * 4;
  const viewRight = viewWidth - offset.x / zoom + TILE_WIDTH * 2;
  const viewBottom = viewHeight - offset.y / zoom + TILE_HEIGHT * 4;

  // Draw crime incident indicators
  activeCrimeIncidentsRef.current.forEach((crime) => {
    const { screenX, screenY } = gridToScreen(crime.x, crime.y, 0, 0);
    const centerX = screenX + TILE_WIDTH / 2;
    const centerY = screenY + TILE_HEIGHT / 2;

    // View culling
    if (centerX < viewLeft || centerX > viewRight || centerY < viewTop || centerY > viewBottom) {
      return;
    }

    // Pulsing effect
    const pulse = Math.sin(animTime * 4) * 0.3 + 0.7;
    const outerPulse = Math.sin(animTime * 3) * 0.5 + 0.5;

    // Outer glow ring
    ctx.beginPath();
    ctx.arc(centerX, centerY - 8, 18 + outerPulse * 6, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(59, 130, 246, ${0.25 * (1 - outerPulse)})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner pulsing glow
    const gradient = ctx.createRadialGradient(centerX, centerY - 8, 0, centerX, centerY - 8, 14 * pulse);
    gradient.addColorStop(0, `rgba(59, 130, 246, ${0.5 * pulse})`);
    gradient.addColorStop(0.5, `rgba(59, 130, 246, ${0.2 * pulse})`);
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
    ctx.beginPath();
    ctx.arc(centerX, centerY - 8, 14 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Crime icon (shield with exclamation)
    ctx.save();
    ctx.translate(centerX, centerY - 12);

    // Shield background
    ctx.fillStyle = `rgba(30, 64, 175, ${0.9 * pulse})`;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(6, -4);
    ctx.lineTo(6, 2);
    ctx.quadraticCurveTo(0, 8, 0, 8);
    ctx.quadraticCurveTo(0, 8, -6, 2);
    ctx.lineTo(-6, -4);
    ctx.closePath();
    ctx.fill();

    // Shield border
    ctx.strokeStyle = `rgba(147, 197, 253, ${pulse})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Exclamation mark
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-1, -4, 2, 5);
    ctx.beginPath();
    ctx.arc(0, 4, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });

  // Draw fire indicators
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const tile = grid[y][x];
      if (!tile.building.onFire) continue;

      const { screenX, screenY } = gridToScreen(x, y, 0, 0);
      const centerX = screenX + TILE_WIDTH / 2;
      const centerY = screenY + TILE_HEIGHT / 2;

      // View culling
      if (centerX < viewLeft || centerX > viewRight || centerY < viewTop || centerY > viewBottom) {
        continue;
      }

      // Pulsing effect for fire (faster)
      const pulse = Math.sin(animTime * 6) * 0.3 + 0.7;
      const outerPulse = Math.sin(animTime * 4) * 0.5 + 0.5;

      // Outer glow ring
      ctx.beginPath();
      ctx.arc(centerX, centerY - 12, 22 + outerPulse * 8, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(239, 68, 68, ${0.3 * (1 - outerPulse)})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inner danger icon
      ctx.save();
      ctx.translate(centerX, centerY - 15);

      // Warning triangle background
      ctx.fillStyle = `rgba(220, 38, 38, ${0.9 * pulse})`;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(8, 5);
      ctx.lineTo(-8, 5);
      ctx.closePath();
      ctx.fill();

      // Triangle border
      ctx.strokeStyle = `rgba(252, 165, 165, ${pulse})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Fire flame icon inside
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(0, -3);
      ctx.quadraticCurveTo(2.5, 0, 2, 2.5);
      ctx.quadraticCurveTo(0.5, 1.5, 0, 2.5);
      ctx.quadraticCurveTo(-0.5, 1.5, -2, 2.5);
      ctx.quadraticCurveTo(-2.5, 0, 0, -3);
      ctx.fill();

      ctx.restore();
    }
  }

  ctx.restore();
}
