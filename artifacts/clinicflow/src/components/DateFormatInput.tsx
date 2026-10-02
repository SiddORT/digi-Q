import { useEffect, useId, useRef, useState, type InputHTMLAttributes } from "react";
import { formatDate, formatTime, parseDateInput, parseTimeInput, type DateTimePreferences } from "../lib/date-time";
import { useDateTimePreferences } from "./DateTimePreferences";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "min" | "max"> & {
  value: string; onChange: (canonical: string) => void; preferences?: Partial<DateTimePreferences>;
  /** Canonical YYYY-MM-DD bounds (HH:mm for time inputs), never display strings. */
  min?: string; max?: string;
  onValidityChange?: (valid: boolean) => void;
};
/** Controlled canonical value with local typed text; invalid input never escapes as storage data. */
function FormattedInput({ value, onChange, preferences, mode, min, max, onValidityChange, ...props }: Props & { mode: "date" | "time" }) {
  const inherited = useDateTimePreferences(), prefs = { ...inherited, ...preferences };
  const formatter = mode === "date" ? formatDate : formatTime;
  const parser = mode === "date" ? parseDateInput : parseTimeInput;
  const [text, setText] = useState(value ? formatter(value, prefs) : "");
  const pendingEcho = useRef<string | null>(null);
  const lastFormat = useRef(`${prefs.dateFormat}:${prefs.timeFormat}:${mode}`);
  const parsed = text ? parser(text, prefs) : null;
  const invalid = text ? parsed === null || !!(min && parsed < min) || !!(max && parsed > max) : !!props.required;
  const id = useId(), errorId = `${id}-error`;
  useEffect(() => {
    const format = `${prefs.dateFormat}:${prefs.timeFormat}:${mode}`;
    if (pendingEcho.current === value && lastFormat.current === format) { pendingEcho.current = null; return; }
    pendingEcho.current = null;
    lastFormat.current = format;
    setText(value ? formatter(value, prefs) : "");
  }, [value, prefs.dateFormat, prefs.timeFormat, mode]);
  useEffect(() => { onValidityChange?.(!invalid); }, [invalid, onValidityChange]);
  const example = formatter(mode === "date" ? "2026-09-30" : "09:00", prefs);
  const error = !text && props.required ? "This field is required."
    : parsed && min && parsed < min ? `Enter a ${mode} on or after ${formatter(min, prefs)}.`
    : parsed && max && parsed > max ? `Enter a ${mode} on or before ${formatter(max, prefs)}.`
    : `Enter a valid ${mode}, for example ${example}.`;
  return <span>
    <input {...props} type="text" value={text} placeholder={props.placeholder ?? example} aria-invalid={invalid || props["aria-invalid"]}
      aria-describedby={[props["aria-describedby"], invalid ? errorId : ""].filter(Boolean).join(" ") || undefined}
      onChange={event => {
        const next = event.target.value;
        setText(next);
        const parsed = parser(next, prefs);
        const canonical = parsed !== null && !(min && parsed < min) && !(max && parsed > max) ? parsed : "";
        // Clear the canonical form value immediately, but retain invalid text for
        // correction when the parent echoes that empty value back.
        pendingEcho.current = canonical;
        onChange(canonical);
      }}
      ref={element => { element?.setCustomValidity(invalid ? error : ""); }} />
    {invalid && <span id={errorId} role="alert">{error}</span>}
  </span>;
}
export function DateFormatInput(props: Props) { return <FormattedInput {...props} mode="date" />; }
export function TimeFormatInput(props: Props) { return <FormattedInput {...props} mode="time" />; }