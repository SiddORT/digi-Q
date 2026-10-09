import { useQuery } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { isIndia } from "../lib/address";

export type PinLocality = { locality: string; district: string; state: string };

/**
 * Section C PIN assistance from the official India Post directory (offline, GODL-India).
 * Nothing is filled until the user explicitly picks a locality (address/area only). State/UT is never
 * auto-filled: the directory is a dated snapshot (normalised for exact splits like Telangana/Ladakh), so it
 * is offered as a labelled suggestion the user must confirm. City is never set; district is context only. Lookup failure leaves manual entry fully working.
 */
export function PinLocalities({ pin, country, onPick, onUseState, currentState = "", selectedKeys = [] }: { pin: string; country?: string; onPick: (row: PinLocality) => void; onUseState?: (state: string) => void; currentState?: string; selectedKeys?: string[] }) {
  const value = (pin || "").replace(/\s/g, "");
  const enabled = isIndia(country) && /^[1-9]\d{5}$/.test(value);
  const q = useQuery({ queryKey: ["pincode", value], enabled, retry: false, staleTime: 86_400_000, queryFn: () => api.lookupPublicPincode(value, { signal: AbortSignal.timeout(10000) }) });
  if (!enabled) return null;
  if (q.isLoading) return <small className="muted pin-localities" role="status">Looking up localities for {value}…</small>;
  if (q.error || q.data?.available === false) return <small className="muted pin-localities">PIN lookup is unavailable; continue entering the address manually.</small>;
  const items = q.data?.items || [];
  if (!items.length) return <small className="muted pin-localities">No localities found for {value}. Check the PIN or continue manually.</small>;
  return <div className="pin-localities" data-testid="pin-localities">
    <small className="muted">Pick a locality for {value} (optional). City stays as you typed it.</small>
    <div className="pin-locality-list">{items.slice(0, 12).map(row => <button key={`${row.locality}-${row.district}`} type="button" aria-pressed={selectedKeys.includes(`${row.locality}|${row.district}`)} className="pin-locality" onClick={() => onPick(row)} title={`${row.locality}, district ${row.district} (district is not used as the city)`} data-testid="button-pin-locality">{selectedKeys.includes(`${row.locality}|${row.district}`) ? "✓ Selected: " : "Add: "}{row.locality}<span> · {row.district}</span></button>)}</div>
    {(() => { const states = [...new Set(items.map(r => r.state))]; return states.length === 1 && states[0].toLowerCase() !== currentState.trim().toLowerCase() && onUseState
      ? <p className="pin-state-suggestion" data-testid="pin-state-suggestion"><small className="muted">India Post directory (dated snapshot) lists this PIN in <strong>{states[0]}</strong>. Check before using.</small> <button type="button" className="text-link" onClick={() => onUseState(states[0])} data-testid="button-pin-use-state">Use {states[0]}</button></p>
      : null; })()}
    <small className="muted pin-attribution">{q.data?.attribution}</small>
  </div>;
}
