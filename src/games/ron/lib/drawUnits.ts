/**
 * Rise of Nations - Unit Drawing
 * 
 * Renders units with pedestrian-like sprites and task-based activities.
 * Inspired by IsoCity's pedestrian system but simplified for RTS units.
 */

import { Unit, UnitTask, UNIT_STATS } from '../types/units';
import { TILE_WIDTH, TILE_HEIGHT, gridToScreen } from '@/components/game/shared';

// Skin tone colors (similar to IsoCity)
const SKIN_TONES = ['#f5d0c5', '#e8beac', '#d4a574', '#c68642', '#8d5524', '#5c3317'];

// Clothing colors for civilians
const CIVILIAN_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// Hair colors
const HAIR_COLORS = ['#2c1810', '#4a3728', '#8b4513', '#d4a574', '#f5deb3', '#1a1a1a'];

// Tool colors for different tasks
const TOOL_COLORS: Record<string, string> = {
  gather_wood: '#8b4513',   // Brown axe
  gather_metal: '#6b7280',  // Grey pickaxe
  gather_food: '#f59e0b',   // Golden scythe
  gather_gold: '#fbbf24',   // Gold pan
  gather_oil: '#1f2937',    // Dark oil tool
  build: '#a16207',         // Hammer
};

/**
 * Get deterministic values based on unit ID for consistent appearance
 */
function getUnitAppearance(unitId: string): {
  skinTone: string;
  clothingColor: string;
  hairColor: string;
  hasTool: boolean;
} {
  // Simple hash from unit ID
  let hash = 0;
  for (let i = 0; i < unitId.length; i++) {
    hash = ((hash << 5) - hash) + unitId.charCodeAt(i);
    hash = hash & hash;
  }
  const absHash = Math.abs(hash);
  
  return {
    skinTone: SKIN_TONES[absHash % SKIN_TONES.length],
    clothingColor: CIVILIAN_COLORS[(absHash >> 4) % CIVILIAN_COLORS.length],
    hairColor: HAIR_COLORS[(absHash >> 8) % HAIR_COLORS.length],
    hasTool: true,
  };
}

/**
 * Draw a citizen/worker unit with activity-based animation
 */
function drawCitizenUnit(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  unit: Unit,
  zoom: number,
  tick: number
): void {
  const appearance = getUnitAppearance(unit.id);
  // Canvas is already scaled by zoom, so just use a fixed scale
  const scale = 0.5;
  
  // Animation based on task and movement
  const isWorking = unit.task && unit.task.startsWith('gather_') && !unit.isMoving;
  const animPhase = (tick * 0.1 + parseInt(unit.id.slice(-4), 16)) % (Math.PI * 2);
  
  // Body dimensions
  const bodyHeight = 10 * scale;
  const bodyWidth = 5 * scale;
  const headRadius = 3 * scale;
  const legLength = 4 * scale;
  
  // Walking animation
  let legOffset = 0;
  let armSwing = 0;
  if (unit.isMoving) {
    legOffset = Math.sin(animPhase * 3) * 2 * scale;
    armSwing = Math.sin(animPhase * 3) * 0.3;
  }
  
  // Working animation (tool swinging)
  let toolAngle = 0;
  let bodyLean = 0;
  if (isWorking) {
    toolAngle = Math.sin(animPhase * 2) * 0.5;
    bodyLean = Math.sin(animPhase * 2) * 0.1;
  }
  
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(bodyLean);
  
  // Draw legs
  ctx.strokeStyle = appearance.clothingColor;
  ctx.lineWidth = 2 * scale;
  ctx.lineCap = 'round';
  
  // Left leg
  ctx.beginPath();
  ctx.moveTo(-bodyWidth * 0.3, 0);
  ctx.lineTo(-bodyWidth * 0.3 + legOffset * 0.5, legLength);
  ctx.stroke();
  
  // Right leg
  ctx.beginPath();
  ctx.moveTo(bodyWidth * 0.3, 0);
  ctx.lineTo(bodyWidth * 0.3 - legOffset * 0.5, legLength);
  ctx.stroke();
  
  // Draw body (torso)
  ctx.fillStyle = appearance.clothingColor;
  ctx.beginPath();
  ctx.ellipse(0, -bodyHeight * 0.4, bodyWidth * 0.6, bodyHeight * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw arms
  ctx.strokeStyle = appearance.skinTone;
  ctx.lineWidth = 2 * scale;
  
  // Left arm
  ctx.beginPath();
  ctx.moveTo(-bodyWidth * 0.5, -bodyHeight * 0.5);
  ctx.lineTo(-bodyWidth * 0.8, -bodyHeight * 0.2 + Math.sin(armSwing) * 3 * scale);
  ctx.stroke();
  
  // Right arm (with tool if working)
  ctx.beginPath();
  ctx.moveTo(bodyWidth * 0.5, -bodyHeight * 0.5);
  if (isWorking && unit.task) {
    // Arm holding tool
    const toolEndX = bodyWidth * 0.8 + Math.sin(toolAngle) * 6 * scale;
    const toolEndY = -bodyHeight * 0.2 + Math.cos(toolAngle) * 6 * scale;
    ctx.lineTo(toolEndX, toolEndY);
    ctx.stroke();
    
    // Draw tool
    const toolColor = TOOL_COLORS[unit.task] || '#6b7280';
    ctx.strokeStyle = toolColor;
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(toolEndX, toolEndY);
    ctx.lineTo(toolEndX + Math.sin(toolAngle + 0.5) * 5 * scale, toolEndY - 4 * scale);
    ctx.stroke();
    
    // Tool head
    ctx.fillStyle = toolColor;
    ctx.beginPath();
    ctx.arc(toolEndX + Math.sin(toolAngle + 0.5) * 5 * scale, toolEndY - 5 * scale, 2 * scale, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.lineTo(bodyWidth * 0.8, -bodyHeight * 0.2 - Math.sin(armSwing) * 3 * scale);
    ctx.stroke();
  }
  
  // Draw head
  ctx.fillStyle = appearance.skinTone;
  ctx.beginPath();
  ctx.arc(0, -bodyHeight - headRadius, headRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw hair
  ctx.fillStyle = appearance.hairColor;
  ctx.beginPath();
  ctx.arc(0, -bodyHeight - headRadius - headRadius * 0.3, headRadius * 0.9, Math.PI, 0);
  ctx.fill();
  
  ctx.restore();
}

/**
 * Draw a military unit with detailed appearance based on unit type
 */
function drawMilitaryUnit(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  unit: Unit,
  color: string,
  zoom: number,
  tick: number
): void {
  const stats = UNIT_STATS[unit.type];
  const scale = 0.5;
  const animPhase = (tick * 0.1 + parseInt(unit.id.slice(-4), 16)) % (Math.PI * 2);
  
  // Darken color for shadows
  const darkerColor = shadeColor(color, -30);
  const lighterColor = shadeColor(color, 30);
  
  if (stats.category === 'cavalry') {
    // Draw horse/mount with rider
    drawCavalryUnit(ctx, centerX, centerY, unit, color, darkerColor, lighterColor, scale, animPhase);
  } else if (stats.category === 'siege') {
    // Draw siege weapon (catapult, cannon, etc.)
    drawSiegeUnit(ctx, centerX, centerY, unit, color, darkerColor, scale, animPhase);
  } else if (stats.category === 'ranged') {
    // Draw ranged soldier with bow/gun
    drawRangedUnit(ctx, centerX, centerY, unit, color, darkerColor, scale, animPhase);
  } else if (stats.category === 'naval') {
    // Draw ship/boat
    drawNavalUnit(ctx, centerX, centerY, unit, color, darkerColor, lighterColor, scale, animPhase);
  } else if (stats.category === 'air') {
    // Draw aircraft
    drawAirUnit(ctx, centerX, centerY, unit, color, darkerColor, lighterColor, scale, animPhase);
  } else {
    // Infantry - draw soldier with weapon and shield
    drawInfantryUnit(ctx, centerX, centerY, unit, color, darkerColor, scale, animPhase);
  }
}

/**
 * Shade a hex color lighter or darker
 */
function shadeColor(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + 
    (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 + 
    (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 + 
    (B < 255 ? (B < 1 ? 0 : B) : 255)
  ).toString(16).slice(1);
}

/**
 * Draw infantry soldier with weapon and shield
 */
function drawInfantryUnit(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  unit: Unit,
  color: string,
  darkerColor: string,
  scale: number,
  animPhase: number
): void {
  const bodyHeight = 10 * scale;
  const bodyWidth = 5 * scale;
  const headRadius = 2.5 * scale;
  const legLength = 4 * scale;
  
  let legOffset = 0;
  let armSwing = 0;
  if (unit.isMoving) {
    legOffset = Math.sin(animPhase * 3) * 2 * scale;
    armSwing = Math.sin(animPhase * 3) * 0.2;
  }
  
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(centerX, centerY + legLength + 1, bodyWidth * 0.8, bodyWidth * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Legs (dark pants)
  ctx.strokeStyle = '#3d3d3d';
  ctx.lineWidth = 2.5 * scale;
  ctx.lineCap = 'round';
  
  ctx.beginPath();
  ctx.moveTo(centerX - bodyWidth * 0.25, centerY);
  ctx.lineTo(centerX - bodyWidth * 0.25 + legOffset * 0.4, centerY + legLength);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(centerX + bodyWidth * 0.25, centerY);
  ctx.lineTo(centerX + bodyWidth * 0.25 - legOffset * 0.4, centerY + legLength);
  ctx.stroke();
  
  // Boots
  ctx.fillStyle = '#2d2d2d';
  ctx.beginPath();
  ctx.arc(centerX - bodyWidth * 0.25 + legOffset * 0.4, centerY + legLength, 1.2 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(centerX + bodyWidth * 0.25 - legOffset * 0.4, centerY + legLength, 1.2 * scale, 0, Math.PI * 2);
  ctx.fill();
  
  // Body/torso (uniform)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(centerX - bodyWidth * 0.5, centerY - bodyHeight * 0.7, bodyWidth, bodyHeight * 0.8, 1 * scale);
  ctx.fill();
  
  // Uniform detail stripe
  ctx.fillStyle = darkerColor;
  ctx.fillRect(centerX - bodyWidth * 0.1, centerY - bodyHeight * 0.6, bodyWidth * 0.2, bodyHeight * 0.6);
  
  // Shield (left arm)
  ctx.fillStyle = darkerColor;
  ctx.beginPath();
  ctx.ellipse(centerX - bodyWidth * 0.8, centerY - bodyHeight * 0.3, bodyWidth * 0.4, bodyHeight * 0.35, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 0.5 * scale;
  ctx.stroke();
  
  // Right arm with sword/spear
  ctx.save();
  ctx.translate(centerX + bodyWidth * 0.5, centerY - bodyHeight * 0.5);
  ctx.rotate(armSwing + 0.3);
  
  // Arm
  ctx.strokeStyle = '#e8beac';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(bodyWidth * 0.6, bodyHeight * 0.3);
  ctx.stroke();
  
  // Sword handle
  ctx.strokeStyle = '#5c4033';
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(bodyWidth * 0.5, bodyHeight * 0.2);
  ctx.lineTo(bodyWidth * 0.5, bodyHeight * 0.5);
  ctx.stroke();
  
  // Sword blade
  ctx.strokeStyle = '#c0c0c0';
  ctx.lineWidth = 1.8 * scale;
  ctx.beginPath();
  ctx.moveTo(bodyWidth * 0.5, bodyHeight * 0.5);
  ctx.lineTo(bodyWidth * 0.5, bodyHeight * 1.2);
  ctx.stroke();
  
  // Blade tip
  ctx.fillStyle = '#c0c0c0';
  ctx.beginPath();
  ctx.moveTo(bodyWidth * 0.5 - 1 * scale, bodyHeight * 1.2);
  ctx.lineTo(bodyWidth * 0.5, bodyHeight * 1.4);
  ctx.lineTo(bodyWidth * 0.5 + 1 * scale, bodyHeight * 1.2);
  ctx.closePath();
  ctx.fill();
  
  ctx.restore();
  
  // Head
  ctx.fillStyle = '#e8beac';
  ctx.beginPath();
  ctx.arc(centerX, centerY - bodyHeight * 0.8 - headRadius, headRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // Helmet
  ctx.fillStyle = '#71717a';
  ctx.beginPath();
  ctx.arc(centerX, centerY - bodyHeight * 0.8 - headRadius - headRadius * 0.2, headRadius * 1.1, Math.PI * 1.1, Math.PI * 1.9);
  ctx.fill();
  
  // Helmet crest/plume
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY - bodyHeight * 0.8 - headRadius * 2.5, headRadius * 0.3, headRadius * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw ranged unit with bow or gun
 */
function drawRangedUnit(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  unit: Unit,
  color: string,
  darkerColor: string,
  scale: number,
  animPhase: number
): void {
  const bodyHeight = 10 * scale;
  const bodyWidth = 5 * scale;
  const headRadius = 2.5 * scale;
  const legLength = 4 * scale;
  
  const isModern = unit.type.includes('rifle') || unit.type.includes('machine') || unit.type.includes('gunner');
  
  let legOffset = 0;
  if (unit.isMoving) {
    legOffset = Math.sin(animPhase * 3) * 2 * scale;
  }
  
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(centerX, centerY + legLength + 1, bodyWidth * 0.8, bodyWidth * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Legs
  ctx.strokeStyle = '#4a5568';
  ctx.lineWidth = 2.5 * scale;
  ctx.lineCap = 'round';
  
  ctx.beginPath();
  ctx.moveTo(centerX - bodyWidth * 0.25, centerY);
  ctx.lineTo(centerX - bodyWidth * 0.25 + legOffset * 0.4, centerY + legLength);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(centerX + bodyWidth * 0.25, centerY);
  ctx.lineTo(centerX + bodyWidth * 0.25 - legOffset * 0.4, centerY + legLength);
  ctx.stroke();
  
  // Body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(centerX - bodyWidth * 0.5, centerY - bodyHeight * 0.7, bodyWidth, bodyHeight * 0.8, 1 * scale);
  ctx.fill();
  
  // Weapon
  if (isModern) {
    // Rifle/gun
    ctx.strokeStyle = '#3d3d3d';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(centerX + bodyWidth * 0.3, centerY - bodyHeight * 0.4);
    ctx.lineTo(centerX + bodyWidth * 1.8, centerY - bodyHeight * 0.6);
    ctx.stroke();
    
    // Gun stock
    ctx.strokeStyle = '#5c4033';
    ctx.lineWidth = 2.5 * scale;
    ctx.beginPath();
    ctx.moveTo(centerX + bodyWidth * 0.3, centerY - bodyHeight * 0.3);
    ctx.lineTo(centerX + bodyWidth * 0.8, centerY - bodyHeight * 0.15);
    ctx.stroke();
  } else {
    // Bow
    ctx.strokeStyle = '#8b4513';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.arc(centerX + bodyWidth * 0.8, centerY - bodyHeight * 0.3, bodyHeight * 0.5, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.stroke();
    
    // Bowstring
    ctx.strokeStyle = '#d4a574';
    ctx.lineWidth = 0.5 * scale;
    ctx.beginPath();
    ctx.moveTo(centerX + bodyWidth * 0.8 + Math.cos(-Math.PI * 0.4) * bodyHeight * 0.5, 
               centerY - bodyHeight * 0.3 + Math.sin(-Math.PI * 0.4) * bodyHeight * 0.5);
    ctx.lineTo(centerX + bodyWidth * 0.8 + Math.cos(Math.PI * 0.4) * bodyHeight * 0.5,
               centerY - bodyHeight * 0.3 + Math.sin(Math.PI * 0.4) * bodyHeight * 0.5);
    ctx.stroke();
    
    // Quiver on back
    ctx.fillStyle = '#8b4513';
    ctx.beginPath();
    ctx.roundRect(centerX - bodyWidth * 0.9, centerY - bodyHeight * 0.6, bodyWidth * 0.3, bodyHeight * 0.5, 0.5 * scale);
    ctx.fill();
    
    // Arrows in quiver
    ctx.strokeStyle = '#d4a574';
    ctx.lineWidth = 0.5 * scale;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(centerX - bodyWidth * 0.85 + i * 1 * scale, centerY - bodyHeight * 0.6);
      ctx.lineTo(centerX - bodyWidth * 0.85 + i * 1 * scale, centerY - bodyHeight * 0.85);
      ctx.stroke();
    }
  }
  
  // Head
  ctx.fillStyle = '#e8beac';
  ctx.beginPath();
  ctx.arc(centerX, centerY - bodyHeight * 0.8 - headRadius, headRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // Hat/cap
  ctx.fillStyle = darkerColor;
  ctx.beginPath();
  ctx.arc(centerX, centerY - bodyHeight * 0.8 - headRadius - headRadius * 0.3, headRadius * 1.0, Math.PI * 1.15, Math.PI * 1.85);
  ctx.fill();
}

/**
 * Draw cavalry unit (horse + rider)
 */
function drawCavalryUnit(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  unit: Unit,
  color: string,
  darkerColor: string,
  lighterColor: string,
  scale: number,
  animPhase: number
): void {
  const isTank = unit.type.includes('tank') || unit.type.includes('armored');
  
  if (isTank) {
    // Draw tank/armored vehicle
    const width = 14 * scale;
    const height = 8 * scale;
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + 2, width * 0.6, height * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Tracks
    ctx.fillStyle = '#2d2d2d';
    ctx.beginPath();
    ctx.roundRect(centerX - width * 0.55, centerY - height * 0.2, width * 1.1, height * 0.4, 2 * scale);
    ctx.fill();
    
    // Track wheels
    ctx.fillStyle = '#1a1a1a';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(centerX - width * 0.4 + i * width * 0.27, centerY, height * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Hull
    ctx.fillStyle = darkerColor;
    ctx.beginPath();
    ctx.moveTo(centerX - width * 0.5, centerY - height * 0.2);
    ctx.lineTo(centerX - width * 0.35, centerY - height * 0.5);
    ctx.lineTo(centerX + width * 0.35, centerY - height * 0.5);
    ctx.lineTo(centerX + width * 0.5, centerY - height * 0.2);
    ctx.closePath();
    ctx.fill();
    
    // Turret
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY - height * 0.55, width * 0.3, height * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Cannon
    ctx.strokeStyle = darkerColor;
    ctx.lineWidth = 2.5 * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - height * 0.55);
    ctx.lineTo(centerX + width * 0.6, centerY - height * 0.65);
    ctx.stroke();
    
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.ellipse(centerX - width * 0.1, centerY - height * 0.65, width * 0.15, height * 0.1, -0.3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Draw horse + rider
    const horseLength = 12 * scale;
    const horseHeight = 7 * scale;
    
    // Animate legs
    const legAnim = unit.isMoving ? Math.sin(animPhase * 4) * 2 * scale : 0;
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + 3, horseLength * 0.5, horseHeight * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Horse legs (back)
    ctx.strokeStyle = '#5c4033';
    ctx.lineWidth = 2 * scale;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.moveTo(centerX - horseLength * 0.3, centerY - horseHeight * 0.1);
    ctx.lineTo(centerX - horseLength * 0.35 - legAnim * 0.3, centerY + horseHeight * 0.4);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(centerX + horseLength * 0.25, centerY - horseHeight * 0.1);
    ctx.lineTo(centerX + horseLength * 0.2 + legAnim * 0.3, centerY + horseHeight * 0.4);
    ctx.stroke();
    
    // Horse body
    ctx.fillStyle = '#8b4513';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY - horseHeight * 0.3, horseLength * 0.45, horseHeight * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Horse legs (front)
    ctx.strokeStyle = '#6b3a1a';
    ctx.beginPath();
    ctx.moveTo(centerX - horseLength * 0.25, centerY - horseHeight * 0.1);
    ctx.lineTo(centerX - horseLength * 0.3 + legAnim * 0.3, centerY + horseHeight * 0.4);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(centerX + horseLength * 0.3, centerY - horseHeight * 0.1);
    ctx.lineTo(centerX + horseLength * 0.35 - legAnim * 0.3, centerY + horseHeight * 0.4);
    ctx.stroke();
    
    // Horse head
    ctx.fillStyle = '#8b4513';
    ctx.beginPath();
    ctx.ellipse(centerX + horseLength * 0.5, centerY - horseHeight * 0.5, horseLength * 0.15, horseHeight * 0.25, 0.4, 0, Math.PI * 2);
    ctx.fill();
    
    // Ears
    ctx.beginPath();
    ctx.moveTo(centerX + horseLength * 0.5, centerY - horseHeight * 0.75);
    ctx.lineTo(centerX + horseLength * 0.45, centerY - horseHeight * 0.9);
    ctx.lineTo(centerX + horseLength * 0.55, centerY - horseHeight * 0.9);
    ctx.closePath();
    ctx.fill();
    
    // Tail
    ctx.strokeStyle = '#3d2817';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(centerX - horseLength * 0.45, centerY - horseHeight * 0.3);
    ctx.quadraticCurveTo(centerX - horseLength * 0.6, centerY - horseHeight * 0.1, 
                         centerX - horseLength * 0.55, centerY + horseHeight * 0.1);
    ctx.stroke();
    
    // Rider body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY - horseHeight * 0.7, horseLength * 0.15, horseHeight * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Rider head
    ctx.fillStyle = '#e8beac';
    ctx.beginPath();
    ctx.arc(centerX, centerY - horseHeight * 1.1, horseHeight * 0.18, 0, Math.PI * 2);
    ctx.fill();
    
    // Rider helmet
    ctx.fillStyle = darkerColor;
    ctx.beginPath();
    ctx.arc(centerX, centerY - horseHeight * 1.15, horseHeight * 0.2, Math.PI * 1.1, Math.PI * 1.9);
    ctx.fill();
    
    // Lance/spear
    ctx.strokeStyle = '#5c4033';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(centerX + horseLength * 0.2, centerY - horseHeight * 0.5);
    ctx.lineTo(centerX + horseLength * 0.7, centerY - horseHeight * 1.3);
    ctx.stroke();
    
    // Lance tip
    ctx.fillStyle = '#c0c0c0';
    ctx.beginPath();
    ctx.moveTo(centerX + horseLength * 0.7 - 1 * scale, centerY - horseHeight * 1.3);
    ctx.lineTo(centerX + horseLength * 0.7, centerY - horseHeight * 1.5);
    ctx.lineTo(centerX + horseLength * 0.7 + 1 * scale, centerY - horseHeight * 1.3);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * Draw siege unit (catapult, cannon, etc.)
 */
function drawSiegeUnit(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  unit: Unit,
  color: string,
  darkerColor: string,
  scale: number,
  animPhase: number
): void {
  const isModern = unit.type.includes('cannon') || unit.type.includes('howitzer');
  const width = 14 * scale;
  const height = 10 * scale;
  
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(centerX, centerY + 2, width * 0.5, height * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  
  if (isModern) {
    // Cannon/artillery
    // Wheels
    ctx.fillStyle = '#3d3d3d';
    ctx.beginPath();
    ctx.arc(centerX - width * 0.3, centerY, height * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(centerX + width * 0.3, centerY, height * 0.25, 0, Math.PI * 2);
    ctx.fill();
    
    // Wheel spokes
    ctx.strokeStyle = '#2d2d2d';
    ctx.lineWidth = 1 * scale;
    for (let w = -1; w <= 1; w += 2) {
      for (let i = 0; i < 4; i++) {
        const angle = i * Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(centerX + w * width * 0.3, centerY);
        ctx.lineTo(centerX + w * width * 0.3 + Math.cos(angle) * height * 0.2,
                   centerY + Math.sin(angle) * height * 0.2);
        ctx.stroke();
      }
    }
    
    // Carriage
    ctx.fillStyle = darkerColor;
    ctx.beginPath();
    ctx.roundRect(centerX - width * 0.35, centerY - height * 0.35, width * 0.7, height * 0.3, 1 * scale);
    ctx.fill();
    
    // Barrel
    ctx.fillStyle = '#4a4a4a';
    ctx.beginPath();
    ctx.roundRect(centerX - width * 0.1, centerY - height * 0.4, width * 0.7, height * 0.2, 2 * scale);
    ctx.fill();
    
    // Barrel highlight
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.roundRect(centerX - width * 0.05, centerY - height * 0.38, width * 0.5, height * 0.06, 1 * scale);
    ctx.fill();
  } else {
    // Catapult/trebuchet
    // Base/frame
    ctx.fillStyle = '#5c4033';
    ctx.beginPath();
    ctx.roundRect(centerX - width * 0.4, centerY - height * 0.15, width * 0.8, height * 0.25, 1 * scale);
    ctx.fill();
    
    // Wheels
    ctx.fillStyle = '#3d2817';
    ctx.beginPath();
    ctx.arc(centerX - width * 0.35, centerY + height * 0.1, height * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(centerX + width * 0.35, centerY + height * 0.1, height * 0.18, 0, Math.PI * 2);
    ctx.fill();
    
    // Throwing arm
    ctx.strokeStyle = '#5c4033';
    ctx.lineWidth = 3 * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - height * 0.1);
    ctx.lineTo(centerX + width * 0.5, centerY - height * 0.7);
    ctx.stroke();
    
    // Sling/bucket
    ctx.strokeStyle = '#8b7355';
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.moveTo(centerX + width * 0.5, centerY - height * 0.7);
    ctx.quadraticCurveTo(centerX + width * 0.6, centerY - height * 0.5,
                         centerX + width * 0.55, centerY - height * 0.4);
    ctx.stroke();
    
    // Boulder
    ctx.fillStyle = '#6b7280';
    ctx.beginPath();
    ctx.arc(centerX + width * 0.55, centerY - height * 0.35, height * 0.12, 0, Math.PI * 2);
    ctx.fill();
    
    // Support frame
    ctx.strokeStyle = '#4a3728';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(centerX - width * 0.15, centerY - height * 0.1);
    ctx.lineTo(centerX, centerY - height * 0.5);
    ctx.lineTo(centerX + width * 0.15, centerY - height * 0.1);
    ctx.stroke();
  }
}

/**
 * Draw naval unit (ship/boat)
 */
function drawNavalUnit(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  unit: Unit,
  color: string,
  darkerColor: string,
  lighterColor: string,
  scale: number,
  animPhase: number
): void {
  const width = 16 * scale;
  const height = 8 * scale;
  
  // Bobbing animation
  const bob = Math.sin(animPhase * 2) * 1 * scale;
  
  // Water wake
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.ellipse(centerX, centerY + bob + 2, width * 0.6, height * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Hull
  ctx.fillStyle = darkerColor;
  ctx.beginPath();
  ctx.moveTo(centerX - width * 0.5, centerY + bob);
  ctx.quadraticCurveTo(centerX - width * 0.4, centerY + bob + height * 0.3, centerX, centerY + bob + height * 0.25);
  ctx.quadraticCurveTo(centerX + width * 0.4, centerY + bob + height * 0.3, centerX + width * 0.55, centerY + bob);
  ctx.lineTo(centerX + width * 0.5, centerY + bob - height * 0.2);
  ctx.lineTo(centerX - width * 0.45, centerY + bob - height * 0.2);
  ctx.closePath();
  ctx.fill();
  
  // Deck
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(centerX - width * 0.4, centerY + bob - height * 0.35, width * 0.8, height * 0.2, 1 * scale);
  ctx.fill();
  
  // Mast
  ctx.strokeStyle = '#5c4033';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY + bob - height * 0.3);
  ctx.lineTo(centerX, centerY + bob - height * 1.0);
  ctx.stroke();
  
  // Sail
  ctx.fillStyle = '#f5f5f4';
  ctx.beginPath();
  ctx.moveTo(centerX, centerY + bob - height * 0.4);
  ctx.quadraticCurveTo(centerX + width * 0.35, centerY + bob - height * 0.6, centerX, centerY + bob - height * 0.9);
  ctx.lineTo(centerX, centerY + bob - height * 0.4);
  ctx.fill();
  
  // Flag
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY + bob - height * 1.0);
  ctx.lineTo(centerX + width * 0.15, centerY + bob - height * 0.9);
  ctx.lineTo(centerX, centerY + bob - height * 0.8);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw air unit (plane/helicopter)
 */
function drawAirUnit(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  unit: Unit,
  color: string,
  darkerColor: string,
  lighterColor: string,
  scale: number,
  animPhase: number
): void {
  const width = 14 * scale;
  const height = 10 * scale;
  
  // Floating animation
  const float = Math.sin(animPhase * 3) * 1.5 * scale;
  const tilt = Math.sin(animPhase * 2) * 0.05;
  
  // Shadow on ground
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(centerX, centerY + 8, width * 0.4, height * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.save();
  ctx.translate(centerX, centerY - height * 0.5 + float);
  ctx.rotate(tilt);
  
  // Fuselage
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, width * 0.45, height * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Nose cone
  ctx.fillStyle = darkerColor;
  ctx.beginPath();
  ctx.ellipse(width * 0.4, 0, width * 0.1, height * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Cockpit
  ctx.fillStyle = '#60a5fa';
  ctx.beginPath();
  ctx.ellipse(width * 0.2, -height * 0.08, width * 0.12, height * 0.1, 0, Math.PI * 1.2, Math.PI * 1.8);
  ctx.fill();
  
  // Wings
  ctx.fillStyle = darkerColor;
  ctx.beginPath();
  ctx.moveTo(-width * 0.1, 0);
  ctx.lineTo(-width * 0.15, -height * 0.5);
  ctx.lineTo(width * 0.15, -height * 0.5);
  ctx.lineTo(width * 0.1, 0);
  ctx.closePath();
  ctx.fill();
  
  ctx.beginPath();
  ctx.moveTo(-width * 0.1, 0);
  ctx.lineTo(-width * 0.15, height * 0.5);
  ctx.lineTo(width * 0.15, height * 0.5);
  ctx.lineTo(width * 0.1, 0);
  ctx.closePath();
  ctx.fill();
  
  // Tail
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-width * 0.4, 0);
  ctx.lineTo(-width * 0.5, -height * 0.25);
  ctx.lineTo(-width * 0.35, 0);
  ctx.closePath();
  ctx.fill();
  
  // Engine glow (if moving)
  if (unit.isMoving) {
    ctx.fillStyle = 'rgba(255, 150, 50, 0.5)';
    ctx.beginPath();
    ctx.ellipse(-width * 0.5, 0, width * 0.08, height * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}

/**
 * Draw a RoN unit with pedestrian-like appearance and task activities
 */
export function drawRoNUnit(
  ctx: CanvasRenderingContext2D,
  unit: Unit,
  offsetX: number,
  offsetY: number,
  zoom: number,
  playerColor: string,
  tick: number
): void {
  const { screenX, screenY } = gridToScreen(unit.x, unit.y, offsetX, offsetY);
  
  // Unit center position (adjusted for tile)
  // Note: Canvas context is already scaled, so we don't multiply by zoom here
  const centerX = screenX + TILE_WIDTH / 2;
  const centerY = screenY + TILE_HEIGHT * 0.3;
  
  const stats = UNIT_STATS[unit.type];
  
  // Draw unit based on type
  if (stats.category === 'civilian') {
    drawCitizenUnit(ctx, centerX, centerY, unit, zoom, tick);
  } else {
    drawMilitaryUnit(ctx, centerX, centerY, unit, playerColor, zoom, tick);
  }
  
  // Attack animation effect
  if (unit.isAttacking) {
    const attackAnimPhase = (tick * 0.3) % (Math.PI * 2);
    
    if (stats.category === 'ranged' || stats.category === 'siege') {
      // Ranged/siege units: draw projectile/muzzle flash
      ctx.save();
      
      // Muzzle flash
      const flashSize = 4 + Math.sin(attackAnimPhase) * 2;
      const flashGradient = ctx.createRadialGradient(
        centerX + 3, centerY - 3, 0,
        centerX + 3, centerY - 3, flashSize
      );
      flashGradient.addColorStop(0, 'rgba(255, 255, 200, 0.9)');
      flashGradient.addColorStop(0.3, 'rgba(255, 200, 50, 0.7)');
      flashGradient.addColorStop(1, 'rgba(255, 100, 0, 0)');
      ctx.fillStyle = flashGradient;
      ctx.beginPath();
      ctx.arc(centerX + 3, centerY - 3, flashSize, 0, Math.PI * 2);
      ctx.fill();
      
      // Projectile trail (for siege)
      if (stats.category === 'siege' && unit.taskTarget && typeof unit.taskTarget === 'object') {
        const target = unit.taskTarget as { x: number; y: number };
        const dx = target.x - unit.x;
        const dy = target.y - unit.y;
        const angle = Math.atan2(dy, dx);
        const trailLength = 8;
        
        ctx.strokeStyle = 'rgba(255, 150, 50, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - 4);
        ctx.lineTo(
          centerX + Math.cos(angle) * trailLength,
          centerY - 4 + Math.sin(angle) * trailLength * 0.5
        );
        ctx.stroke();
      }
      
      ctx.restore();
    } else {
      // Melee units: draw attack spark/slash
      ctx.save();
      
      const sparkAngle = attackAnimPhase * 2;
      const sparkRadius = 5;
      
      // Slash effect
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(centerX + 2, centerY - 2, sparkRadius, sparkAngle - 0.5, sparkAngle + 0.5);
      ctx.stroke();
      
      // Impact sparks
      ctx.fillStyle = 'rgba(255, 220, 100, 0.7)';
      for (let i = 0; i < 3; i++) {
        const particleAngle = sparkAngle + i * 0.4;
        const px = centerX + 2 + Math.cos(particleAngle) * (sparkRadius + 2);
        const py = centerY - 2 + Math.sin(particleAngle) * (sparkRadius + 2) * 0.5;
        ctx.beginPath();
        ctx.arc(px, py, 1, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.restore();
    }
  }
  
  // Selection ring
  if (unit.isSelected) {
    const ringRadius = 5;
    
    // White ring
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Green glow
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, ringRadius + 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // Health bar if damaged
  const healthPercent = unit.health / unit.maxHealth;
  if (healthPercent < 1) {
    const barWidth = 10;
    const barHeight = 2;
    const barX = centerX - barWidth / 2;
    const barY = centerY - 12;
    
    // Background
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    // Health fill
    ctx.fillStyle = healthPercent > 0.5 ? '#22c55e' : healthPercent > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
    
    // Border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
  }
}

/**
 * Get the screen position of a unit for hit testing
 */
export function getUnitScreenPosition(
  unit: Unit,
  offsetX: number,
  offsetY: number,
  zoom: number
): { centerX: number; centerY: number; radius: number } {
  const { screenX, screenY } = gridToScreen(unit.x, unit.y, offsetX, offsetY);
  
  return {
    centerX: (screenX + TILE_WIDTH / 2) * zoom,
    centerY: (screenY + TILE_HEIGHT * 0.3) * zoom,
    radius: 10 * zoom,
  };
}
