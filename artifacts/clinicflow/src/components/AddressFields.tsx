import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { geoScope, validatePostalCode, DEFAULT_ADDRESS_COUNTRY } from "../lib/address";
import { phoneCountries } from "../lib/phone";
import { useDebouncedValue } from "../hooks/use-debounced-value";
import { SearchableSelect } from "./SearchableSelect";
import { SuggestionInput } from "./SuggestionInput";
import { HelpTip } from "./HelpTip";
import { PinLocalities } from "./PinLocalities";
import { reconcileLocalities, toggleLocality, type LocalitySelection } from "../lib/locality-selection";

export type AddressValue = { address?: string; country?: string; state?: string; city?: string; pincode?: string; localities?: LocalitySelection[] };
export type AddressErrors = Partial<Record<keyof AddressValue, string>>;
/** "private" = signed-in directory + the clinic's curated masters; "public" = read-only public directory. */
export type AddressDirectory = "private" | "public";

// Dropdown rows search the full country name; the closed control shows only the compact ISO code.
const COUNTRY_OPTIONS = phoneCountries.map(c => ({ value: c.country, label: `${c.name} (${c.country})`, selectedLabel: c.country }));
const KNOWN = new Set<string>(COUNTRY_OPTIONS.map(o => o.value));
/** Saved values that are not ISO codes (legacy "India", other text) are kept as their own option, never rewritten. */
export function countryOptions(saved?: string) {
  const v = (saved || "").trim();
  return v && !KNOWN.has(v) ? [{ value: v, label: `${v} (saved value)`, selectedLabel: v }, ...COUNTRY_OPTIONS] : COUNTRY_OPTIONS;
}

async function searchNames(directory: AddressDirectory, kind: "state" | "city", search: string, scope: { country: string; state?: string }) {
  const options = { signal: AbortSignal.timeout(15000) };
  const params = { kind, search, country: scope.country, ...(kind === "city" ? { state: scope.state } : {}) };
  if (directory === "public") return (await api.searchPublicGeography(params, options)).items;
  const [data, local] = await Promise.all([
    api.searchGeography(params, options),
    api.listMasters({ category: kind, status: "active", search, pageSize: 20 } as any, options).catch(() => ({ items: [] as { name: string }[] })),
  ]);
  return [...new Set([...data.items, ...local.items.map(row => row.name)])].slice(0, 20);
}
function useNames(directory: AddressDirectory, kind: "state" | "city", search: string, scope: { country: string; state?: string }) {
  const term = useDebouncedValue(search);
  return useQuery({ queryKey: ["address-names", directory, kind, term, scope.country, kind === "city" ? scope.state : ""], retry: false, staleTime: 600_000, queryFn: () => searchNames(directory, kind, term, scope) });
}

/**
 * Section C: the ONE address layout for every form (locations, onboarding/registration, patients,
 * staff, doctors, profiles). Controlled: emits patches only on user action. Wide address line;
 * compact searchable country (closed shows "IN", dropdown searches full names, saved values kept);
 * State/UT and City/Town suggestions that always accept free text; PIN with optional locality pick.
 * Incompatible children are cleared only after a user-initiated parent change AND a directory check
 * — never on first render. City is never filled from PIN data; State/UT only via an explicit button.
 */
export function AddressFields({ value, onChange, directory = "private", required = false, errors = {}, testId = "address", idPrefix = "input-" }: { value: AddressValue; onChange: (patch: Partial<AddressValue>) => void; directory?: AddressDirectory; required?: boolean; errors?: AddressErrors; testId?: string; idPrefix?: string }) {
  const [stateSearch, setStateSearch] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const country = value.country ?? "";
  const scope = geoScope(value);
  const states = useNames(directory, "state", stateSearch, scope);
  const cities = useNames(directory, "city", citySearch, scope);
  const pinError = errors.pincode || (validatePostalCode(value.pincode, scope.country) === true ? undefined : String(validatePostalCode(value.pincode, scope.country)));
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange;
  const valueRef = useRef(value); valueRef.current = value;
  const parentChange = useRef<"country" | "state" | null>(null);
  const parentKey = `${scope.country}|${scope.state}`;
  const lastParent = useRef(parentKey);
  useEffect(() => {
    if (lastParent.current === parentKey) return;
    lastParent.current = parentKey;
    const changed = parentChange.current;
    if (!changed) return; // value changed from outside (reset/load): never clear anything
    // Wait until the user pauses typing so a partial State/UT never clears the city.
    const timer = setTimeout(() => {
    parentChange.current = null;
    const current = { ...valueRef.current };
    const params = { country: scope.country };
    const fetcher = directory === "public" ? api.searchPublicGeography : api.searchGeography;
    if (changed === "country" && current.state) {
      fetcher({ kind: "state", search: current.state, ...params }).then(r => {
        if (r.items.length && !r.items.some(n => n.toLowerCase() === String(current.state).toLowerCase())) onChangeRef.current({ state: "", city: "" });
      }).catch(() => undefined);
      return;
    }
    if (current.city && current.state) fetcher({ kind: "city", city: current.city, ...params, state: scope.state }).then(r => { if (r.compatible === false && valueRef.current.state === current.state) onChangeRef.current({ city: "" }); }).catch(() => undefined);
    }, 700);
    return () => clearTimeout(timer);
  }, [parentKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const label = (text: string, help: string, req = false) => <span className="field-hint">{text}{req && <span className="required"> *</span>} <HelpTip label={`About ${text}`} text={help}/></span>;
  return <div className="address-fields wide" role="group" aria-label="Address" data-testid={`fieldset-${testId}`}>
    <label className="wide">{label("Address Line", "House, street and area. Picking a PIN locality can add it here.", required)}
      <input id={`${idPrefix}address`} value={value.address || ""} required={required} maxLength={500} aria-invalid={!!errors.address || undefined} onChange={e => onChange({ address: e.target.value, localities: reconcileLocalities(e.target.value, value.localities) })} data-testid={testId}/>
      {errors.address && <small className="field-error">{errors.address}</small>}</label>
    <div className="address-compact">{label("Country", "Search by country name. The selected country shows as its short code; saved values are kept as entered.")}
      <SearchableSelect id={`${idPrefix}country`} testId={`${testId}-country`} value={country || DEFAULT_ADDRESS_COUNTRY} options={countryOptions(country)} placeholder="Country"
        onChange={next => { if (next === (country || DEFAULT_ADDRESS_COUNTRY)) return; parentChange.current = "country"; onChange({ country: next, localities: [] }); }}/>
      {errors.country && <small className="field-error">{errors.country}</small>}</div>
    <div className="address-compact">{label("State/UT", "Suggestions follow the selected country. You can type a State/UT that is not listed.")}
      <SuggestionInput id={`${idPrefix}state`} aria-label="State/UT" value={value.state || ""} placeholder="Search State/UT…" clearLabel="Clear State/UT"
        onChange={next => { parentChange.current = "state"; onChange({ state: next }); }} onSearchChange={setStateSearch}
        options={states.error ? [] : states.data || []} loading={states.isFetching} error={states.error ? "Suggestions unavailable; type the State/UT." : undefined} onRetry={() => void states.refetch()}/>
      {errors.state && <small className="field-error">{errors.state}</small>}</div>
    <div className="address-compact">{label("City/Town", "Filtered by State/UT. Type any city or town if it is missing; districts and post offices are never used as the city.")}
      <SuggestionInput id={`${idPrefix}city`} aria-label="City/Town" value={value.city || ""} placeholder="Search City/Town…" clearLabel="Clear City/Town"
        onChange={next => onChange({ city: next })} onSearchChange={setCitySearch}
        options={cities.error ? [] : cities.data || []} loading={cities.isFetching} error={cities.error ? "Suggestions unavailable; type the city or town." : undefined} onRetry={() => void cities.refetch()}/>
      {errors.city && <small className="field-error">{errors.city}</small>}</div>
    <label className="address-compact">{label("PIN Code", "For India, matching India Post localities appear; picking one adds it to the address. State/UT is only set when you press Use, and the city is never filled.")}
      <input id={`${idPrefix}pincode`} inputMode="numeric" value={value.pincode || ""} maxLength={12} placeholder="6-digit PIN" aria-invalid={!!pinError || undefined} onChange={e => onChange({ pincode: e.target.value, localities: [] })} data-testid={`${testId}-pincode`}/>
      {pinError && <small className="field-error">{pinError}</small>}
      <PinLocalities pin={value.pincode || ""} country={scope.country} currentState={value.state || ""}
        selectedKeys={reconcileLocalities(value.address || "", value.localities).map(item => item.key)}
        onUseState={state => { if (state !== value.state) { parentChange.current = "state"; onChange({ state }); } }}
        onPick={row => onChange(toggleLocality(value.address || "", value.localities || [], `${row.locality}|${row.district}`, row.locality))}/></label>
  </div>;
}
