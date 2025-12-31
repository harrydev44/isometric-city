/**
 * Rise of Nations - Age System Types
 * 
 * Ages progress through history matching the available sprite sheets.
 * Each age unlocks new buildings, units, and technologies.
 */

export type Age = 
  | 'classical'    // Greek/Roman era -> classics.webp
  | 'medieval'     // Feudal era -> medeival.webp (note: typo in filename)
  | 'enlightenment'// Renaissance/Colonial -> enlightenment.webp
  | 'industrial'   // Steam/Victorian -> industrial.webp
  | 'modern';      // 20th century -> modern.webp

export const AGE_ORDER: Age[] = [
  'classical',
  'medieval',
  'enlightenment',
  'industrial',
  'modern',
];

// Age progression costs (in various resources)
export interface AgeRequirement {
  food: number;
  wood: number;
  metal: number;
  gold: number;
  knowledge: number;
  oil?: number; // Only for industrial+
}

export const AGE_REQUIREMENTS: Record<Age, AgeRequirement | null> = {
  classical: null, // Starting age
  medieval: { food: 400, wood: 400, metal: 200, gold: 250, knowledge: 100 },
  enlightenment: { food: 600, wood: 600, metal: 400, gold: 500, knowledge: 250 },
  industrial: { food: 1000, wood: 800, metal: 800, gold: 1000, knowledge: 500 },
  modern: { food: 1500, wood: 1000, metal: 1200, gold: 2000, knowledge: 1000, oil: 500 },
};

// Time in game ticks for a typical 40-minute game to span all ages
// At default speed, ~200 ticks per minute = 8000 ticks total
// Each age should last ~2000 ticks at normal pace (though players can advance faster)
export const GAME_TICKS_PER_MINUTE = 200;
export const TARGET_GAME_DURATION_MINUTES = 40;
export const TARGET_GAME_TICKS = GAME_TICKS_PER_MINUTE * TARGET_GAME_DURATION_MINUTES;

// Population cap bonus per age - now fixed (pop cap comes only from buildings)
export const AGE_POPULATION_BONUS: Record<Age, number> = {
  classical: 0,
  medieval: 0,
  enlightenment: 0,
  industrial: 0,
  modern: 0,
};

// Age display information
export const AGE_INFO: Record<Age, { name: string; description: string; color: string }> = {
  classical: { 
    name: 'Classical Age', 
    description: 'The age of empires', 
    color: '#DAA520' 
  },
  medieval: { 
    name: 'Medieval Age', 
    description: 'Knights and castles', 
    color: '#4169E1' 
  },
  enlightenment: { 
    name: 'Enlightenment Age', 
    description: 'Age of discovery and reason', 
    color: '#9370DB' 
  },
  industrial: { 
    name: 'Industrial Age', 
    description: 'Steam and steel', 
    color: '#2F4F4F' 
  },
  modern: { 
    name: 'Modern Age', 
    description: 'The contemporary era', 
    color: '#1E90FF' 
  },
};
