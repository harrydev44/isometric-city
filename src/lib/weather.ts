import { Season, WeatherState, WeatherType, WeatherEconomicEffect, Stats } from '@/types/game';

const MONTH_TO_SEASON: Record<number, Season> = {
  1: 'winter',
  2: 'winter',
  3: 'spring',
  4: 'spring',
  5: 'spring',
  6: 'summer',
  7: 'summer',
  8: 'summer',
  9: 'fall',
  10: 'fall',
  11: 'fall',
  12: 'winter',
};

const SEASON_CONFIG: Record<Season, {
  temperatureRange: [number, number];
  humidityRange: [number, number];
  windRange: [number, number];
  dayLengthRange: [number, number];
  weatherWeights: Array<{ type: WeatherType; weight: number }>;
}> = {
  winter: {
    temperatureRange: [-15, 6],
    humidityRange: [0.35, 0.75],
    windRange: [8, 28],
    dayLengthRange: [7.5, 9],
    weatherWeights: [
      { type: 'snow', weight: 5 },
      { type: 'clear', weight: 2.5 },
      { type: 'rain', weight: 1.5 },
      { type: 'lightning', weight: 0.4 },
      { type: 'heat', weight: 0 },
    ],
  },
  spring: {
    temperatureRange: [3, 20],
    humidityRange: [0.45, 0.8],
    windRange: [6, 22],
    dayLengthRange: [11, 13.5],
    weatherWeights: [
      { type: 'rain', weight: 4 },
      { type: 'clear', weight: 3 },
      { type: 'lightning', weight: 1.2 },
      { type: 'snow', weight: 0.6 },
      { type: 'heat', weight: 0.4 },
    ],
  },
  summer: {
    temperatureRange: [18, 34],
    humidityRange: [0.35, 0.85],
    windRange: [4, 18],
    dayLengthRange: [14.5, 16.2],
    weatherWeights: [
      { type: 'clear', weight: 4 },
      { type: 'heat', weight: 3.5 },
      { type: 'rain', weight: 2 },
      { type: 'lightning', weight: 1.5 },
      { type: 'snow', weight: 0 },
    ],
  },
  fall: {
    temperatureRange: [5, 20],
    humidityRange: [0.4, 0.85],
    windRange: [6, 24],
    dayLengthRange: [10, 12],
    weatherWeights: [
      { type: 'rain', weight: 3.5 },
      { type: 'clear', weight: 2.5 },
      { type: 'snow', weight: 1.5 },
      { type: 'lightning', weight: 0.8 },
      { type: 'heat', weight: 0.2 },
    ],
  },
};

const WEATHER_DESCRIPTIONS: Record<WeatherType, string[]> = {
  clear: ['Clear skies', 'Crisp sunshine', 'Mild bluebird day', 'Calm and bright'],
  rain: ['Steady rain', 'Passing showers', 'Cool drizzle', 'Moody rain bands'],
  snow: ['Soft snowfall', 'Snow showers', 'Blowing snow', 'Heavy snow band'],
  lightning: ['Thunderstorms', 'Electrical storm', 'Intense lightning cells', 'Rolling thunderheads'],
  heat: ['Heatwave', 'Humid heat surge', 'Dry heat dome', 'Long hot spell'],
};

const WEATHER_TEMP_SHIFT: Record<WeatherType, number> = {
  clear: 1.5,
  rain: -1,
  snow: -6,
  lightning: -2,
  heat: 6,
};

const WEATHER_CLOUD_BASE: Record<WeatherType, number> = {
  clear: 0.2,
  rain: 0.75,
  snow: 0.8,
  lightning: 0.95,
  heat: 0.4,
};

const WEATHER_PRECIP_BASE: Record<WeatherType, number> = {
  clear: 0,
  rain: 0.6,
  snow: 0.5,
  lightning: 0.7,
  heat: 0,
};

const WEATHER_ECONOMIC_EFFECTS: Record<WeatherType, (intensity: number) => WeatherEconomicEffect> = {
  clear: (intensity) => ({
    incomeMultiplier: 1 + intensity * 0.01,
    expenseMultiplier: 1,
    happinessDelta: 2,
    demand: { residential: 1, commercial: 1, industrial: 1 },
  }),
  rain: (intensity) => ({
    incomeMultiplier: 0.99 - intensity * 0.02,
    expenseMultiplier: 1 + intensity * 0.01,
    happinessDelta: -1,
    demand: { residential: 1, commercial: -2, industrial: -1 },
  }),
  snow: (intensity) => ({
    incomeMultiplier: 0.98 - intensity * 0.03,
    expenseMultiplier: 1 + intensity * 0.025,
    happinessDelta: -2,
    demand: { residential: 1, commercial: -2, industrial: -2 },
  }),
  lightning: (intensity) => ({
    incomeMultiplier: 0.97 - intensity * 0.02,
    expenseMultiplier: 1 + intensity * 0.03,
    happinessDelta: -3,
    demand: { residential: 0, commercial: -3, industrial: -2 },
  }),
  heat: (intensity) => ({
    incomeMultiplier: 0.99 - intensity * 0.015,
    expenseMultiplier: 1 + intensity * 0.02,
    happinessDelta: -1,
    demand: { residential: -1, commercial: -1, industrial: -2 },
  }),
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pickWeatherType(season: Season, previousType?: WeatherType): WeatherType {
  const weights = SEASON_CONFIG[season].weatherWeights;
  const stickiness = previousType && previousType !== 'clear' ? 1.1 : 1;
  let total = 0;
  for (const { type, weight } of weights) {
    const adjusted = type === previousType ? weight * stickiness : weight;
    total += adjusted;
  }
  const target = Math.random() * total;
  let cumulative = 0;
  for (const { type, weight } of weights) {
    const adjusted = type === previousType ? weight * stickiness : weight;
    cumulative += adjusted;
    if (target <= cumulative) {
      return type;
    }
  }
  return weights[0].type;
}

function buildDescription(type: WeatherType, season: Season, intensity: number): string {
  const phrases = WEATHER_DESCRIPTIONS[type];
  const base = phrases[Math.floor(Math.random() * phrases.length)];
  const qualifier = intensity > 0.75 ? 'intense' : intensity > 0.5 ? 'steady' : 'light';
  const seasonLabel = season === 'fall' ? 'autumn' : season;
  if (type === 'clear') {
    return `${base} • ${seasonLabel.toUpperCase()}`;
  }
  return `${qualifier} ${base.toLowerCase()}`;
}

function computeSnowAccumulation(previous: WeatherState | undefined, type: WeatherType, intensity: number, season: Season): number {
  const current = previous?.snowAccumulation ?? (season === 'winter' ? 0.3 : 0);
  if (type === 'snow') {
    return clamp(current * 0.65 + intensity * 0.55, 0, 1);
  }
  const meltRate = type === 'clear' ? 0.3 : type === 'rain' ? 0.4 : type === 'heat' ? 0.6 : 0.2;
  return clamp(current * (1 - meltRate), 0, 1);
}

function computeDayLength(season: Season, type: WeatherType, intensity: number): number {
  const [min, max] = SEASON_CONFIG[season].dayLengthRange;
  let hours = randomBetween(min, max);
  if (type === 'snow' || type === 'rain') {
    hours -= intensity * 0.6;
  } else if (type === 'lightning') {
    hours -= 0.5;
  } else if (type === 'heat') {
    hours += intensity * 0.4;
  }
  return clamp(hours, 6.5, 17);
}

function computeLightningFrequency(type: WeatherType, intensity: number): number {
  if (type !== 'lightning') return 0;
  return clamp(0.3 + intensity * 0.6, 0, 1);
}

function createEconomicEffect(type: WeatherType, intensity: number): WeatherEconomicEffect {
  const factory = WEATHER_ECONOMIC_EFFECTS[type];
  return factory ? factory(intensity) : WEATHER_ECONOMIC_EFFECTS.clear(intensity);
}

export function getSeasonForMonth(month: number): Season {
  return MONTH_TO_SEASON[clamp(Math.floor(month), 1, 12)];
}

export function generateWeatherState(year: number, month: number, day: number, previous?: WeatherState): WeatherState {
  const season = getSeasonForMonth(month);
  const type = pickWeatherType(season, previous?.type);
  const isCalm = type === 'clear';
  const intensity = isCalm ? clamp(Math.random() * 0.4, 0, 1) : clamp(0.45 + Math.random() * 0.55, 0, 1);
  const config = SEASON_CONFIG[season];
  const temperatureBase = randomBetween(...config.temperatureRange) + (WEATHER_TEMP_SHIFT[type] || 0);
  const temperature = temperatureBase + (Math.random() - 0.5) * 2;
  const humidity = clamp(randomBetween(...config.humidityRange) + (type === 'heat' ? 0.1 : 0), 0, 1);
  const windSpeedKph = randomBetween(...config.windRange) + (type === 'lightning' ? 5 : 0);
  const cloudCover = clamp(WEATHER_CLOUD_BASE[type] + intensity * 0.2, 0, 1);
  const precipitationRate = clamp(WEATHER_PRECIP_BASE[type] * intensity, 0, 1);
  const snowAccumulation = computeSnowAccumulation(previous, type, intensity, season);
  const dayLengthHours = computeDayLength(season, type, intensity);
  const description = buildDescription(type, season, intensity);
  const lightningFrequency = computeLightningFrequency(type, intensity);
  const economic = createEconomicEffect(type, intensity);

  return {
    year,
    month,
    day,
    season,
    type,
    description,
    intensity,
    temperatureC: Math.round(temperature * 10) / 10,
    humidity,
    cloudCover,
    windSpeedKph,
    precipitationRate,
    lightningFrequency,
    snowAccumulation,
    dayLengthHours,
    economic,
  };
}

export function updateWeatherState(previous: WeatherState | undefined, date: { year: number; month: number; day: number }): WeatherState {
  if (!previous) {
    return generateWeatherState(date.year, date.month, date.day);
  }

  const sameDate = previous.year === date.year && previous.month === date.month && previous.day === date.day;
  if (sameDate) {
    return previous;
  }

  const advancingByOne = date.year === previous.year && date.month === previous.month && date.day === previous.day + 1;
  const rollingSeason = getSeasonForMonth(date.month) === getSeasonForMonth(previous.month);
  const canPersistStorm = previous.type !== 'clear' && (advancingByOne || rollingSeason) && Math.random() < 0.4;

  if (canPersistStorm) {
    return {
      ...previous,
      year: date.year,
      month: date.month,
      day: date.day,
      intensity: clamp(previous.intensity + (Math.random() - 0.5) * 0.2, 0.3, 1),
      cloudCover: clamp(previous.cloudCover + (Math.random() - 0.5) * 0.1, 0, 1),
      precipitationRate: clamp(previous.precipitationRate + (Math.random() - 0.5) * 0.2, 0, 1),
      snowAccumulation: computeSnowAccumulation(previous, previous.type, previous.intensity, previous.season),
      economic: createEconomicEffect(previous.type, previous.intensity),
    };
  }

  return generateWeatherState(date.year, date.month, date.day, previous);
}

export function applyWeatherEconomicEffects(stats: Stats, weather: WeatherState): Stats {
  const next: Stats = {
    ...stats,
    demand: { ...stats.demand },
  };
  const econ = weather.economic;
  next.income = Math.max(0, Math.round(next.income * econ.incomeMultiplier));
  next.expenses = Math.max(0, Math.round(next.expenses * econ.expenseMultiplier));
  next.happiness = clamp(next.happiness + econ.happinessDelta, 0, 100);
  next.demand.residential = clamp(next.demand.residential + econ.demand.residential, -100, 100);
  next.demand.commercial = clamp(next.demand.commercial + econ.demand.commercial, -100, 100);
  next.demand.industrial = clamp(next.demand.industrial + econ.demand.industrial, -100, 100);
  return next;
}
