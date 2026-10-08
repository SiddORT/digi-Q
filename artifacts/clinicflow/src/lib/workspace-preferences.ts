import { useCallback, useSyncExternalStore } from "react";

/** Shared device-local preference store scoped by user and role.
 *  Only page identifiers, column layouts and filter presets are stored.
 *  Search terms and patient data are never persisted. */
const EVENT = "digiq-preferences-changed";
const cache = new Map<string, { raw: string | null; value: unknown }>();

export function readPreference<T>(key: string, fallback: T, sanitize: (value: unknown) => T): T {
  let raw: string | null = null;
  try { raw = localStorage.getItem(key); } catch { return fallback; }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  let value: T = fallback;
  try { value = raw ? sanitize(JSON.parse(raw)) : fallback; } catch { value = fallback; }
  cache.set(key, { raw, value });
  return value;
}

export function writePreference(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
    return true;
  } catch { return false; }
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener(EVENT, callback); window.removeEventListener("storage", callback); };
}

export function usePreference<T>(key: string, fallback: T, sanitize: (value: unknown) => T) {
  const value = useSyncExternalStore(subscribe, () => readPreference(key, fallback, sanitize), () => fallback);
  const set = useCallback((next: T) => writePreference(key, next), [key]);
  return [value, set] as const;
}

// --- Navigation favorites / recent pages ---
export type NavigationPreferences = { favorites: string[]; recent: string[] };
const strings = (value: unknown) => Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && /^[a-z-]{1,40}$/.test(v)).slice(0, 30) : [];
const sanitizeNavigation = (value: unknown): NavigationPreferences => {
  const v = (value || {}) as Record<string, unknown>;
  return { favorites: strings(v.favorites), recent: strings(v.recent).slice(0, 8) };
};
const EMPTY_NAV: NavigationPreferences = { favorites: [], recent: [] };
export const navigationKey = (userId: string, role: string) => `digiq-navigation:${userId}:${role}`;

export function useNavigationPreferences(userId: string, role: string, clinicListing = false) {
  const key = navigationKey(userId, role);
  const [stored, set] = usePreference(key, EMPTY_NAV, sanitizeNavigation);
  const canonical = (page:string) => clinicListing && page==="clinic" ? "clinics" : page;
  const prefs = clinicListing ? {favorites:[...new Set(stored.favorites.map(canonical))],recent:[...new Set(stored.recent.map(canonical))]} : stored;
  const toggleFavorite = (value: string) => {const page=canonical(value);return set({ ...prefs, favorites: prefs.favorites.includes(page) ? prefs.favorites.filter(p => p !== page) : [...prefs.favorites, page] });};
  return { prefs, set, toggleFavorite };
}

export function recordRecentPage(userId: string, role: string, page: string) {
  const key = navigationKey(userId, role);
  const current = readPreference(key, EMPTY_NAV, sanitizeNavigation);
  if (current.recent[0] === page) return true;
  return writePreference(key, { ...current, recent: [page, ...current.recent.filter(p => p !== page)].slice(0, 8) });
}
