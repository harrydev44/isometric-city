/**
 * Advanced road drawing system with lanes, dividers, and traffic lights
 */

import { Tile } from '@/types/game';
import { TILE_WIDTH, TILE_HEIGHT } from './types';
import { RoadNetworkInfo, TrafficLight } from './traffic';
import { getDiamondCorners } from './drawing';

// Road colors
const ROAD_COLOR = '#4a4a4a';
const ROAD_DARK = '#3a3a3a';
const ROAD_LIGHT = '#5a5a5a';
const LANE_MARKING_COLOR = '#fbbf24';
const DIVIDER_COLOR = '#2d2d2d';
const DIVIDER_PLANT_COLOR = '#22c55e';
const SIDEWALK_COLOR = '#9ca3af';
const CURB_COLOR = '#6b7280';

// Traffic light colors
const TRAFFIC_LIGHT_RED = '#ef4444';
const TRAFFIC_LIGHT_YELLOW = '#fbbf24';
const TRAFFIC_LIGHT_GREEN = '#22c55e';
const TRAFFIC_LIGHT_POLE = '#4b5563';
const TRAFFIC_LIGHT_BOX = '#1f2937';

/**
 * Draw a sophisticated road with lanes, dividers, and traffic lights
 */
export function drawAdvancedRoad(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  gridX: number,
  gridY: number,
  roadInfo: RoadNetworkInfo,
  trafficLight: TrafficLight | null
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Draw sidewalks first (underneath)
  drawSidewalks(ctx, x, y, roadInfo);

  // Draw road base
  drawRoadBase(ctx, x, y, roadInfo);

  // Draw lane markings
  drawLaneMarkings(ctx, x, y, roadInfo);

  // Draw central divider if needed
  if (roadInfo.hasCentralDivider) {
    drawCentralDivider(ctx, x, y, roadInfo);
  }

  // Draw turn lanes if needed
  if (roadInfo.hasTurnLanes) {
    drawTurnLanes(ctx, x, y, roadInfo);
  }

  // Draw traffic light if present
  if (trafficLight) {
    drawTrafficLight(ctx, x, y, trafficLight);
  }
}

/**
 * Draw sidewalks around the road
 */
function drawSidewalks(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  roadInfo: RoadNetworkInfo
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const sidewalkWidth = w * 0.08;
  const corners = getDiamondCorners(x, y);

  // Draw sidewalk on edges without adjacent roads
  const drawSidewalkEdge = (
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    inwardDx: number,
    inwardDy: number,
    shortenStart: boolean,
    shortenEnd: boolean
  ) => {
    const shortenDist = sidewalkWidth * 0.707;
    const edgeDx = endX - startX;
    const edgeDy = endY - startY;
    const edgeLen = Math.hypot(edgeDx, edgeDy);
    const edgeDirX = edgeDx / edgeLen;
    const edgeDirY = edgeDy / edgeLen;

    let actualStartX = startX;
    let actualStartY = startY;
    let actualEndX = endX;
    let actualEndY = endY;

    if (shortenStart && edgeLen > shortenDist * 2) {
      actualStartX = startX + edgeDirX * shortenDist;
      actualStartY = startY + edgeDirY * shortenDist;
    }
    if (shortenEnd && edgeLen > shortenDist * 2) {
      actualEndX = endX - edgeDirX * shortenDist;
      actualEndY = endY - edgeDirY * shortenDist;
    }

    // Draw curb
    ctx.strokeStyle = CURB_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(actualStartX, actualStartY);
    ctx.lineTo(actualEndX, actualEndY);
    ctx.stroke();

    // Draw sidewalk fill
    ctx.fillStyle = SIDEWALK_COLOR;
    ctx.beginPath();
    ctx.moveTo(actualStartX, actualStartY);
    ctx.lineTo(actualEndX, actualEndY);
    ctx.lineTo(actualEndX + inwardDx * sidewalkWidth, actualEndY + inwardDy * sidewalkWidth);
    ctx.lineTo(actualStartX + inwardDx * sidewalkWidth, actualStartY + inwardDy * sidewalkWidth);
    ctx.closePath();
    ctx.fill();
  };

  // North edge (left to top)
  if (!roadInfo.hasNorth) {
    drawSidewalkEdge(
      corners.left.x,
      corners.left.y,
      corners.top.x,
      corners.top.y,
      0.707,
      0.707,
      !roadInfo.hasWest,
      !roadInfo.hasEast
    );
  }

  // East edge (top to right)
  if (!roadInfo.hasEast) {
    drawSidewalkEdge(
      corners.top.x,
      corners.top.y,
      corners.right.x,
      corners.right.y,
      -0.707,
      0.707,
      !roadInfo.hasNorth,
      !roadInfo.hasSouth
    );
  }

  // South edge (right to bottom)
  if (!roadInfo.hasSouth) {
    drawSidewalkEdge(
      corners.right.x,
      corners.right.y,
      corners.bottom.x,
      corners.bottom.y,
      -0.707,
      -0.707,
      !roadInfo.hasEast,
      !roadInfo.hasWest
    );
  }

  // West edge (bottom to left)
  if (!roadInfo.hasWest) {
    drawSidewalkEdge(
      corners.bottom.x,
      corners.bottom.y,
      corners.left.x,
      corners.left.y,
      0.707,
      -0.707,
      !roadInfo.hasSouth,
      !roadInfo.hasNorth
    );
  }
}

/**
 * Draw the base road surface
 */
function drawRoadBase(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  roadInfo: RoadNetworkInfo
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Road width varies based on type
  let roadWidth = w * 0.14; // Base width for single lane
  if (roadInfo.type === 'two_lane') {
    roadWidth = w * 0.20;
  } else if (roadInfo.type === 'four_lane' || roadInfo.type === 'avenue') {
    roadWidth = w * 0.28;
  } else if (roadInfo.type === 'highway') {
    roadWidth = w * 0.35;
  }

  const edgeStop = 0.98;

  // Calculate edge midpoints
  const northEdgeX = x + w * 0.25;
  const northEdgeY = y + h * 0.25;
  const eastEdgeX = x + w * 0.75;
  const eastEdgeY = y + h * 0.25;
  const southEdgeX = x + w * 0.75;
  const southEdgeY = y + h * 0.75;
  const westEdgeX = x + w * 0.25;
  const westEdgeY = y + h * 0.75;

  // Direction vectors
  const northDx = (northEdgeX - cx) / Math.hypot(northEdgeX - cx, northEdgeY - cy);
  const northDy = (northEdgeY - cy) / Math.hypot(northEdgeX - cx, northEdgeY - cy);
  const eastDx = (eastEdgeX - cx) / Math.hypot(eastEdgeX - cx, eastEdgeY - cy);
  const eastDy = (eastEdgeY - cy) / Math.hypot(eastEdgeX - cx, eastEdgeY - cy);
  const southDx = (southEdgeX - cx) / Math.hypot(southEdgeX - cx, southEdgeY - cy);
  const southDy = (southEdgeY - cy) / Math.hypot(southEdgeX - cx, southEdgeY - cy);
  const westDx = (westEdgeX - cx) / Math.hypot(westEdgeX - cx, westEdgeY - cy);
  const westDy = (westEdgeY - cy) / Math.hypot(westEdgeX - cx, westEdgeY - cy);

  const getPerp = (dx: number, dy: number) => ({ nx: -dy, ny: dx });

  ctx.fillStyle = ROAD_COLOR;

  // Draw road segments
  if (roadInfo.hasNorth) {
    const stopX = cx + (northEdgeX - cx) * edgeStop;
    const stopY = cy + (northEdgeY - cy) * edgeStop;
    const perp = getPerp(northDx, northDy);
    const halfWidth = roadWidth * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx + perp.nx * halfWidth, cy + perp.ny * halfWidth);
    ctx.lineTo(stopX + perp.nx * halfWidth, stopY + perp.ny * halfWidth);
    ctx.lineTo(stopX - perp.nx * halfWidth, stopY - perp.ny * halfWidth);
    ctx.lineTo(cx - perp.nx * halfWidth, cy - perp.ny * halfWidth);
    ctx.closePath();
    ctx.fill();
  }

  if (roadInfo.hasEast) {
    const stopX = cx + (eastEdgeX - cx) * edgeStop;
    const stopY = cy + (eastEdgeY - cy) * edgeStop;
    const perp = getPerp(eastDx, eastDy);
    const halfWidth = roadWidth * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx + perp.nx * halfWidth, cy + perp.ny * halfWidth);
    ctx.lineTo(stopX + perp.nx * halfWidth, stopY + perp.ny * halfWidth);
    ctx.lineTo(stopX - perp.nx * halfWidth, stopY - perp.ny * halfWidth);
    ctx.lineTo(cx - perp.nx * halfWidth, cy - perp.ny * halfWidth);
    ctx.closePath();
    ctx.fill();
  }

  if (roadInfo.hasSouth) {
    const stopX = cx + (southEdgeX - cx) * edgeStop;
    const stopY = cy + (southEdgeY - cy) * edgeStop;
    const perp = getPerp(southDx, southDy);
    const halfWidth = roadWidth * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx + perp.nx * halfWidth, cy + perp.ny * halfWidth);
    ctx.lineTo(stopX + perp.nx * halfWidth, stopY + perp.ny * halfWidth);
    ctx.lineTo(stopX - perp.nx * halfWidth, stopY - perp.ny * halfWidth);
    ctx.lineTo(cx - perp.nx * halfWidth, cy - perp.ny * halfWidth);
    ctx.closePath();
    ctx.fill();
  }

  if (roadInfo.hasWest) {
    const stopX = cx + (westEdgeX - cx) * edgeStop;
    const stopY = cy + (westEdgeY - cy) * edgeStop;
    const perp = getPerp(westDx, westDy);
    const halfWidth = roadWidth * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx + perp.nx * halfWidth, cy + perp.ny * halfWidth);
    ctx.lineTo(stopX + perp.nx * halfWidth, stopY + perp.ny * halfWidth);
    ctx.lineTo(stopX - perp.nx * halfWidth, stopY - perp.ny * halfWidth);
    ctx.lineTo(cx - perp.nx * halfWidth, cy - perp.ny * halfWidth);
    ctx.closePath();
    ctx.fill();
  }

  // Center intersection
  const centerSize = roadWidth * 1.4;
  ctx.beginPath();
  ctx.moveTo(cx, cy - centerSize);
  ctx.lineTo(cx + centerSize, cy);
  ctx.lineTo(cx, cy + centerSize);
  ctx.lineTo(cx - centerSize, cy);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw lane markings (yellow dashed lines)
 */
function drawLaneMarkings(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  roadInfo: RoadNetworkInfo
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;

  ctx.strokeStyle = LANE_MARKING_COLOR;
  ctx.lineWidth = 0.8;
  ctx.setLineDash([1.5, 2]);
  ctx.lineCap = 'round';

  const markingOverlap = 4;
  const markingStartOffset = 2;

  // Calculate edge midpoints
  const northEdgeX = x + w * 0.25;
  const northEdgeY = y + h * 0.25;
  const eastEdgeX = x + w * 0.75;
  const eastEdgeY = y + h * 0.25;
  const southEdgeX = x + w * 0.75;
  const southEdgeY = y + h * 0.75;
  const westEdgeX = x + w * 0.25;
  const westEdgeY = y + h * 0.75;

  const northDx = (northEdgeX - cx) / Math.hypot(northEdgeX - cx, northEdgeY - cy);
  const northDy = (northEdgeY - cy) / Math.hypot(northEdgeX - cx, northEdgeY - cy);
  const eastDx = (eastEdgeX - cx) / Math.hypot(eastEdgeX - cx, eastEdgeY - cy);
  const eastDy = (eastEdgeY - cy) / Math.hypot(eastEdgeX - cx, eastEdgeY - cy);
  const southDx = (southEdgeX - cx) / Math.hypot(southEdgeX - cx, southEdgeY - cy);
  const southDy = (southEdgeY - cy) / Math.hypot(southEdgeX - cx, southEdgeY - cy);
  const westDx = (westEdgeX - cx) / Math.hypot(westEdgeX - cx, westEdgeY - cy);
  const westDy = (westEdgeY - cy) / Math.hypot(westEdgeX - cx, westEdgeY - cy);

  // Draw center line for multi-lane roads
  if (roadInfo.lanes >= 2) {
    if (roadInfo.hasNorth && roadInfo.hasSouth) {
      ctx.beginPath();
      ctx.moveTo(cx + northDx * markingStartOffset, cy + northDy * markingStartOffset);
      ctx.lineTo(northEdgeX + northDx * markingOverlap, northEdgeY + northDy * markingOverlap);
      ctx.moveTo(cx + southDx * markingStartOffset, cy + southDy * markingStartOffset);
      ctx.lineTo(southEdgeX + southDx * markingOverlap, southEdgeY + southDy * markingOverlap);
      ctx.stroke();
    }

    if (roadInfo.hasEast && roadInfo.hasWest) {
      ctx.beginPath();
      ctx.moveTo(cx + eastDx * markingStartOffset, cy + eastDy * markingStartOffset);
      ctx.lineTo(eastEdgeX + eastDx * markingOverlap, eastEdgeY + eastDy * markingOverlap);
      ctx.moveTo(cx + westDx * markingStartOffset, cy + westDy * markingStartOffset);
      ctx.lineTo(westEdgeX + westDx * markingOverlap, westEdgeY + westDy * markingOverlap);
      ctx.stroke();
    }
  }

  // Draw lane dividers for 4+ lane roads
  if (roadInfo.lanes >= 4 && !roadInfo.hasCentralDivider) {
    // Draw additional lane markings
    const getPerp = (dx: number, dy: number) => ({ nx: -dy, ny: dx });
    
    if (roadInfo.hasNorth && roadInfo.hasSouth) {
      const perp = getPerp(northDx, northDy);
      const offset = TILE_WIDTH * 0.04;
      ctx.beginPath();
      ctx.moveTo(cx + perp.nx * offset + northDx * markingStartOffset, cy + perp.ny * offset + northDy * markingStartOffset);
      ctx.lineTo(northEdgeX + perp.nx * offset + northDx * markingOverlap, northEdgeY + perp.ny * offset + northDy * markingOverlap);
      ctx.moveTo(cx - perp.nx * offset + northDx * markingStartOffset, cy - perp.ny * offset + northDy * markingStartOffset);
      ctx.lineTo(northEdgeX - perp.nx * offset + northDx * markingOverlap, northEdgeY - perp.ny * offset + northDy * markingOverlap);
      ctx.stroke();
    }

    if (roadInfo.hasEast && roadInfo.hasWest) {
      const perp = getPerp(eastDx, eastDy);
      const offset = TILE_WIDTH * 0.04;
      ctx.beginPath();
      ctx.moveTo(cx + perp.nx * offset + eastDx * markingStartOffset, cy + perp.ny * offset + eastDy * markingStartOffset);
      ctx.lineTo(eastEdgeX + perp.nx * offset + eastDx * markingOverlap, eastEdgeY + perp.ny * offset + eastDy * markingOverlap);
      ctx.moveTo(cx - perp.nx * offset + eastDx * markingStartOffset, cy - perp.ny * offset + eastDy * markingStartOffset);
      ctx.lineTo(eastEdgeX - perp.nx * offset + eastDx * markingOverlap, eastEdgeY - perp.ny * offset + eastDy * markingOverlap);
      ctx.stroke();
    }
  }

  ctx.setLineDash([]);
  ctx.lineCap = 'butt';
}

/**
 * Draw central divider with plants/structures
 */
function drawCentralDivider(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  roadInfo: RoadNetworkInfo
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;

  const dividerWidth = w * 0.06;
  const getPerp = (dx: number, dy: number) => ({ nx: -dy, ny: dx });

  // Calculate edge midpoints
  const northEdgeX = x + w * 0.25;
  const northEdgeY = y + h * 0.25;
  const eastEdgeX = x + w * 0.75;
  const eastEdgeY = y + h * 0.25;
  const southEdgeX = x + w * 0.75;
  const southEdgeY = y + h * 0.75;
  const westEdgeX = x + w * 0.25;
  const westEdgeY = y + h * 0.75;

  const northDx = (northEdgeX - cx) / Math.hypot(northEdgeX - cx, northEdgeY - cy);
  const northDy = (northEdgeY - cy) / Math.hypot(northEdgeX - cx, northEdgeY - cy);
  const eastDx = (eastEdgeX - cx) / Math.hypot(eastEdgeX - cx, eastEdgeY - cy);
  const eastDy = (eastEdgeY - cy) / Math.hypot(eastEdgeX - cx, eastEdgeY - cy);
  const southDx = (southEdgeX - cx) / Math.hypot(southEdgeX - cx, southEdgeY - cy);
  const southDy = (southEdgeY - cy) / Math.hypot(southEdgeX - cx, southEdgeY - cy);
  const westDx = (westEdgeX - cx) / Math.hypot(westEdgeX - cx, westEdgeY - cy);
  const westDy = (westEdgeY - cy) / Math.hypot(westEdgeX - cx, westEdgeY - cy);

  // Draw divider along road direction
  if (roadInfo.hasNorth && roadInfo.hasSouth) {
    const perp = getPerp(northDx, northDy);
    const halfWidth = dividerWidth * 0.5;
    const stopX = cx + (northEdgeX - cx) * 0.98;
    const stopY = cy + (northEdgeY - cy) * 0.98;
    const stopX2 = cx + (southEdgeX - cx) * 0.98;
    const stopY2 = cy + (southEdgeY - cy) * 0.98;

    // Draw divider base
    ctx.fillStyle = DIVIDER_COLOR;
    ctx.beginPath();
    ctx.moveTo(cx + perp.nx * halfWidth, cy + perp.ny * halfWidth);
    ctx.lineTo(stopX + perp.nx * halfWidth, stopY + perp.ny * halfWidth);
    ctx.lineTo(stopX2 + perp.nx * halfWidth, stopY2 + perp.ny * halfWidth);
    ctx.lineTo(stopX2 - perp.nx * halfWidth, stopY2 - perp.ny * halfWidth);
    ctx.lineTo(stopX - perp.nx * halfWidth, stopY - perp.ny * halfWidth);
    ctx.lineTo(cx - perp.nx * halfWidth, cy - perp.ny * halfWidth);
    ctx.closePath();
    ctx.fill();

    // Draw small plants on divider
    const plantSpacing = TILE_HEIGHT * 0.3;
    const plantSize = w * 0.03;
    ctx.fillStyle = DIVIDER_PLANT_COLOR;
    for (let i = 0; i < 3; i++) {
      const t = (i + 1) / 4;
      const px = cx + (northEdgeX - cx) * t;
      const py = cy + (northEdgeY - cy) * t;
      ctx.beginPath();
      ctx.arc(px, py, plantSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (roadInfo.hasEast && roadInfo.hasWest) {
    const perp = getPerp(eastDx, eastDy);
    const halfWidth = dividerWidth * 0.5;
    const stopX = cx + (eastEdgeX - cx) * 0.98;
    const stopY = cy + (eastEdgeY - cy) * 0.98;
    const stopX2 = cx + (westEdgeX - cx) * 0.98;
    const stopY2 = cy + (westEdgeY - cy) * 0.98;

    // Draw divider base
    ctx.fillStyle = DIVIDER_COLOR;
    ctx.beginPath();
    ctx.moveTo(cx + perp.nx * halfWidth, cy + perp.ny * halfWidth);
    ctx.lineTo(stopX + perp.nx * halfWidth, stopY + perp.ny * halfWidth);
    ctx.lineTo(stopX2 + perp.nx * halfWidth, stopY2 + perp.ny * halfWidth);
    ctx.lineTo(stopX2 - perp.nx * halfWidth, stopY2 - perp.ny * halfWidth);
    ctx.lineTo(stopX - perp.nx * halfWidth, stopY - perp.ny * halfWidth);
    ctx.lineTo(cx - perp.nx * halfWidth, cy - perp.ny * halfWidth);
    ctx.closePath();
    ctx.fill();

    // Draw small plants on divider
    const plantSize = w * 0.03;
    ctx.fillStyle = DIVIDER_PLANT_COLOR;
    for (let i = 0; i < 3; i++) {
      const t = (i + 1) / 4;
      const px = cx + (eastEdgeX - cx) * t;
      const py = cy + (eastEdgeY - cy) * t;
      ctx.beginPath();
      ctx.arc(px, py, plantSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Draw turn lanes at intersections
 */
function drawTurnLanes(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  roadInfo: RoadNetworkInfo
): void {
  // Turn lanes are indicated by wider road sections at intersections
  // This is handled by the road base drawing, but we can add arrows here
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Simple turn lane indicators (small arrows)
  ctx.fillStyle = LANE_MARKING_COLOR;
  ctx.font = '8px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Draw small turn arrows at intersection corners
  if (roadInfo.orientation === 'intersection') {
    // This is a simplified representation
    // In a full implementation, you'd draw proper turn lane markings
  }
}

/**
 * Draw a simple traffic light
 */
function drawTrafficLight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  light: TrafficLight
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Traffic light size (very simple and small)
  const lightBoxWidth = w * 0.12;
  const lightBoxHeight = h * 0.18;
  const lightSize = w * 0.04;
  const poleHeight = h * 0.15;

  // Position based on direction
  let lightX = cx;
  let lightY = cy - h * 0.25; // Above center

  if (light.direction === 'east_west') {
    lightX = cx + w * 0.25;
    lightY = cy;
  }

  // Draw pole
  ctx.fillStyle = TRAFFIC_LIGHT_POLE;
  ctx.fillRect(lightX - 1, lightY, 2, poleHeight);

  // Draw light box
  ctx.fillStyle = TRAFFIC_LIGHT_BOX;
  ctx.fillRect(lightX - lightBoxWidth / 2, lightY - lightBoxHeight, lightBoxWidth, lightBoxHeight);

  // Draw lights (simple circles)
  const lightSpacing = lightBoxHeight / 4;
  const topLightY = lightY - lightBoxHeight + lightSpacing;
  const middleLightY = lightY - lightBoxHeight + lightSpacing * 2;
  const bottomLightY = lightY - lightBoxHeight + lightSpacing * 3;

  // Red light (top)
  ctx.fillStyle = light.state === 'red' ? TRAFFIC_LIGHT_RED : '#4a1f1f';
  ctx.beginPath();
  ctx.arc(lightX, topLightY, lightSize, 0, Math.PI * 2);
  ctx.fill();

  // Yellow light (middle)
  ctx.fillStyle = light.state === 'yellow' ? TRAFFIC_LIGHT_YELLOW : '#4a3f1f';
  ctx.beginPath();
  ctx.arc(lightX, middleLightY, lightSize, 0, Math.PI * 2);
  ctx.fill();

  // Green light (bottom)
  ctx.fillStyle = light.state === 'green' ? TRAFFIC_LIGHT_GREEN : '#1f4a1f';
  ctx.beginPath();
  ctx.arc(lightX, bottomLightY, lightSize, 0, Math.PI * 2);
  ctx.fill();
}
