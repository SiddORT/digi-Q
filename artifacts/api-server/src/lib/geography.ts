import { Country, State, City } from "country-state-city";
type Kind = "country" | "state" | "city";
const cache = new Map<Kind, string[]>();
export function searchGeographicNames(kind: Kind, search = "") {
  if (!cache.has(kind)) {
    const records = kind === "country" ? Country.getAllCountries() : kind === "state" ? State.getAllStates() : City.getAllCities();
    cache.set(kind, [...new Set(records.map(record => record.name))].sort((a,b)=>a.localeCompare(b)));
  }
  const term = search.trim().toLocaleLowerCase();
  const names = cache.get(kind)!;
  // Bound the response, not the searchable directory. Prefer prefix matches.
  const prefix = names.filter(name => name.toLocaleLowerCase().startsWith(term)).slice(0,20);
  const rest = prefix.length < 20 && term ? names.filter(name=>name.toLocaleLowerCase().includes(term)&&!name.toLocaleLowerCase().startsWith(term)).slice(0,20-prefix.length) : [];
  return [...prefix,...rest];
}
