import { DateFormatInput, TimeFormatInput } from "./DateFormatInput";

/** A local wall clock, not a browser-zone instant. Empty bounds are allowed, half bounds are not. */
export function DateTimeFilterInput({ value, onChange, label, testId }: { value: string; onChange: (value: string) => void; label: string; testId: string }) {
  const [date = "", time = ""] = value.split("T");
  const partial = !!date !== !!time;
  const change = (d: string, t: string) => onChange(d || t ? `${d}T${t}` : "");
  return <fieldset className="form-field"><legend>{label}</legend>
    <DateFormatInput aria-label={`${label} Date`} required={!!time} value={date} onChange={v => change(v, time)} data-testid={testId} />
    <TimeFormatInput aria-label={`${label} Time`} required={!!date} value={time} onChange={v => change(date, v)} data-testid={`${testId}-time`} />
    {partial && <span className="field-error" role="alert">Enter both a date and time, or clear both for an open-ended range.</span>}
  </fieldset>;
}
