/**
 * Game Events System
 *
 * Random events that affect cities: disasters, booms, crises
 * Events trigger randomly each turn and affect city stats
 */

import { AgentCity, AgentCharacter } from '@/types/civilization';

// ============================================================================
// EVENT TYPES
// ============================================================================

export type GameEventType =
  | 'disaster'     // Negative: fire, flood, earthquake
  | 'boom'         // Positive: gold rush, tech boom, tourism
  | 'crisis'       // Global negative: recession, pandemic
  | 'miracle'      // Rare positive: renaissance, golden age
  | 'rivalry'      // Competition between cities
  | 'alliance';    // Character type cooperation

export type GameEventSeverity = 'minor' | 'moderate' | 'major' | 'catastrophic';

export interface GameEvent {
  id: string;
  type: GameEventType;
  name: string;
  description: string;
  emoji: string;
  severity: GameEventSeverity;
  affectedCityIds: number[];
  affectedCharacterTypes?: AgentCharacter[];
  turn: number;
  timestamp: number;
  effects: {
    populationChange?: number;      // Percentage change
    moneyChange?: number;           // Percentage change
    buildingDamage?: number;        // Number of buildings affected
    bonusTurns?: number;            // Turns the effect lasts
  };
}

// ============================================================================
// EVENT DEFINITIONS
// ============================================================================

const DISASTER_EVENTS = [
  {
    name: 'Fire Outbreak',
    emoji: '🔥',
    description: 'A devastating fire sweeps through the city',
    effects: { populationChange: -5, moneyChange: -10, buildingDamage: 2 },
    severity: 'moderate' as GameEventSeverity,
  },
  {
    name: 'Flood',
    emoji: '🌊',
    description: 'Heavy rains cause flooding in low-lying areas',
    effects: { populationChange: -3, moneyChange: -15 },
    severity: 'moderate' as GameEventSeverity,
  },
  {
    name: 'Earthquake',
    emoji: '🌋',
    description: 'A tremor shakes the foundations',
    effects: { populationChange: -8, moneyChange: -20, buildingDamage: 3 },
    severity: 'major' as GameEventSeverity,
  },
  {
    name: 'Power Outage',
    emoji: '💡',
    description: 'The grid fails, causing chaos',
    effects: { populationChange: -2, moneyChange: -5 },
    severity: 'minor' as GameEventSeverity,
  },
  {
    name: 'Industrial Accident',
    emoji: '⚠️',
    description: 'An accident at a factory causes damage',
    effects: { populationChange: -4, moneyChange: -12 },
    severity: 'moderate' as GameEventSeverity,
  },
];

const BOOM_EVENTS = [
  {
    name: 'Tech Boom',
    emoji: '💻',
    description: 'A tech startup brings innovation and jobs',
    effects: { populationChange: 10, moneyChange: 20, bonusTurns: 3 },
    severity: 'major' as GameEventSeverity,
  },
  {
    name: 'Gold Rush',
    emoji: '⛏️',
    description: 'Valuable resources discovered nearby',
    effects: { populationChange: 15, moneyChange: 30 },
    severity: 'major' as GameEventSeverity,
  },
  {
    name: 'Tourism Surge',
    emoji: '🏖️',
    description: 'The city becomes a tourist hotspot',
    effects: { populationChange: 5, moneyChange: 25 },
    severity: 'moderate' as GameEventSeverity,
  },
  {
    name: 'Factory Opens',
    emoji: '🏭',
    description: 'A new factory brings jobs',
    effects: { populationChange: 8, moneyChange: 15 },
    severity: 'moderate' as GameEventSeverity,
  },
  {
    name: 'University Founded',
    emoji: '🎓',
    description: 'Education attracts new residents',
    effects: { populationChange: 12, moneyChange: 10 },
    severity: 'moderate' as GameEventSeverity,
  },
];

const CRISIS_EVENTS = [
  {
    name: 'Recession',
    emoji: '📉',
    description: 'Economic downturn hits all cities',
    effects: { moneyChange: -15 },
    severity: 'major' as GameEventSeverity,
    global: true,
  },
  {
    name: 'Pandemic',
    emoji: '🦠',
    description: 'A disease spreads across the region',
    effects: { populationChange: -10 },
    severity: 'catastrophic' as GameEventSeverity,
    global: true,
  },
  {
    name: 'Market Crash',
    emoji: '💸',
    description: 'Financial markets collapse',
    effects: { moneyChange: -25 },
    severity: 'catastrophic' as GameEventSeverity,
    global: true,
  },
];

const MIRACLE_EVENTS = [
  {
    name: 'Golden Age',
    emoji: '✨',
    description: 'A period of unprecedented prosperity',
    effects: { populationChange: 20, moneyChange: 30, bonusTurns: 5 },
    severity: 'major' as GameEventSeverity,
  },
  {
    name: 'Renaissance',
    emoji: '🎨',
    description: 'Culture and arts flourish',
    effects: { populationChange: 15, moneyChange: 20 },
    severity: 'major' as GameEventSeverity,
  },
  {
    name: 'Trade Agreement',
    emoji: '🤝',
    description: 'A lucrative trade deal is signed',
    effects: { moneyChange: 40 },
    severity: 'major' as GameEventSeverity,
  },
];

// ============================================================================
// EVENT GENERATION
// ============================================================================

/**
 * Generate random events for a turn
 * Returns 0-3 events per turn based on probability
 */
export function generateGameEvents(
  agents: AgentCity[],
  currentTurn: number
): GameEvent[] {
  const events: GameEvent[] = [];

  // No events on first few turns
  if (currentTurn < 3) return events;

  // Base probability of events (increases slightly over time)
  const eventChance = Math.min(0.3, 0.1 + currentTurn * 0.005);

  // Check for disaster (15% when event triggers)
  if (Math.random() < eventChance && Math.random() < 0.15) {
    const disaster = DISASTER_EVENTS[Math.floor(Math.random() * DISASTER_EVENTS.length)];
    const targetCity = agents[Math.floor(Math.random() * agents.length)];

    events.push({
      id: `event-${currentTurn}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'disaster',
      name: disaster.name,
      description: `${disaster.description} in ${targetCity.name}!`,
      emoji: disaster.emoji,
      severity: disaster.severity,
      affectedCityIds: [targetCity.agentId],
      turn: currentTurn,
      timestamp: Date.now(),
      effects: disaster.effects,
    });
  }

  // Check for boom (20% when event triggers)
  if (Math.random() < eventChance && Math.random() < 0.20) {
    const boom = BOOM_EVENTS[Math.floor(Math.random() * BOOM_EVENTS.length)];
    const targetCity = agents[Math.floor(Math.random() * agents.length)];

    events.push({
      id: `event-${currentTurn}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'boom',
      name: boom.name,
      description: `${boom.description} in ${targetCity.name}!`,
      emoji: boom.emoji,
      severity: boom.severity,
      affectedCityIds: [targetCity.agentId],
      turn: currentTurn,
      timestamp: Date.now(),
      effects: boom.effects,
    });
  }

  // Check for crisis (5% - affects multiple cities)
  if (Math.random() < eventChance && Math.random() < 0.05) {
    const crisis = CRISIS_EVENTS[Math.floor(Math.random() * CRISIS_EVENTS.length)];
    // Global events affect top 50 cities
    const affectedIds = agents.slice(0, 50).map(a => a.agentId);

    events.push({
      id: `event-${currentTurn}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'crisis',
      name: crisis.name,
      description: `${crisis.description}`,
      emoji: crisis.emoji,
      severity: crisis.severity,
      affectedCityIds: affectedIds,
      turn: currentTurn,
      timestamp: Date.now(),
      effects: crisis.effects,
    });
  }

  // Check for miracle (2% - very rare)
  if (Math.random() < eventChance && Math.random() < 0.02) {
    const miracle = MIRACLE_EVENTS[Math.floor(Math.random() * MIRACLE_EVENTS.length)];
    const targetCity = agents[Math.floor(Math.random() * agents.length)];

    events.push({
      id: `event-${currentTurn}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'miracle',
      name: miracle.name,
      description: `${miracle.description} in ${targetCity.name}!`,
      emoji: miracle.emoji,
      severity: miracle.severity,
      affectedCityIds: [targetCity.agentId],
      turn: currentTurn,
      timestamp: Date.now(),
      effects: miracle.effects,
    });
  }

  // Check for rivalry between close-ranked cities (10%)
  if (Math.random() < eventChance && Math.random() < 0.10 && agents.length >= 2) {
    const topAgents = [...agents].sort((a, b) => a.rank - b.rank).slice(0, 10);
    const city1 = topAgents[Math.floor(Math.random() * Math.min(5, topAgents.length))];
    const city2 = topAgents[Math.floor(Math.random() * topAgents.length)];

    if (city1.agentId !== city2.agentId) {
      events.push({
        id: `event-${currentTurn}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'rivalry',
        name: 'Heated Rivalry',
        description: `${city1.name} and ${city2.name} are competing fiercely!`,
        emoji: '⚔️',
        severity: 'moderate',
        affectedCityIds: [city1.agentId, city2.agentId],
        turn: currentTurn,
        timestamp: Date.now(),
        effects: { populationChange: 5 }, // Competition drives growth
      });
    }
  }

  return events;
}

/**
 * Apply event effects to cities
 */
export function applyEventEffects(
  agents: AgentCity[],
  events: GameEvent[]
): AgentCity[] {
  if (events.length === 0) return agents;

  return agents.map(agent => {
    const affectingEvents = events.filter(e => e.affectedCityIds.includes(agent.agentId));

    if (affectingEvents.length === 0) return agent;

    let newAgent = { ...agent };
    let performanceChanges = { ...agent.performance };

    for (const event of affectingEvents) {
      const { effects } = event;

      // Apply population change
      if (effects.populationChange) {
        const change = Math.round(performanceChanges.totalPopulation * (effects.populationChange / 100));
        performanceChanges.totalPopulation = Math.max(0, performanceChanges.totalPopulation + change);
      }

      // Apply money change
      if (effects.moneyChange) {
        const change = Math.round(performanceChanges.totalMoney * (effects.moneyChange / 100));
        performanceChanges.totalMoney = Math.max(0, performanceChanges.totalMoney + change);
      }

      // Apply building damage (reduce building count)
      if (effects.buildingDamage) {
        performanceChanges.buildingsPlaced = Math.max(0, performanceChanges.buildingsPlaced - effects.buildingDamage);
      }
    }

    newAgent.performance = performanceChanges;
    return newAgent;
  });
}

// ============================================================================
// ERAS/AGES SYSTEM
// ============================================================================

export type Era = 'ancient' | 'medieval' | 'industrial' | 'modern' | 'future';

export interface EraInfo {
  name: string;
  emoji: string;
  turnThreshold: number;
  description: string;
  color: string;
}

export const ERAS: Record<Era, EraInfo> = {
  ancient: {
    name: 'Ancient Era',
    emoji: '🏛️',
    turnThreshold: 0,
    description: 'The dawn of civilization',
    color: '#8B7355',
  },
  medieval: {
    name: 'Medieval Era',
    emoji: '🏰',
    turnThreshold: 15,
    description: 'Castles and kingdoms rise',
    color: '#4A5568',
  },
  industrial: {
    name: 'Industrial Era',
    emoji: '🏭',
    turnThreshold: 35,
    description: 'The age of machines',
    color: '#744210',
  },
  modern: {
    name: 'Modern Era',
    emoji: '🏙️',
    turnThreshold: 60,
    description: 'Skyscrapers touch the sky',
    color: '#2B6CB0',
  },
  future: {
    name: 'Future Era',
    emoji: '🚀',
    turnThreshold: 100,
    description: 'Technology beyond imagination',
    color: '#805AD5',
  },
};

export function getCurrentEra(turn: number): Era {
  if (turn >= ERAS.future.turnThreshold) return 'future';
  if (turn >= ERAS.modern.turnThreshold) return 'modern';
  if (turn >= ERAS.industrial.turnThreshold) return 'industrial';
  if (turn >= ERAS.medieval.turnThreshold) return 'medieval';
  return 'ancient';
}

export function getEraProgress(turn: number): { current: Era; next: Era | null; progress: number } {
  const current = getCurrentEra(turn);
  const eraOrder: Era[] = ['ancient', 'medieval', 'industrial', 'modern', 'future'];
  const currentIndex = eraOrder.indexOf(current);
  const next = currentIndex < eraOrder.length - 1 ? eraOrder[currentIndex + 1] : null;

  if (!next) {
    return { current, next: null, progress: 100 };
  }

  const currentThreshold = ERAS[current].turnThreshold;
  const nextThreshold = ERAS[next].turnThreshold;
  const progress = ((turn - currentThreshold) / (nextThreshold - currentThreshold)) * 100;

  return { current, next, progress: Math.min(100, Math.max(0, progress)) };
}
