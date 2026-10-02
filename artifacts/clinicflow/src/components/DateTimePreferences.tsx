import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_DATE_TIME_PREFERENCES, resolveDateTimePreferences, type DateTimePreferences } from "../lib/date-time";

const Context = createContext<DateTimePreferences>(DEFAULT_DATE_TIME_PREFERENCES);
/** Scope to the record's parent clinic, not the signed-in user's default clinic. */
export function DateTimePreferencesProvider({ value, children }: { value?: Partial<DateTimePreferences> | null; children: ReactNode }) {
  return <Context.Provider value={resolveDateTimePreferences(value)}>{children}</Context.Provider>;
}
export function useDateTimePreferences() { return useContext(Context); }