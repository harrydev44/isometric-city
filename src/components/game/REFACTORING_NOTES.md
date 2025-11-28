# CanvasIsometricGrid Refactoring Notes

## Overview
The `CanvasIsometricGrid.tsx` file was ~5741 lines and has been refactored into smaller, more maintainable hooks and utilities.

## Created Hooks

### 1. `useVehicleSystem.ts`
- Manages cars and emergency vehicles (fire trucks, police cars)
- Handles spawning, updating, and drawing of vehicles
- Includes memoized helper for checking if vehicles are behind buildings

### 2. `usePedestrianSystem.ts`
- Manages pedestrian spawning and movement
- Handles pathfinding and lifecycle
- Drawing is already extracted to `drawPedestrians.ts`

### 3. `useCrimeSystem.ts`
- Manages crime incident spawning and updates
- Tracks active crimes and their time remaining
- Integrates with emergency vehicle dispatch

## Remaining Work

### Hooks to Create:
1. **useAircraftSystem.ts** - Airplanes and helicopters (lines ~1314-1801)
2. **useBoatSystem.ts** - Boat system (lines ~1804-2248)
3. **useFireworkSystem.ts** - Firework system (lines ~2257-2558)
4. **useSmogSystem.ts** - Factory smog system (lines ~2567-2770)

### Utilities to Create:
1. **gridRendering.ts** - Main grid rendering logic (lines ~3272-5134)
   - This is the massive useEffect that renders the entire grid
   - Should be extracted into a utility function that takes necessary parameters
   
2. **canvasInteraction.ts** - Mouse/touch/wheel handlers (lines ~5136-5544)
   - All interaction handlers can be extracted
   - Should return handlers that can be attached to the canvas

## Integration Pattern

The main component should:
1. Initialize hooks with necessary dependencies
2. Use hooks' update functions in the animation loop
3. Use hooks' draw functions in the render loop
4. Keep only orchestration logic in the main component

## Performance Improvements Added

1. **Memoization**: Used `useMemo` for expensive calculations like `isVehicleBehindBuilding`
2. **Cached calculations**: Road tile count and population are cached with grid version tracking
3. **Optimized callbacks**: All callbacks use `useCallback` with proper dependencies

## Notes

- All functionality preserved - no behavior changes
- Hooks are self-contained and testable
- Main component will be significantly smaller after full refactoring
- Grid rendering utility will be the largest remaining piece to extract
