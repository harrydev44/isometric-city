export const PANE_QUERY_PARAM = 'pane';

export type CityStorageKeys = {
  prefix: string;
  state: string;
  savedCity: string;
  savedCitiesIndex: string;
  savedCityPrefix: string;
  spritePack: string;
  dayNightMode: string;
  tipsDisabled: string;
  tipsShown: string;
  tempPrefix: string;
};

export type CoasterStorageKeys = {
  prefix: string;
  autosave: string;
  savedParksIndex: string;
  savedParkPrefix: string;
};

export function sanitizeStorageNamespace(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, '');
  return cleaned.length > 0 ? cleaned : null;
}

export function buildStoragePrefix(namespace?: string | null): string {
  const cleaned = sanitizeStorageNamespace(namespace ?? null);
  return cleaned ? `pane:${cleaned}:` : '';
}

export function buildCityStorageKeys(prefix: string): CityStorageKeys {
  return {
    prefix,
    state: `${prefix}isocity-game-state`,
    savedCity: `${prefix}isocity-saved-city`,
    savedCitiesIndex: `${prefix}isocity-saved-cities-index`,
    savedCityPrefix: `${prefix}isocity-city-`,
    spritePack: `${prefix}isocity-sprite-pack`,
    dayNightMode: `${prefix}isocity-day-night-mode`,
    tipsDisabled: `${prefix}isocity-tips-disabled`,
    tipsShown: `${prefix}isocity-tips-shown`,
    tempPrefix: `${prefix}isocity_temp_`,
  };
}

export function buildCoasterStorageKeys(prefix: string): CoasterStorageKeys {
  return {
    prefix,
    autosave: `${prefix}coaster-tycoon-state`,
    savedParksIndex: `${prefix}coaster-saved-parks-index`,
    savedParkPrefix: `${prefix}coaster-park-`,
  };
}

export function withPaneParam(path: string, pane: string | null): string {
  const cleaned = sanitizeStorageNamespace(pane);
  if (!cleaned) return path;
  const url = new URL(path, 'http://localhost');
  url.searchParams.set(PANE_QUERY_PARAM, cleaned);
  return `${url.pathname}${url.search}`;
}
