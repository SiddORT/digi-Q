import type { InputHTMLAttributes } from "react";

/** Application validation is supplied by the caller: stored logo paths and provider URLs have different policies. Never probes a host. */
export function UrlInput({ validationMessage, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { validationMessage?: string }) {
  return <input {...props} type="text" inputMode="url" spellCheck={false} autoCapitalize="none"
    aria-invalid={!!validationMessage || props["aria-invalid"]}
    ref={el => el?.setCustomValidity(validationMessage || "")} />;
}
