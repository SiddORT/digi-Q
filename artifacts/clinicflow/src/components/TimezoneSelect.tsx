import { useMemo } from "react";
import { SearchableSelect } from "./SearchableSelect";

export const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
export function TimezoneSelect({ value, onChange, label = "Timezone", required = true, error }: { value: string; onChange: (value: string) => void; label?: string; required?: boolean; error?: string }) {
  const options = useMemo(() => {
    const supported = (Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("timeZone") || [];
    return [...new Set([browserTimezone(), "UTC", value, ...supported].filter(Boolean))].map(zone => {
      let offset = "";
      try { offset = new Intl.DateTimeFormat("en", { timeZone: zone, timeZoneName: "longOffset" }).formatToParts().find(part => part.type === "timeZoneName")?.value || ""; } catch { offset = "Check timezone"; }
      return { value: zone, label: `${zone.replace(/_/g, " ")} · ${offset}` };
    });
  }, [value]);
  return <SearchableSelect label={label} required={required} value={value} onChange={onChange} options={options} error={error} placeholder="Search timezones…"/>;
}