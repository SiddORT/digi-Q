import { forwardRef, useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import type { CountryCode } from "libphonenumber-js/max";
import { SearchableSelect } from "./SearchableSelect";
import { formatNational, joinPhone, phoneCountries, splitPhone } from "../lib/phone";
import { DEFAULT_PHONE_COUNTRY } from "../lib/address";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & { value: string; onChange: (value: string) => void };
// Dropdown rows search full names; the closed control shows only the compact calling code.
const countryOptions = phoneCountries.map(item => ({ value: item.country, label: `${item.name} ${item.code}`, selectedLabel: `${item.code} ${item.country}` }));

/**
 * Country dropdown + local number. onChange always emits the international
 * (+country digits) value, or "" when empty. Pasting a full "+..." number into
 * the local field selects its country automatically.
 */
export const PhoneInput = forwardRef<HTMLInputElement, Props>(function PhoneInput({ value, onChange, className, ...props }, ref) {
  const [parts, setParts] = useState(() => splitPhone(value, DEFAULT_PHONE_COUNTRY));
  const emitted = useRef(value);
  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    setParts(previous => splitPhone(value, previous.country));
  }, [value]);
  const emit = (country: CountryCode | "", national: string) => {
    const next = joinPhone(country, national);
    emitted.current = next;
    onChange(next);
  };
  const changeNational = (text: string) => {
    if (/^\s*(\+|00)/.test(text)) {
      const international = joinPhone("", text);
      const split = splitPhone(international, parts.country);
      if (split.country && split.national !== international) { setParts(split); emit(split.country, split.national); return; }
      setParts({ ...parts, national: text }); emit(parts.country, text); return;
    }
    const national = text.replace(/[^\d\s().-]/g, "");
    setParts({ ...parts, national });
    emit(parts.country, national);
  };
  return <span className={`phone-input${className ? ` ${className}` : ""}`}>
    <SearchableSelect disabled={props.disabled || props.readOnly} value={parts.country} placeholder="Country code"
      onChange={country => { const next = country as CountryCode | ""; setParts({ ...parts, country: next }); if (parts.national) emit(next, parts.national); }}
      options={countryOptions} />
    <input {...props} ref={ref} type="tel" inputMode="tel" autoComplete="tel-national" value={formatNational(parts.country, parts.national)}
      aria-label={props["aria-label"] || "Local phone number"} placeholder={props.placeholder || "Local number"}
      onChange={event => changeNational(event.target.value)} />
  </span>;
});
