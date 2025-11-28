/**
 * Vehicle drawing functions for cars and emergency vehicles.
 * Extracted from CanvasIsometricGrid.tsx for better code organization.
 */

import { BuildingType, Tile } from '@/types/game';
import { Car, EmergencyVehicle, WorldRenderState, TILE_WIDTH, TILE_HEIGHT } from './types';
import { DIRECTION_META } from './constants';
import { gridToScreen } from './utils';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a vehicle is behind a building (for occlusion).
 */
function isVehicleBehindBuilding(
  tileX: number,
  tileY: number,
  grid: Tile[][],
  gridSize: number
): boolean {
  const vehicleDepth = tileX + tileY;

  for (let dy = 0; dy <= 1; dy++) {
    for (let dx = 0; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;

      const checkX = tileX + dx;
      const checkY = tileY + dy;

      if (checkX < 0 || checkY < 0 || checkX >= gridSize || checkY >= gridSize) {
        continue;
      }

      const tile = grid[checkY]?.[checkX];
      if (!tile) continue;

      const buildingType = tile.building.type;
      const skipTypes: BuildingType[] = ['road', 'grass', 'empty', 'water', 'tree'];
      if (skipTypes.includes(buildingType)) {
        continue;
      }

      const buildingDepth = checkX + checkY;
      if (buildingDepth > vehicleDepth) {
        return true;
      }
    }
  }

  return false;
}

// ============================================================================
// Car Drawing
// ============================================================================

/**
 * Draw all cars on the canvas.
 */
export function drawCars(
  ctx: CanvasRenderingContext2D,
  worldState: WorldRenderState,
  carsRef: React.MutableRefObject<Car[]>
): void {
  const { offset, zoom, grid, gridSize } = worldState;
  const canvas = ctx.canvas;
  const dpr = window.devicePixelRatio || 1;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!grid || gridSize <= 0 || carsRef.current.length === 0) {
    return;
  }

  ctx.save();
  ctx.scale(dpr * zoom, dpr * zoom);
  ctx.translate(offset.x / zoom, offset.y / zoom);

  const viewWidth = canvas.width / (dpr * zoom);
  const viewHeight = canvas.height / (dpr * zoom);
  const viewLeft = -offset.x / zoom - TILE_WIDTH;
  const viewTop = -offset.y / zoom - TILE_HEIGHT * 2;
  const viewRight = viewWidth - offset.x / zoom + TILE_WIDTH;
  const viewBottom = viewHeight - offset.y / zoom + TILE_HEIGHT * 2;

  carsRef.current.forEach(car => {
    const { screenX, screenY } = gridToScreen(car.tileX, car.tileY, 0, 0);
    const centerX = screenX + TILE_WIDTH / 2;
    const centerY = screenY + TILE_HEIGHT / 2;
    const meta = DIRECTION_META[car.direction];
    const carX = centerX + meta.vec.dx * car.progress + meta.normal.nx * car.laneOffset;
    const carY = centerY + meta.vec.dy * car.progress + meta.normal.ny * car.laneOffset;

    // Viewport culling
    if (carX < viewLeft - 40 || carX > viewRight + 40 || carY < viewTop - 60 || carY > viewBottom + 60) {
      return;
    }

    // Check if car is behind a building
    if (isVehicleBehindBuilding(car.tileX, car.tileY, grid, gridSize)) {
      return;
    }

    ctx.save();
    ctx.translate(carX, carY);
    ctx.rotate(meta.angle);

    const scale = 0.7;

    // Car body
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.moveTo(-10 * scale, -5 * scale);
    ctx.lineTo(10 * scale, -5 * scale);
    ctx.lineTo(12 * scale, 0);
    ctx.lineTo(10 * scale, 5 * scale);
    ctx.lineTo(-10 * scale, 5 * scale);
    ctx.closePath();
    ctx.fill();

    // Windshield
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillRect(-4 * scale, -2.8 * scale, 7 * scale, 5.6 * scale);

    // Rear
    ctx.fillStyle = '#111827';
    ctx.fillRect(-10 * scale, -4 * scale, 2.4 * scale, 8 * scale);

    ctx.restore();
  });

  ctx.restore();
}

// ============================================================================
// Emergency Vehicle Drawing
// ============================================================================

/**
 * Draw all emergency vehicles on the canvas.
 */
export function drawEmergencyVehicles(
  ctx: CanvasRenderingContext2D,
  worldState: WorldRenderState,
  emergencyVehiclesRef: React.MutableRefObject<EmergencyVehicle[]>
): void {
  const { offset, zoom, grid, gridSize } = worldState;
  const canvas = ctx.canvas;
  const dpr = window.devicePixelRatio || 1;

  if (!grid || gridSize <= 0 || emergencyVehiclesRef.current.length === 0) {
    return;
  }

  ctx.save();
  ctx.scale(dpr * zoom, dpr * zoom);
  ctx.translate(offset.x / zoom, offset.y / zoom);

  const viewWidth = canvas.width / (dpr * zoom);
  const viewHeight = canvas.height / (dpr * zoom);
  const viewLeft = -offset.x / zoom - TILE_WIDTH;
  const viewTop = -offset.y / zoom - TILE_HEIGHT * 2;
  const viewRight = viewWidth - offset.x / zoom + TILE_WIDTH;
  const viewBottom = viewHeight - offset.y / zoom + TILE_HEIGHT * 2;

  emergencyVehiclesRef.current.forEach(vehicle => {
    const { screenX, screenY } = gridToScreen(vehicle.tileX, vehicle.tileY, 0, 0);
    const centerX = screenX + TILE_WIDTH / 2;
    const centerY = screenY + TILE_HEIGHT / 2;
    const meta = DIRECTION_META[vehicle.direction];
    const vehicleX = centerX + meta.vec.dx * vehicle.progress + meta.normal.nx * vehicle.laneOffset;
    const vehicleY = centerY + meta.vec.dy * vehicle.progress + meta.normal.ny * vehicle.laneOffset;

    // View culling
    if (vehicleX < viewLeft - 40 || vehicleX > viewRight + 40 || vehicleY < viewTop - 60 || vehicleY > viewBottom + 60) {
      return;
    }

    ctx.save();
    ctx.translate(vehicleX, vehicleY);
    ctx.rotate(meta.angle);

    const scale = 0.6;

    // Vehicle body color
    const bodyColor = vehicle.type === 'fire_truck' ? '#dc2626' : '#1e40af';

    // Draw vehicle body
    const length = vehicle.type === 'fire_truck' ? 14 : 11;
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(-length * scale, -5 * scale);
    ctx.lineTo(length * scale, -5 * scale);
    ctx.lineTo((length + 2) * scale, 0);
    ctx.lineTo(length * scale, 5 * scale);
    ctx.lineTo(-length * scale, 5 * scale);
    ctx.closePath();
    ctx.fill();

    // Draw stripe/accent
    ctx.fillStyle = vehicle.type === 'fire_truck' ? '#fbbf24' : '#ffffff';
    ctx.fillRect(-length * scale * 0.5, -3 * scale, length * scale, 6 * scale * 0.3);

    // Draw windshield
    ctx.fillStyle = 'rgba(200, 220, 255, 0.7)';
    ctx.fillRect(-2 * scale, -3 * scale, 5 * scale, 6 * scale);

    // Draw emergency lights (flashing)
    const flashOn = Math.sin(vehicle.flashTimer) > 0;
    const flashOn2 = Math.sin(vehicle.flashTimer + Math.PI) > 0;

    if (vehicle.type === 'fire_truck') {
      // Fire truck has red lights
      ctx.fillStyle = flashOn ? '#ff0000' : '#880000';
      ctx.fillRect(-6 * scale, -7 * scale, 3 * scale, 3 * scale);
      ctx.fillStyle = flashOn2 ? '#ff0000' : '#880000';
      ctx.fillRect(3 * scale, -7 * scale, 3 * scale, 3 * scale);

      // Glow effect
      if (flashOn || flashOn2) {
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 6;
        ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
        ctx.fillRect(-8 * scale, -8 * scale, 16 * scale, 4 * scale);
        ctx.shadowBlur = 0;
      }
    } else {
      // Police car has red and blue lights
      ctx.fillStyle = flashOn ? '#ff0000' : '#880000';
      ctx.fillRect(-5 * scale, -7 * scale, 3 * scale, 3 * scale);
      ctx.fillStyle = flashOn2 ? '#0066ff' : '#003388';
      ctx.fillRect(2 * scale, -7 * scale, 3 * scale, 3 * scale);

      // Glow effect
      if (flashOn || flashOn2) {
        ctx.shadowColor = flashOn ? '#ff0000' : '#0066ff';
        ctx.shadowBlur = 6;
        ctx.fillStyle = flashOn ? 'rgba(255, 0, 0, 0.4)' : 'rgba(0, 100, 255, 0.4)';
        ctx.fillRect(-7 * scale, -8 * scale, 14 * scale, 4 * scale);
        ctx.shadowBlur = 0;
      }
    }

    // Draw rear wheels/details
    ctx.fillStyle = '#111827';
    ctx.fillRect(-length * scale, -4 * scale, 2 * scale, 8 * scale);

    ctx.restore();
  });

  ctx.restore();
}
