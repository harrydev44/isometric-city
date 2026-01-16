import { CoasterParkState, CoasterTile, Finance, ParkStats, Research, WeatherState } from '@/games/coaster/types';

export const DEFAULT_COASTER_GRID_SIZE = 50;

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function createInitialGrid(size: number): CoasterTile[][] {
  const grid: CoasterTile[][] = [];
  for (let y = 0; y < size; y++) {
    const row: CoasterTile[] = [];
    for (let x = 0; x < size; x++) {
      row.push({
        x,
        y,
        terrain: 'grass',
        height: 0,
        path: null,
        building: null,
        track: null,
        scenery: null,
        zoneId: null,
      });
    }
    grid.push(row);
  }
  return grid;
}

function createDefaultStats(): ParkStats {
  return {
    guestsInPark: 0,
    totalGuests: 0,
    rating: 550,
    cleanliness: 80,
    excitement: 40,
    nausea: 0,
  };
}

function createDefaultFinance(): Finance {
  return {
    cash: 12000,
    loan: 0,
    loanInterestRate: 0.04,
    entranceFee: 10,
    income: 0,
    expenses: 0,
    rideRevenue: 0,
    shopRevenue: 0,
    staffCost: 0,
    maintenanceCost: 0,
    researchCost: 0,
    transactions: [],
  };
}

function createDefaultResearch(): Research {
  return {
    activeResearchId: null,
    funding: 0.2,
    items: [],
  };
}

function createDefaultWeather(): WeatherState {
  return {
    type: 'sunny',
    temperature: 22,
    rainLevel: 0,
    windSpeed: 5,
  };
}

export function createInitialCoasterState(
  size: number = DEFAULT_COASTER_GRID_SIZE,
  parkName: string = 'Coaster Park'
): CoasterParkState {
  const entranceX = Math.floor(size / 2);
  const entranceY = size - 2;

  return {
    id: generateUUID(),
    parkName,
    grid: createInitialGrid(size),
    gridSize: size,
    year: 1,
    month: 1,
    day: 1,
    hour: 9,
    tick: 0,
    speed: 1,
    selectedTool: 'select',
    stats: createDefaultStats(),
    finance: createDefaultFinance(),
    rides: [],
    guests: [],
    staff: [],
    research: createDefaultResearch(),
    weather: createDefaultWeather(),
    activePanel: 'none',
    parkEntrance: { x: entranceX, y: entranceY },
    parkExit: { x: entranceX, y: entranceY + 1 < size ? entranceY + 1 : entranceY },
    gameVersion: 0,
  };
}

export function simulateCoasterTick(state: CoasterParkState): CoasterParkState {
  const nextTick = state.tick + 1;
  let { hour, day, month, year } = state;

  if (nextTick % 60 === 0) {
    hour = (hour + 1) % 24;
    if (hour === 0) {
      day += 1;
      if (day > 30) {
        day = 1;
        month += 1;
        if (month > 12) {
          month = 1;
          year += 1;
        }
      }
    }
  }

  return {
    ...state,
    tick: nextTick,
    hour,
    day,
    month,
    year,
  };
}
