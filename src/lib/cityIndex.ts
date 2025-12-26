import { Tile } from '@/types/game';

export type CityBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type CityAggregate = {
  cityId: string;
  /** Number of tiles whose Building is assigned to this cityId. */
  tileCount: number;
  /** Number of “meaningful” (non-empty/grass/water) building tiles. */
  placedCount: number;
  population: number;
  jobs: number;
  bounds: CityBounds | null;
};

const NON_PLACED_TYPES = new Set<string>(['grass', 'water', 'empty']);

/**
 * Build a cheap per-city aggregate index from the grid.
 *
 * This is intentionally O(n²) but designed to be:
 * - **cacheable**: call it once per grid version and reuse
 * - **allocation-light**: uses a Map and mutates aggregates in place
 */
export function buildCityAggregateIndex(grid: Tile[][], gridSize: number): Map<string, CityAggregate> {
  const byCity = new Map<string, CityAggregate>();

  for (let y = 0; y < gridSize; y++) {
    const row = grid[y];
    for (let x = 0; x < gridSize; x++) {
      const tile = row[x];
      const cityId = tile.building.cityId || 'unassigned';

      let agg = byCity.get(cityId);
      if (!agg) {
        agg = {
          cityId,
          tileCount: 0,
          placedCount: 0,
          population: 0,
          jobs: 0,
          bounds: null,
        };
        byCity.set(cityId, agg);
      }

      agg.tileCount++;

      if (!agg.bounds) {
        agg.bounds = { minX: x, minY: y, maxX: x, maxY: y };
      } else {
        if (x < agg.bounds.minX) agg.bounds.minX = x;
        if (y < agg.bounds.minY) agg.bounds.minY = y;
        if (x > agg.bounds.maxX) agg.bounds.maxX = x;
        if (y > agg.bounds.maxY) agg.bounds.maxY = y;
      }

      const buildingType = tile.building.type;
      if (!NON_PLACED_TYPES.has(buildingType)) {
        agg.placedCount++;
      }
      agg.population += tile.building.population || 0;
      agg.jobs += tile.building.jobs || 0;
    }
  }

  return byCity;
}

