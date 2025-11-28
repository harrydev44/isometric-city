/**
 * Boat drawing functions.
 * Extracted from CanvasIsometricGrid.tsx for better code organization.
 */

import { Boat, WorldRenderState, TILE_WIDTH, TILE_HEIGHT } from './types';
import { BOAT_MIN_ZOOM } from './constants';

// ============================================================================
// Boat Drawing
// ============================================================================

/**
 * Draw all boats and their wakes on the canvas.
 */
export function drawBoats(
  ctx: CanvasRenderingContext2D,
  worldState: WorldRenderState,
  boatsRef: React.MutableRefObject<Boat[]>,
  hour: number
): void {
  const { offset, zoom, grid, gridSize } = worldState;
  const canvas = ctx.canvas;
  const dpr = window.devicePixelRatio || 1;

  // Don't draw boats if zoomed out
  if (zoom < BOAT_MIN_ZOOM) {
    return;
  }

  if (!grid || gridSize <= 0 || boatsRef.current.length === 0) {
    return;
  }

  ctx.save();
  ctx.scale(dpr * zoom, dpr * zoom);
  ctx.translate(offset.x / zoom, offset.y / zoom);

  const viewWidth = canvas.width / (dpr * zoom);
  const viewHeight = canvas.height / (dpr * zoom);
  const viewLeft = -offset.x / zoom - 100;
  const viewTop = -offset.y / zoom - 100;
  const viewRight = viewWidth - offset.x / zoom + 100;
  const viewBottom = viewHeight - offset.y / zoom + 100;

  for (const boat of boatsRef.current) {
    // Draw wake particles first (behind boat)
    if (boat.wake.length > 0) {
      for (const particle of boat.wake) {
        if (particle.x < viewLeft || particle.x > viewRight || particle.y < viewTop || particle.y > viewBottom) {
          continue;
        }

        const size = 1.2 + particle.age * 2;
        const opacity = particle.opacity * 0.5;

        ctx.fillStyle = `rgba(200, 220, 255, ${opacity})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Skip boat rendering if outside viewport
    if (boat.x < viewLeft || boat.x > viewRight || boat.y < viewTop || boat.y > viewBottom) {
      continue;
    }

    ctx.save();
    ctx.translate(boat.x, boat.y);
    ctx.rotate(boat.angle);

    const scale = boat.sizeVariant === 0 ? 0.5 : 0.65;
    ctx.scale(scale, scale);

    // Draw small foam/splash at stern when moving
    if (boat.state !== 'docked') {
      const foamOpacity = Math.min(0.5, boat.speed / 30);
      ctx.fillStyle = `rgba(255, 255, 255, ${foamOpacity})`;
      ctx.beginPath();
      ctx.ellipse(-7, 0, 3, 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw boat hull
    ctx.fillStyle = boat.color;
    ctx.beginPath();
    ctx.moveTo(10, 0); // Bow
    ctx.quadraticCurveTo(8, -4, 0, -4);
    ctx.lineTo(-8, -3);
    ctx.lineTo(-8, 3);
    ctx.lineTo(0, 4);
    ctx.quadraticCurveTo(8, 4, 10, 0);
    ctx.closePath();
    ctx.fill();

    // Hull outline
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Deck
    const hullHSL = boat.color === '#ffffff' ? 'hsl(0, 0%, 95%)' :
                    boat.color === '#1e3a5f' ? 'hsl(210, 52%, 35%)' :
                    boat.color === '#8b4513' ? 'hsl(30, 75%, 40%)' :
                    boat.color === '#2f4f4f' ? 'hsl(180, 25%, 35%)' :
                    boat.color === '#c41e3a' ? 'hsl(350, 75%, 50%)' :
                    'hsl(210, 80%, 50%)';
    ctx.fillStyle = hullHSL;
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cabin/cockpit
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(-3, -1.5, 4, 3);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.3;
    ctx.strokeRect(-3, -1.5, 4, 3);

    // Mast or antenna
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.lineTo(2, -8);
    ctx.stroke();

    // Flag at top
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.moveTo(2, -8);
    ctx.lineTo(5, -7);
    ctx.lineTo(2, -6);
    ctx.closePath();
    ctx.fill();

    // Navigation lights at night
    const isNight = hour >= 20 || hour < 6;
    if (isNight) {
      // White masthead light
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffcc';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(2, -9, 0.8, 0, Math.PI * 2);
      ctx.fill();

      // Red port light
      ctx.fillStyle = '#ff3333';
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(-6, 2, 0.6, 0, Math.PI * 2);
      ctx.fill();

      // Green starboard light
      ctx.fillStyle = '#33ff33';
      ctx.shadowColor = '#00ff00';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(-6, -2, 0.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  ctx.restore();
}
