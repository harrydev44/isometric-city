/**
 * Shared game rendering utilities
 * 
 * This module exports common isometric rendering functionality
 * that can be used across different games.
 */

export * from './isometricRenderer';
export * from './SpeedControl';

// Re-export beach drawing from drawing.ts for shared use
export { drawBeachOnWater, BEACH_COLORS } from '../drawing';
