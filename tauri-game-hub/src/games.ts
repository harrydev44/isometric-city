import type { Game, GameType } from './types';

export const GAMES: Record<GameType, Game> = {
  'iso-city': {
    id: 'iso-city',
    name: 'ISO City',
    url: 'https://iso-city.com',
    icon: 'home',
    color: '#4ade80', // green
  },
  'iso-coaster': {
    id: 'iso-coaster',
    name: 'ISO Coaster',
    url: 'https://iso-coaster.com',
    icon: 'ferrisWheel',
    color: '#f472b6', // pink
  },
};

export const GAME_LIST = Object.values(GAMES);

export function getGame(gameType: GameType): Game {
  return GAMES[gameType];
}

export function getGameUrl(gameType: GameType): string {
  return GAMES[gameType].url;
}
