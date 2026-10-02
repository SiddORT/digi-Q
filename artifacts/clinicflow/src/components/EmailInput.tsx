import { forwardRef, type InputHTMLAttributes } from "react";

/** Trim surrounding whitespace only; case and content are preserved so API payloads are unchanged. */
export function normalizeEmail(value: unknown): string { return String(value ?? "").trim(); }

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { /** Default true. Set false on sign-in/reset so the typed identity is submitted exactly as before. */ trimOnBlur?: boolean };

/** Shared email entry control: type=email, 254-char cap, trims on blur via the caller's onChange. */
export const EmailInput = forwardRef<HTMLInputElement, Props>(function EmailInput({ trimOnBlur = true, onBlur, onChange, maxLength = 254, autoComplete = "email", inputMode = "email", spellCheck = false, ...rest }, ref) {
  return <input {...rest} ref={ref} type="email" maxLength={maxLength} autoComplete={autoComplete} inputMode={inputMode} spellCheck={spellCheck} autoCapitalize="none"
    onChange={onChange}
    onBlur={event => { if (trimOnBlur) { const trimmed = normalizeEmail(event.target.value); if (trimmed !== event.target.value) { event.target.value = trimmed; onChange?.(event as any); } } onBlur?.(event); }} />;
});
