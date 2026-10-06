import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
/*
 * Section C PIN assistance. Source: India Post "All India Pincode Directory", published on data.gov.in
 * under the Government Open Data License – India (GODL): free use, adaptation and redistribution with
 * attribution. Imported offline into data/india-pincodes.json.gz (scripts/build-pincodes.py) and cached
 * in-process, so lookup never depends on an external service. Results are post-office localities with
 * their district for context; callers must let the user pick a locality explicitly and must never copy
 * the district (or post office) into the city field.
 */
export const PINCODE_ATTRIBUTION = "PIN data: India Post, All India Pincode Directory (data.gov.in, GODL-India)";
export type Locality = { locality: string; district: string; state: string };
let table: Record<string, [string, string, string][]> | null | undefined;
function load() {
  if (table !== undefined) return table;
  const here = dirname(fileURLToPath(import.meta.url));
  const file = [resolve(here, "data/india-pincodes.json.gz"), resolve(process.cwd(), "data/india-pincodes.json.gz"), resolve(here, "../data/india-pincodes.json.gz"), resolve(here, "../../data/india-pincodes.json.gz")].find(existsSync);
  try { table = file ? JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) : null; } catch (error) { table = null; console.error("[pincode] PIN directory unreadable; PIN assistance disabled", error); }
  if (!file) console.error("[pincode] PIN directory asset not found; PIN assistance disabled (manual entry continues)");
  return table;
}
/** null = dataset unavailable (manual entry continues); [] = unknown PIN. */
export function lookupPincode(pin: string): Locality[] | null {
  const data = load();
  if (!data) return null;
  if (!/^[1-9]\d{5}$/.test(pin)) return [];
  return (data[pin] || []).slice(0, 50).map(([locality, district, state]) => ({ locality, district, state }));
}
/** Startup/health visibility so a missing asset is never silent. */
export function pincodeAssetStatus() { const data = load(); return { available: !!data, pins: data ? Object.keys(data).length : 0 }; }
