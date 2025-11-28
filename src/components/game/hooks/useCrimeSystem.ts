import { useRef, useCallback } from 'react';
import { WorldRenderState } from '@/components/game/types';

interface UseCrimeSystemProps {
  worldStateRef: React.MutableRefObject<WorldRenderState>;
  policeService: number[][];
  population: number;
  activeCrimesRef: React.MutableRefObject<Set<string>>;
}

export function useCrimeSystem({
  worldStateRef,
  policeService,
  population,
  activeCrimesRef,
}: UseCrimeSystemProps) {
  const activeCrimeIncidentsRef = useRef<Map<string, { x: number; y: number; type: 'robbery' | 'burglary' | 'disturbance' | 'traffic'; timeRemaining: number }>>(new Map());
  const crimeSpawnTimerRef = useRef(0);

  const spawnCrimeIncidents = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) return;
    
    const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2 : 3;
    crimeSpawnTimerRef.current -= delta * speedMultiplier;
    
    if (crimeSpawnTimerRef.current > 0) return;
    crimeSpawnTimerRef.current = 3 + Math.random() * 2;
    
    const eligibleTiles: { x: number; y: number; policeCoverage: number }[] = [];
    
    for (let y = 0; y < currentGridSize; y++) {
      for (let x = 0; x < currentGridSize; x++) {
        const tile = currentGrid[y][x];
        const isBuilding = tile.building.type !== 'grass' && 
            tile.building.type !== 'water' && 
            tile.building.type !== 'road' && 
            tile.building.type !== 'tree' &&
            tile.building.type !== 'empty';
        const hasActivity = tile.building.population > 0 || tile.building.jobs > 0;
        
        if (isBuilding && hasActivity) {
          const policeCoverage = policeService[y]?.[x] || 0;
          eligibleTiles.push({ x, y, policeCoverage });
        }
      }
    }
    
    if (eligibleTiles.length === 0) return;
    
    const avgCoverage = eligibleTiles.reduce((sum, t) => sum + t.policeCoverage, 0) / eligibleTiles.length;
    const baseChance = avgCoverage < 20 ? 0.4 : avgCoverage < 40 ? 0.25 : avgCoverage < 60 ? 0.15 : 0.08;
    
    const maxActiveCrimes = Math.max(2, Math.floor(population / 500));
    
    if (activeCrimeIncidentsRef.current.size >= maxActiveCrimes) return;
    
    const crimesToSpawn = Math.random() < 0.3 ? 2 : 1;
    
    for (let i = 0; i < crimesToSpawn; i++) {
      if (activeCrimeIncidentsRef.current.size >= maxActiveCrimes) break;
      if (Math.random() > baseChance) continue;
      
      const weightedTiles = eligibleTiles.filter(t => {
        const key = `${t.x},${t.y}`;
        if (activeCrimeIncidentsRef.current.has(key)) return false;
        const weight = Math.max(0.1, 1 - t.policeCoverage / 100);
        return Math.random() < weight;
      });
      
      if (weightedTiles.length === 0) continue;
      
      const target = weightedTiles[Math.floor(Math.random() * weightedTiles.length)];
      const key = `${target.x},${target.y}`;
      
      const crimeTypes: Array<'robbery' | 'burglary' | 'disturbance' | 'traffic'> = ['robbery', 'burglary', 'disturbance', 'traffic'];
      const crimeType = crimeTypes[Math.floor(Math.random() * crimeTypes.length)];
      const duration = crimeType === 'traffic' ? 15 : crimeType === 'disturbance' ? 20 : 30;
      
      activeCrimeIncidentsRef.current.set(key, {
        x: target.x,
        y: target.y,
        type: crimeType,
        timeRemaining: duration,
      });
    }
  }, [policeService, population]);

  const updateCrimeIncidents = useCallback((delta: number) => {
    const { speed: currentSpeed } = worldStateRef.current;
    if (currentSpeed === 0) return;
    
    const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2 : 3;
    const keysToDelete: string[] = [];
    
    activeCrimeIncidentsRef.current.forEach((crime, key) => {
      // If police car is responding, don't decay
      if (activeCrimesRef.current.has(key)) return;
      
      const newTimeRemaining = crime.timeRemaining - delta * speedMultiplier;
      if (newTimeRemaining <= 0) {
        keysToDelete.push(key);
      } else {
        activeCrimeIncidentsRef.current.set(key, { ...crime, timeRemaining: newTimeRemaining });
      }
    });
    
    keysToDelete.forEach(key => activeCrimeIncidentsRef.current.delete(key));
  }, [activeCrimesRef]);

  const findCrimeIncidents = useCallback((): { x: number; y: number }[] => {
    return Array.from(activeCrimeIncidentsRef.current.values()).map(c => ({ x: c.x, y: c.y }));
  }, []);

  return {
    activeCrimeIncidentsRef,
    spawnCrimeIncidents,
    updateCrimeIncidents,
    findCrimeIncidents,
  };
}
