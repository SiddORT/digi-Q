import type { InputHTMLAttributes } from "react";

export const normalizeVerificationCode = (value: string, length = 6) => value.replace(/\D/g, "").slice(0, length);

/** String entry preserves leading zeroes; submission remains explicit. */
export function VerificationCodeInput({ value, onChange, length = 6, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: string; onChange: (value: string) => void; length?: number;
}) {
  return <input {...props} type="text" inputMode="numeric" autoComplete="one-time-code" pattern={`[0-9]{${length}}`} minLength={length} maxLength={length}
    value={value} onChange={e => onChange(normalizeVerificationCode(e.target.value, length))}
    onPaste={e => { e.preventDefault(); onChange(normalizeVerificationCode(e.clipboardData.getData("text"), length)); }} />;
}
