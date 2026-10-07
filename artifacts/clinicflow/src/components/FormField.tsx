import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { HelpTip } from "./HelpTip";
import "./shared-feedback.css";

export interface FieldA11yProps {
  id: string;
  "aria-labelledby": string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
  "aria-required"?: true;
}

export interface FormFieldProps {
  label: ReactNode;
  /** Optional explicit id for the control; generated otherwise. */
  id?: string;
  required?: boolean;
  /** Shows "(optional)" after the label. Ignored when required. */
  optional?: boolean;
  helper?: ReactNode;
  error?: string;
  /** InfoTooltip text shown next to the label. */
  info?: string;
  className?: string;
  /** Either a single control element (props injected) or a render function. */
  children: ReactElement | ((props: FieldA11yProps) => ReactNode);
}

/** Label above, * / (optional), helper, inline error with aria-invalid + aria-describedby (spec §7.2). */
export function FormField({ label, id, required, optional, helper, error, info, className, children }: FormFieldProps) {
  const auto = useId();
  const controlId = id ?? `field-${auto}`;
  const helpId = helper ? `${controlId}-help` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [errorId, helpId].filter(Boolean).join(" ") || undefined;
  const a11y: FieldA11yProps = {
    id: controlId,
    "aria-labelledby": `${controlId}-label`,
    ...(error ? { "aria-invalid": true as const } : {}),
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
    ...(required ? { "aria-required": true as const } : {}),
  };
  const control = typeof children === "function"
    ? children(a11y)
    : isValidElement(children) ? cloneElement(children as ReactElement<Record<string, unknown>>, a11y as unknown as Record<string, unknown>) : children;
  return (
    <div className={["form-field", className].filter(Boolean).join(" ")} data-invalid={error ? "" : undefined}>
      <span className="form-field-label">
        <label id={`${controlId}-label`} htmlFor={controlId}>
          {typeof label === "string" && optional ? label.replace(/\s*\(optional\)\s*$/i, "") : label}
          {required ? <span className="form-field-required" aria-hidden="true"> *</span> : optional ? <span className="form-field-optional"> (optional)</span> : null}
        </label>
        {info && <HelpTip text={info} />}
      </span>
      {control}
      {error && <p id={errorId} className="form-field-error" role="alert">{error}</p>}
      {helper && <small id={helpId} className="form-field-help">{helper}</small>}
    </div>
  );
}

/** Form-level summary for errors not tied to a field (spec: summary only for form-level errors). */
export function FormErrorSummary({ message, id }: { message?: string | null; id?: string }) {
  if (!message) return null;
  return <div id={id} className="form-summary" role="alert" tabIndex={-1}>{message}</div>;
}
