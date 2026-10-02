import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { passwordChecklist } from "@/lib/validators";
import "./shared-feedback.css";

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Show the live letters/numbers/length checklist under the field (new-password flows). */
  showChecklist?: boolean;
}

/** Password field with an accessible Eye/EyeOff visibility toggle (spec §7.1). Autocomplete is preserved. */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { showChecklist, className, value, ...props }, ref,
) {
  const [visible, setVisible] = useState(false);
  const text = typeof value === "string" ? value : "";
  return (
    <>
      <div className="password-input">
        <input ref={ref} {...props} value={value} type={visible ? "text" : "password"} className={className} />
        <button type="button" className="password-toggle" onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible}
          aria-controls={props.id} disabled={props.disabled}>
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
      {showChecklist && (
        <ul className="password-checklist" aria-label="Password requirements">
          {passwordChecklist(text).map((rule) => (
            <li key={rule.id} data-met={rule.met}>
              {rule.met ? <Check className="h-3 w-3" aria-hidden="true" /> : <X className="h-3 w-3" aria-hidden="true" />}
              {rule.label}<span className="sr-only">{rule.met ? " (met)" : " (not met)"}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
});
