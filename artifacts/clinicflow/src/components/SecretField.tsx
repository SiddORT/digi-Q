import { useState } from "react";
import { PasswordInput } from "./PasswordInput";

/** Write-only secret: shows Configured with a Replace action. Nothing is sent unless the user replaces it; Keep saved discards the typed value. */
export function SecretField({ id, label, configured, value, onChange, testId }: { id: string; label: string; configured: boolean; value: string; onChange: (v: string) => void; testId?: string }) {
  const [replacing, setReplacing] = useState(!configured);
  if (!replacing && configured) return <div className="secret-field" data-testid={testId ? `${testId}-configured` : undefined}>
    <span className="badge" role="status">Configured</span>
    <button type="button" className="button secondary small" aria-label={`Replace ${label}`} onClick={() => setReplacing(true)} data-testid={testId ? `button-replace-${testId}` : undefined}>Replace</button>
  </div>;
  return <div className="secret-field">
    <PasswordInput id={id} visibilityLabel={label} autoComplete="off" spellCheck={false} maxLength={2048} value={value} placeholder="Enter a new value" onChange={e => onChange(e.target.value)} />
    {configured && <button type="button" className="button secondary small" onClick={() => { onChange(""); setReplacing(false); }} data-testid={testId ? `button-keep-${testId}` : undefined}>Keep saved value</button>}
  </div>;
}
