/**
 * Rail System - Rail track network with proper dual-track rendering, curves, and spurs
 * Each rail tile has 2 tracks that align precisely with gridlines and react to adjacent rails
 */

import { Tile } from '@/types/game';
import { TILE_WIDTH, TILE_HEIGHT } from './types';

// ============================================================================
// Types
// ============================================================================

/** Rail configuration for a tile */
export interface RailInfo {
  hasNorth: boolean;
  hasEast: boolean;
  hasSouth: boolean;
  hasWest: boolean;
  isIntersection: boolean;
  isCurve: boolean;
  isStraight: boolean;
  orientation: 'ns' | 'ew' | 'ne' | 'nw' | 'se' | 'sw' | 'cross';
}

// ============================================================================
// Constants
// ============================================================================

/** Rail rendering constants - carefully calculated for proper alignment */
export const RAIL_CONFIG = {
  // Track spacing - distance between the 2 rails (measured perpendicular to track direction)
  TRACK_SPACING: TILE_WIDTH * 0.09, // Spacing between dual tracks
  
  // Track width (visual thickness of each rail)
  TRACK_WIDTH: 1.2,
  
  // Sleeper (cross-tie) constants
  SLEEPER_WIDTH: TILE_WIDTH * 0.13, // Width across the tracks
  SLEEPER_HEIGHT: 2.5, // Thickness along track direction
  SLEEPER_SPACING: 8, // Distance between sleepers
  
  // Ballast (gravel bed) width
  BALLAST_WIDTH: TILE_WIDTH * 0.16,
  
  // Colors
  RAIL_COLOR: '#6b7280', // Steel gray for rails
  SLEEPER_COLOR: '#78350f', // Dark brown for wooden sleepers
  BALLAST_COLOR: '#9ca3af', // Light gray for gravel ballast
  BALLAST_SHADOW: '#6b7280', // Darker gray for ballast edges
};

// ============================================================================
// Rail Analysis Functions
// ============================================================================

/**
 * Check if a tile is a rail
 */
function isRail(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  return grid[y][x].building.type === 'rail';
}

/**
 * Get adjacent rail info for a tile
 */
export function getAdjacentRails(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): { north: boolean; east: boolean; south: boolean; west: boolean } {
  return {
    north: isRail(grid, gridSize, x - 1, y),
    east: isRail(grid, gridSize, x, y - 1),
    south: isRail(grid, gridSize, x + 1, y),
    west: isRail(grid, gridSize, x, y + 1),
  };
}

/**
 * Analyze rail configuration for a tile
 */
export function analyzeRailTile(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): RailInfo {
  if (!isRail(grid, gridSize, x, y)) {
    return {
      hasNorth: false,
      hasEast: false,
      hasSouth: false,
      hasWest: false,
      isIntersection: false,
      isCurve: false,
      isStraight: false,
      orientation: 'ns',
    };
  }

  const adj = getAdjacentRails(grid, gridSize, x, y);
  const connectionCount = [adj.north, adj.east, adj.south, adj.west].filter(Boolean).length;

  // Determine rail type and orientation
  const isIntersection = connectionCount >= 3;
  const isStraight = connectionCount === 2 && ((adj.north && adj.south) || (adj.east && adj.west));
  const isCurve = connectionCount === 2 && !isStraight;

  let orientation: 'ns' | 'ew' | 'ne' | 'nw' | 'se' | 'sw' | 'cross' = 'ns';
  
  if (isIntersection) {
    orientation = 'cross';
  } else if (isStraight) {
    orientation = (adj.north && adj.south) ? 'ns' : 'ew';
  } else if (isCurve) {
    if (adj.north && adj.east) orientation = 'ne';
    else if (adj.north && adj.west) orientation = 'nw';
    else if (adj.south && adj.east) orientation = 'se';
    else if (adj.south && adj.west) orientation = 'sw';
  } else if (connectionCount === 1) {
    // Spur/terminal - treat as straight in the direction of connection
    if (adj.north || adj.south) orientation = 'ns';
    else if (adj.east || adj.west) orientation = 'ew';
  }

  return {
    hasNorth: adj.north,
    hasEast: adj.east,
    hasSouth: adj.south,
    hasWest: adj.west,
    isIntersection,
    isCurve,
    isStraight: isStraight || connectionCount === 1,
    orientation,
  };
}

// ============================================================================
// Rail Drawing Functions
// ============================================================================

/**
 * Draw ballast (gravel bed) for rail tracks
 */
function drawBallast(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[]
): void {
  if (points.length < 2) return;

  ctx.fillStyle = RAIL_CONFIG.BALLAST_COLOR;
  ctx.strokeStyle = RAIL_CONFIG.BALLAST_SHADOW;
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/**
 * Draw a single sleeper (cross-tie)
 */
function drawSleeper(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  width: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.fillStyle = RAIL_CONFIG.SLEEPER_COLOR;
  ctx.fillRect(
    -width / 2,
    -RAIL_CONFIG.SLEEPER_HEIGHT / 2,
    width,
    RAIL_CONFIG.SLEEPER_HEIGHT
  );

  ctx.restore();
}

/**
 * Draw a straight rail segment with dual tracks
 * CRITICAL: Tracks must align precisely with gridlines and tile edges
 */
function drawStraightRail(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  orientation: 'ns' | 'ew',
  railInfo: RailInfo,
  zoom: number
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Calculate track offset from center (perpendicular to track direction)
  const trackOffset = RAIL_CONFIG.TRACK_SPACING / 2;

  if (orientation === 'ns') {
    // North-South rails
    // The two tracks run parallel, offset perpendicular to the NS direction
    
    // In isometric view, NS direction goes from top-left to bottom-right
    // Perpendicular offset is along the NE-SW axis
    const perpAngle = -Math.PI / 4; // NE-SW perpendicular to NW-SE
    const perpDx = Math.cos(perpAngle);
    const perpDy = Math.sin(perpAngle);

    // Track 1 (offset to the "right" when traveling north)
    const track1CenterX = cx + perpDx * trackOffset;
    const track1CenterY = cy + perpDy * trackOffset;

    // Track 2 (offset to the "left" when traveling north)
    const track2CenterX = cx - perpDx * trackOffset;
    const track2CenterY = cy - perpDy * trackOffset;

    // Start and end points for NS tracks (from north edge to south edge of tile)
    const northX = x + w * 0.25;
    const northY = y + h * 0.25;
    const southX = x + w * 0.75;
    const southY = y + h * 0.75;

    // Track direction (NW to SE in screen space)
    const trackDx = southX - northX;
    const trackDy = southY - northY;
    const trackLen = Math.hypot(trackDx, trackDy);
    const trackAngle = Math.atan2(trackDy, trackDx);

    // Draw ballast (gravel bed) - wider than tracks
    const ballastHalfWidth = RAIL_CONFIG.BALLAST_WIDTH / 2;
    const ballastPerpDx = -Math.sin(trackAngle);
    const ballastPerpDy = Math.cos(trackAngle);

    const ballastPoints = [
      { x: northX + ballastPerpDx * ballastHalfWidth, y: northY + ballastPerpDy * ballastHalfWidth },
      { x: southX + ballastPerpDx * ballastHalfWidth, y: southY + ballastPerpDy * ballastHalfWidth },
      { x: southX - ballastPerpDx * ballastHalfWidth, y: southY - ballastPerpDy * ballastHalfWidth },
      { x: northX - ballastPerpDx * ballastHalfWidth, y: northY - ballastPerpDy * ballastHalfWidth },
    ];
    drawBallast(ctx, ballastPoints);

    // Draw sleepers (cross-ties) at regular intervals
    if (zoom >= 0.5) {
      const sleeperCount = Math.floor(trackLen / RAIL_CONFIG.SLEEPER_SPACING);
      for (let i = 0; i <= sleeperCount; i++) {
        const t = i / sleeperCount;
        const sleeperX = northX + trackDx * t;
        const sleeperY = northY + trackDy * t;
        drawSleeper(ctx, sleeperX, sleeperY, trackAngle + Math.PI / 2, RAIL_CONFIG.SLEEPER_WIDTH);
      }
    }

    // Draw the two rails
    ctx.strokeStyle = RAIL_CONFIG.RAIL_COLOR;
    ctx.lineWidth = RAIL_CONFIG.TRACK_WIDTH;
    ctx.lineCap = 'butt';

    // Track 1
    const track1StartX = northX + perpDx * trackOffset;
    const track1StartY = northY + perpDy * trackOffset;
    const track1EndX = southX + perpDx * trackOffset;
    const track1EndY = southY + perpDy * trackOffset;

    ctx.beginPath();
    ctx.moveTo(track1StartX, track1StartY);
    ctx.lineTo(track1EndX, track1EndY);
    ctx.stroke();

    // Track 2
    const track2StartX = northX - perpDx * trackOffset;
    const track2StartY = northY - perpDy * trackOffset;
    const track2EndX = southX - perpDx * trackOffset;
    const track2EndY = southY - perpDy * trackOffset;

    ctx.beginPath();
    ctx.moveTo(track2StartX, track2StartY);
    ctx.lineTo(track2EndX, track2EndY);
    ctx.stroke();

  } else if (orientation === 'ew') {
    // East-West rails
    // Perpendicular offset is along the NW-SE axis
    const perpAngle = Math.PI / 4; // NW-SE perpendicular to NE-SW
    const perpDx = Math.cos(perpAngle);
    const perpDy = Math.sin(perpAngle);

    // Start and end points for EW tracks (from east edge to west edge of tile)
    const eastX = x + w * 0.75;
    const eastY = y + h * 0.25;
    const westX = x + w * 0.25;
    const westY = y + h * 0.75;

    // Track direction (NE to SW in screen space)
    const trackDx = westX - eastX;
    const trackDy = westY - eastY;
    const trackLen = Math.hypot(trackDx, trackDy);
    const trackAngle = Math.atan2(trackDy, trackDx);

    // Draw ballast
    const ballastHalfWidth = RAIL_CONFIG.BALLAST_WIDTH / 2;
    const ballastPerpDx = -Math.sin(trackAngle);
    const ballastPerpDy = Math.cos(trackAngle);

    const ballastPoints = [
      { x: eastX + ballastPerpDx * ballastHalfWidth, y: eastY + ballastPerpDy * ballastHalfWidth },
      { x: westX + ballastPerpDx * ballastHalfWidth, y: westY + ballastPerpDy * ballastHalfWidth },
      { x: westX - ballastPerpDx * ballastHalfWidth, y: westY - ballastPerpDy * ballastHalfWidth },
      { x: eastX - ballastPerpDx * ballastHalfWidth, y: eastY - ballastPerpDy * ballastHalfWidth },
    ];
    drawBallast(ctx, ballastPoints);

    // Draw sleepers
    if (zoom >= 0.5) {
      const sleeperCount = Math.floor(trackLen / RAIL_CONFIG.SLEEPER_SPACING);
      for (let i = 0; i <= sleeperCount; i++) {
        const t = i / sleeperCount;
        const sleeperX = eastX + trackDx * t;
        const sleeperY = eastY + trackDy * t;
        drawSleeper(ctx, sleeperX, sleeperY, trackAngle + Math.PI / 2, RAIL_CONFIG.SLEEPER_WIDTH);
      }
    }

    // Draw the two rails
    ctx.strokeStyle = RAIL_CONFIG.RAIL_COLOR;
    ctx.lineWidth = RAIL_CONFIG.TRACK_WIDTH;
    ctx.lineCap = 'butt';

    // Track 1
    const track1StartX = eastX + perpDx * trackOffset;
    const track1StartY = eastY + perpDy * trackOffset;
    const track1EndX = westX + perpDx * trackOffset;
    const track1EndY = westY + perpDy * trackOffset;

    ctx.beginPath();
    ctx.moveTo(track1StartX, track1StartY);
    ctx.lineTo(track1EndX, track1EndY);
    ctx.stroke();

    // Track 2
    const track2StartX = eastX - perpDx * trackOffset;
    const track2StartY = eastY - perpDy * trackOffset;
    const track2EndX = westX - perpDx * trackOffset;
    const track2EndY = westY - perpDy * trackOffset;

    ctx.beginPath();
    ctx.moveTo(track2StartX, track2StartY);
    ctx.lineTo(track2EndX, track2EndY);
    ctx.stroke();
  }
}

/**
 * Draw a curved rail segment with dual tracks
 * Curves connect two perpendicular directions (e.g., N-E, N-W, S-E, S-W)
 */
function drawCurvedRail(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  orientation: 'ne' | 'nw' | 'se' | 'sw',
  railInfo: RailInfo,
  zoom: number
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Track offset from centerline
  const trackOffset = RAIL_CONFIG.TRACK_SPACING / 2;

  // Define curve endpoints based on orientation
  // Each curve connects two edges of the tile
  let startX: number, startY: number, endX: number, endY: number;
  let controlX: number, controlY: number; // Quadratic Bezier control point
  let innerTrackControl: { x: number; y: number };
  let outerTrackControl: { x: number; y: number };

  const northX = x + w * 0.25;
  const northY = y + h * 0.25;
  const eastX = x + w * 0.75;
  const eastY = y + h * 0.25;
  const southX = x + w * 0.75;
  const southY = y + h * 0.75;
  const westX = x + w * 0.25;
  const westY = y + h * 0.75;

  if (orientation === 'ne') {
    // North to East curve
    startX = northX;
    startY = northY;
    endX = eastX;
    endY = eastY;
    controlX = x + w * 0.5;
    controlY = y;
  } else if (orientation === 'nw') {
    // North to West curve
    startX = northX;
    startY = northY;
    endX = westX;
    endY = westY;
    controlX = x;
    controlY = y + h * 0.5;
  } else if (orientation === 'se') {
    // South to East curve
    startX = southX;
    startY = southY;
    endX = eastX;
    endY = eastY;
    controlX = x + w;
    controlY = y + h * 0.5;
  } else { // 'sw'
    // South to West curve
    startX = southX;
    startY = southY;
    endX = westX;
    endY = westY;
    controlX = x + w * 0.5;
    controlY = y + h;
  }

  // Draw ballast along the curve
  const ballastHalfWidth = RAIL_CONFIG.BALLAST_WIDTH / 2;
  
  // Calculate perpendicular offsets along the curve for ballast edges
  // We'll approximate with a polygon
  ctx.fillStyle = RAIL_CONFIG.BALLAST_COLOR;
  ctx.strokeStyle = RAIL_CONFIG.BALLAST_SHADOW;
  ctx.lineWidth = 1;

  ctx.beginPath();
  // Outer edge
  for (let t = 0; t <= 1; t += 0.1) {
    const px = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * controlX + t * t * endX;
    const py = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * controlY + t * t * endY;
    
    // Tangent direction
    const tx = 2 * (1 - t) * (controlX - startX) + 2 * t * (endX - controlX);
    const ty = 2 * (1 - t) * (controlY - startY) + 2 * t * (endY - controlY);
    const tLen = Math.hypot(tx, ty);
    const perpX = -ty / tLen * ballastHalfWidth;
    const perpY = tx / tLen * ballastHalfWidth;
    
    if (t === 0) {
      ctx.moveTo(px + perpX, py + perpY);
    } else {
      ctx.lineTo(px + perpX, py + perpY);
    }
  }
  // Inner edge (reverse)
  for (let t = 1; t >= 0; t -= 0.1) {
    const px = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * controlX + t * t * endX;
    const py = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * controlY + t * t * endY;
    
    const tx = 2 * (1 - t) * (controlX - startX) + 2 * t * (endX - controlX);
    const ty = 2 * (1 - t) * (controlY - startY) + 2 * t * (endY - controlY);
    const tLen = Math.hypot(tx, ty);
    const perpX = -ty / tLen * ballastHalfWidth;
    const perpY = tx / tLen * ballastHalfWidth;
    
    ctx.lineTo(px - perpX, py - perpY);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Draw sleepers along the curve
  if (zoom >= 0.5) {
    const curveLen = Math.hypot(endX - startX, endY - startY) * 1.5; // Approximate curve length
    const sleeperCount = Math.floor(curveLen / RAIL_CONFIG.SLEEPER_SPACING);
    
    for (let i = 0; i <= sleeperCount; i++) {
      const t = i / sleeperCount;
      const px = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * controlX + t * t * endX;
      const py = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * controlY + t * t * endY;
      
      // Tangent angle at this point
      const tx = 2 * (1 - t) * (controlX - startX) + 2 * t * (endX - controlX);
      const ty = 2 * (1 - t) * (controlY - startY) + 2 * t * (endY - controlY);
      const angle = Math.atan2(ty, tx);
      
      drawSleeper(ctx, px, py, angle + Math.PI / 2, RAIL_CONFIG.SLEEPER_WIDTH);
    }
  }

  // Draw the two curved rails
  ctx.strokeStyle = RAIL_CONFIG.RAIL_COLOR;
  ctx.lineWidth = RAIL_CONFIG.TRACK_WIDTH;
  ctx.lineCap = 'butt';

  // Track 1 (inner curve - tighter radius)
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  for (let t = 0; t <= 1; t += 0.05) {
    const px = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * controlX + t * t * endX;
    const py = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * controlY + t * t * endY;
    
    // Perpendicular offset (toward inside of curve)
    const tx = 2 * (1 - t) * (controlX - startX) + 2 * t * (endX - controlX);
    const ty = 2 * (1 - t) * (controlY - startY) + 2 * t * (endY - controlY);
    const tLen = Math.hypot(tx, ty);
    const perpX = -ty / tLen * trackOffset;
    const perpY = tx / tLen * trackOffset;
    
    // Determine if this is inner or outer curve based on orientation
    const sign = (orientation === 'ne' || orientation === 'sw') ? 1 : -1;
    
    ctx.lineTo(px + perpX * sign, py + perpY * sign);
  }
  ctx.stroke();

  // Track 2 (outer curve - wider radius)
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  for (let t = 0; t <= 1; t += 0.05) {
    const px = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * controlX + t * t * endX;
    const py = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * controlY + t * t * endY;
    
    const tx = 2 * (1 - t) * (controlX - startX) + 2 * t * (endX - controlX);
    const ty = 2 * (1 - t) * (controlY - startY) + 2 * t * (endY - controlY);
    const tLen = Math.hypot(tx, ty);
    const perpX = -ty / tLen * trackOffset;
    const perpY = tx / tLen * trackOffset;
    
    const sign = (orientation === 'ne' || orientation === 'sw') ? -1 : 1;
    
    ctx.lineTo(px + perpX * sign, py + perpY * sign);
  }
  ctx.stroke();
}

/**
 * Draw a rail intersection (crossing)
 */
function drawRailIntersection(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  railInfo: RailInfo,
  zoom: number
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;

  // Draw ballast base
  const ballastPoints = [
    { x: x + w * 0.25, y: y + h * 0.25 },
    { x: x + w * 0.75, y: y + h * 0.25 },
    { x: x + w * 0.75, y: y + h * 0.75 },
    { x: x + w * 0.25, y: y + h * 0.75 },
  ];
  drawBallast(ctx, ballastPoints);

  // Draw NS tracks if connected
  if (railInfo.hasNorth || railInfo.hasSouth) {
    const tempInfo: RailInfo = { ...railInfo, orientation: 'ns' };
    drawStraightRail(ctx, x, y, 'ns', tempInfo, zoom);
  }

  // Draw EW tracks if connected
  if (railInfo.hasEast || railInfo.hasWest) {
    const tempInfo: RailInfo = { ...railInfo, orientation: 'ew' };
    drawStraightRail(ctx, x, y, 'ew', tempInfo, zoom);
  }
}

/**
 * Main function to draw rail tracks on a tile
 */
export function drawRailTracks(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  gridX: number,
  gridY: number,
  grid: Tile[][],
  gridSize: number,
  zoom: number
): void {
  const railInfo = analyzeRailTile(grid, gridSize, gridX, gridY);

  if (railInfo.isIntersection) {
    drawRailIntersection(ctx, x, y, railInfo, zoom);
  } else if (railInfo.isCurve) {
    drawCurvedRail(ctx, x, y, railInfo.orientation as 'ne' | 'nw' | 'se' | 'sw', railInfo, zoom);
  } else {
    // Straight or spur
    const orientation = railInfo.orientation === 'ns' || railInfo.orientation === 'ew' 
      ? railInfo.orientation 
      : 'ns'; // Default for spurs
    drawStraightRail(ctx, x, y, orientation, railInfo, zoom);
  }
}
