import { createContext, useContext, useState, type ReactNode } from "react";
import { usePreference } from "./workspace-preferences";
import { HelpTip } from "../components/HelpTip";

export const APPROVED_PAGE_SIZES = [10, 20, 25, 50, 100] as const;
export function sanitizePageSize(value: unknown): number | null {
  return typeof value === "number" && (APPROVED_PAGE_SIZES as readonly number[]).includes(value) ? value : null;
}
export function resolvePageSize(fallback: number, preferred: number | null, explicit?: unknown, allowed: readonly number[] = APPROVED_PAGE_SIZES): number {
  const requested = explicit == null || explicit === "" ? null : Number(explicit);
  if (requested !== null && allowed.includes(requested)) return requested;
  return preferred !== null && allowed.includes(preferred) ? preferred : fallback;
}
export const pageSizePreferenceKey = (actor: string) => `digiq-rows-per-page:${actor}`;
const Context = createContext<{ size: number | null; save: (size: number | null) => boolean }>({ size: null, save: () => false });

/** Like other workspace display preferences, this is account-scoped on this browser. */
export function PageSizePreferenceProvider({ actor, children }: { actor?: string; children: ReactNode }) {
  const [size, save] = usePreference(pageSizePreferenceKey(actor || ""), null as number | null, sanitizePageSize);
  return <Context.Provider value={actor ? { size, save } : { size: null, save: () => false }}>{children}</Context.Provider>;
}
export const usePageSizePreference = () => useContext(Context);
export function usePreferredPageSize(fallback = 20, explicit?: unknown, allowed?: readonly number[]) {
  return resolvePageSize(fallback, usePageSizePreference().size, explicit, allowed);
}
/** Explicit changes (including saved views) remain local; only the shared footer remembers user selections. */
export function usePageSizeState(fallback = 20, explicit?: unknown) {
  const initial = usePreferredPageSize(fallback, explicit);
  return useState(initial);
}

export function PageSizePreferenceControl() {
  const { size, save } = usePageSizePreference();
  const [failed, setFailed] = useState(false);
  return <section className="panel padded" aria-labelledby="rows-preference-title">
    <h2 id="rows-preference-title">Rows per page <HelpTip text="This preference belongs to your account on this browser, not other devices. When enabled, changing Rows per Page in a list updates it. Links and saved views take priority."/></h2>
    <p className="muted">Choose a default for supported lists on this browser.</p>
    <label htmlFor="rows-preference">Preferred rows per page</label>
    <select id="rows-preference" value={size ?? ""} onChange={event => setFailed(!save(event.target.value ? Number(event.target.value) : null))}>
      <option value="">Use each list’s default</option>
      {APPROVED_PAGE_SIZES.map(value => <option key={value} value={value}>{value}</option>)}
    </select>
    {failed && <p role="alert">Your browser could not save this preference. Check that browser storage is available and try again.</p>}
  </section>;
}
