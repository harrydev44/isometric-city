import React, { useCallback, useRef } from 'react';
import { Train, CarDirection, WorldRenderState, TILE_WIDTH, TILE_HEIGHT } from './types';
import { TRAIN_COLORS } from './constants';
import { isRailTile, getRailDirectionOptions, findPathOnRails, getDirectionToTile, gridToScreen } from './utils';
import { findRailStations } from './gridFinders';
import { BuildingType, Tile } from '@/types/game';
import { DIRECTION_META } from './constants';

export interface TrainSystemRefs {
  trainsRef: React.MutableRefObject<Train[]>;
  trainIdRef: React.MutableRefObject<number>;
  trainSpawnTimerRef: React.MutableRefObject<number>;
}

export interface TrainSystemState {
  worldStateRef: React.MutableRefObject<WorldRenderState>;
  isMobile: boolean;
}

export function useTrainSystem(
  refs: TrainSystemRefs,
  systemState: TrainSystemState
) {
  const {
    trainsRef,
    trainIdRef,
    trainSpawnTimerRef,
  } = refs;

  const { worldStateRef, isMobile } = systemState;

  const findRailStationsCallback = useCallback((): { x: number; y: number }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findRailStations(currentGrid, currentGridSize);
  }, [worldStateRef]);

  const spawnTrain = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return false;
    
    const stations = findRailStationsCallback();
    if (stations.length < 2) {
      return false; // Need at least 2 stations
    }
    
    // Pick random origin and destination stations
    const originIdx = Math.floor(Math.random() * stations.length);
    let destIdx = Math.floor(Math.random() * stations.length);
    // Make sure destination is different from origin
    while (destIdx === originIdx && stations.length > 1) {
      destIdx = Math.floor(Math.random() * stations.length);
    }
    
    const origin = stations[originIdx];
    const dest = stations[destIdx];
    
    const path = findPathOnRails(currentGrid, currentGridSize, origin.x, origin.y, dest.x, dest.y);
    if (!path || path.length === 0) {
      return false;
    }
    
    const startTile = path[0];
    
    let direction: CarDirection = 'south';
    if (path.length >= 2) {
      const nextTile = path[1];
      const dir = getDirectionToTile(startTile.x, startTile.y, nextTile.x, nextTile.y);
      if (dir) direction = dir;
    }
    
    trainsRef.current.push({
      id: trainIdRef.current++,
      tileX: startTile.x,
      tileY: startTile.y,
      direction,
      progress: Math.random() * 0.5,
      speed: 0.25 + Math.random() * 0.15, // Slower than cars
      age: 0,
      maxAge: 3600 + Math.random() * 1800, // Longer lifespan
      color: TRAIN_COLORS[Math.floor(Math.random() * TRAIN_COLORS.length)],
      cars: 2 + Math.floor(Math.random() * 3), // 2-4 cars
      stationX: origin.x,
      stationY: origin.y,
      destStationX: dest.x,
      destStationY: dest.y,
      path,
      pathIndex: 0,
    });
    
    return true;
  }, [worldStateRef, findRailStationsCallback, trainsRef, trainIdRef]);

  const updateTrains = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) {
      trainsRef.current = [];
      return;
    }
    
    const speedMultiplier = currentSpeed === 0 ? 0 : currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2.5 : 4;
    
    const baseMaxTrains = 20;
    const maxTrains = Math.min(baseMaxTrains, Math.max(2, Math.floor(currentGridSize / 10)));
    trainSpawnTimerRef.current -= delta;
    if (trainsRef.current.length < maxTrains && trainSpawnTimerRef.current <= 0) {
      if (spawnTrain()) {
        trainSpawnTimerRef.current = 5 + Math.random() * 5; // Spawn less frequently than cars
      } else {
        trainSpawnTimerRef.current = 2;
      }
    }
    
    const updatedTrains: Train[] = [];
    
    for (const train of [...trainsRef.current]) {
      let alive = true;
      
      train.age += delta;
      if (train.age > train.maxAge) {
        continue;
      }
      
      if (!isRailTile(currentGrid, currentGridSize, train.tileX, train.tileY)) {
        continue;
      }
      
      train.progress += train.speed * delta * speedMultiplier;
      
      let guard = 0;
      while (train.progress >= 1 && guard < 4) {
        guard++;
        
        // Check if we've reached the destination station
        if (train.pathIndex >= train.path.length - 1) {
          // Reached destination, spawn a new train from this station to another
          const stations = findRailStationsCallback();
          if (stations.length >= 2) {
            const currentStation = stations.find(s => 
              Math.abs(s.x - train.destStationX) <= 1 && Math.abs(s.y - train.destStationY) <= 1
            );
            if (currentStation) {
              let newDestIdx = Math.floor(Math.random() * stations.length);
              const currentStationIdx = stations.findIndex(s => 
                s.x === currentStation.x && s.y === currentStation.y
              );
              while (newDestIdx === currentStationIdx && stations.length > 1) {
                newDestIdx = Math.floor(Math.random() * stations.length);
              }
              
              const newDest = stations[newDestIdx];
              const newPath = findPathOnRails(
                currentGrid, currentGridSize,
                currentStation.x, currentStation.y,
                newDest.x, newDest.y
              );
              
              if (newPath && newPath.length > 0) {
                train.stationX = currentStation.x;
                train.stationY = currentStation.y;
                train.destStationX = newDest.x;
                train.destStationY = newDest.y;
                train.path = newPath;
                train.pathIndex = 0;
                train.progress = 0;
                train.tileX = newPath[0].x;
                train.tileY = newPath[0].y;
                if (newPath.length > 1) {
                  const nextTile = newPath[1];
                  const dir = getDirectionToTile(newPath[0].x, newPath[0].y, nextTile.x, nextTile.y);
                  if (dir) train.direction = dir;
                }
                break;
              }
            }
          }
          alive = false;
          break;
        }
        
        train.pathIndex++;
        train.progress -= 1;
        
        const currentTile = train.path[train.pathIndex];
        
        if (currentTile.x < 0 || currentTile.x >= currentGridSize || 
            currentTile.y < 0 || currentTile.y >= currentGridSize) {
          alive = false;
          break;
        }
        
        train.tileX = currentTile.x;
        train.tileY = currentTile.y;
        
        if (train.pathIndex + 1 < train.path.length) {
          const nextTile = train.path[train.pathIndex + 1];
          const dir = getDirectionToTile(train.tileX, train.tileY, nextTile.x, nextTile.y);
          if (dir) train.direction = dir;
        }
      }
      
      if (alive) {
        updatedTrains.push(train);
      }
    }
    
    trainsRef.current = updatedTrains;
  }, [worldStateRef, trainsRef, trainSpawnTimerRef, spawnTrain, findRailStationsCallback]);

  const drawTrains = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!currentGrid || currentGridSize <= 0 || trainsRef.current.length === 0) {
      return;
    }
    
    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);
    
    const viewWidth = canvas.width / (dpr * currentZoom);
    const viewHeight = canvas.height / (dpr * currentZoom);
    const viewLeft = -currentOffset.x / currentZoom - TILE_WIDTH;
    const viewTop = -currentOffset.y / currentZoom - TILE_HEIGHT * 2;
    const viewRight = viewWidth - currentOffset.x / currentZoom + TILE_WIDTH;
    const viewBottom = viewHeight - currentOffset.y / currentZoom + TILE_HEIGHT * 2;
    
    const isTrainBehindBuilding = (trainTileX: number, trainTileY: number): boolean => {
      const trainDepth = trainTileX + trainTileY;
      
      for (let dy = 0; dy <= 1; dy++) {
        for (let dx = 0; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          
          const checkX = trainTileX + dx;
          const checkY = trainTileY + dy;
          
          if (checkX < 0 || checkY < 0 || checkX >= currentGridSize || checkY >= currentGridSize) {
            continue;
          }
          
          const tile = currentGrid[checkY]?.[checkX];
          if (!tile) continue;
          
          const buildingType = tile.building.type;
          
          const skipTypes: BuildingType[] = ['road', 'rail', 'grass', 'empty', 'water', 'tree'];
          if (skipTypes.includes(buildingType)) {
            continue;
          }
          
          const buildingDepth = checkX + checkY;
          
          if (buildingDepth > trainDepth) {
            return true;
          }
        }
      }
      
      return false;
    };
    
    trainsRef.current.forEach(train => {
      const { screenX, screenY } = gridToScreen(train.tileX, train.tileY, 0, 0);
      const centerX = screenX + TILE_WIDTH / 2;
      const centerY = screenY + TILE_HEIGHT / 2;
      const meta = DIRECTION_META[train.direction];
      const trainX = centerX + meta.vec.dx * train.progress;
      const trainY = centerY + meta.vec.dy * train.progress;
      
      if (trainX < viewLeft - 60 || trainX > viewRight + 60 || trainY < viewTop - 80 || trainY > viewBottom + 80) {
        return;
      }
      
      if (isTrainBehindBuilding(train.tileX, train.tileY)) {
        return;
      }
      
      ctx.save();
      ctx.translate(trainX, trainY);
      ctx.rotate(meta.angle);
      
      const scale = 0.7;
      const carLength = 18;
      const carWidth = 8;
      const carSpacing = 2;
      
      // Draw train cars
      for (let i = 0; i < train.cars; i++) {
        const carOffset = i * (carLength + carSpacing);
        
        // Train car body
        ctx.fillStyle = train.color;
        ctx.beginPath();
        ctx.moveTo(-carLength * scale + carOffset * scale, -carWidth * scale);
        ctx.lineTo(carLength * scale + carOffset * scale, -carWidth * scale);
        ctx.lineTo((carLength + 2) * scale + carOffset * scale, 0);
        ctx.lineTo(carLength * scale + carOffset * scale, carWidth * scale);
        ctx.lineTo(-carLength * scale + carOffset * scale, carWidth * scale);
        ctx.closePath();
        ctx.fill();
        
        // Windows
        ctx.fillStyle = 'rgba(200, 220, 255, 0.6)';
        ctx.fillRect((-carLength + 4) * scale + carOffset * scale, -carWidth * 0.6 * scale, 
                     carLength * 0.6 * scale, carWidth * 1.2 * scale);
        
        // Wheels
        ctx.fillStyle = '#1f2937';
        const wheelY = carWidth * scale;
        ctx.fillRect((-carLength + 6) * scale + carOffset * scale, wheelY - 1, 3 * scale, 2);
        ctx.fillRect((carLength - 9) * scale + carOffset * scale, wheelY - 1, 3 * scale, 2);
      }
      
      ctx.restore();
    });
    
    ctx.restore();
  }, [worldStateRef, trainsRef]);

  return {
    spawnTrain,
    updateTrains,
    drawTrains,
  };
}
