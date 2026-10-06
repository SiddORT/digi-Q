import { Country, State, City } from "country-state-city";
type Kind = "country" | "state" | "city";
export type GeoScope = { country?: string; state?: string };
/*
 * Offline reference data (country-state-city, bundled and cached in-process) so
 * routine address entry survives any external outage. No district or post-office
 * data is used; city suggestions are the dataset's city/town names only.
 */
const cache = new Map<string, string[]>();
/** Accepts ISO-2 code ("IN") or English name ("India"); returns ISO code or "". */
export function resolveCountryCode(value = ""): string {
  const v = value.trim();
  if (!v) return "";
  const byCode = Country.getCountryByCode(v.toUpperCase());
  if (byCode && v.length === 2) return byCode.isoCode;
  const byName = Country.getAllCountries().find(c => c.name.toLocaleLowerCase() === v.toLocaleLowerCase());
  return byName?.isoCode || "";
}
function resolveStateCode(country: string, value = ""): string {
  const v = value.trim().toLocaleLowerCase();
  if (!country || !v) return "";
  return State.getStatesOfCountry(country).find(s => s.name.toLocaleLowerCase() === v || s.isoCode.toLocaleLowerCase() === v)?.isoCode || "";
}
function names(kind: Kind, scope: GeoScope): string[] {
  const country = resolveCountryCode(scope.country);
  const state = kind === "city" ? resolveStateCode(country, scope.state) : "";
  const key = `${kind}|${kind === "country" ? "" : country}|${state}`;
  if (!cache.has(key)) {
    const records: { name: string }[] = kind === "country" ? Country.getAllCountries()
      : kind === "state" ? (country ? State.getStatesOfCountry(country) : State.getAllStates())
      : country && state ? City.getCitiesOfState(country, state) : country ? City.getCitiesOfCountry(country) || [] : City.getAllCities();
    cache.set(key, [...new Set(records.map(record => record.name))].sort((a, b) => a.localeCompare(b)));
  }
  return cache.get(key)!;
}
export function searchGeographicNames(kind: Kind, search = "", scope: GeoScope = {}) {
  const term = search.trim().toLocaleLowerCase();
  const list = names(kind, scope);
  // Bound the response, not the searchable directory. Prefer prefix matches.
  const prefix = list.filter(name => name.toLocaleLowerCase().startsWith(term)).slice(0, 20);
  const rest = prefix.length < 20 && term ? list.filter(name => name.toLocaleLowerCase().includes(term) && !name.toLocaleLowerCase().startsWith(term)).slice(0, 20 - prefix.length) : [];
  return [...prefix, ...rest];
}
/** True when city belongs to state (in country), or when the dataset cannot judge (manual entries are kept). */
export function cityCompatible(city: string, scope: GeoScope): boolean {
  const country = resolveCountryCode(scope.country);
  if (!city.trim() || !country || !resolveStateCode(country, scope.state)) return true;
  return names("city", scope).some(name => name.toLocaleLowerCase() === city.trim().toLocaleLowerCase());
}
