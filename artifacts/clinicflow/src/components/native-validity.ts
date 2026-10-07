import type { FormEvent } from "react";
import { REQUIRED_MESSAGE } from "../lib/validators";

/**
 * Tabbed/stepped forms hide inactive panels. If the browser does its own validation, it tries to
 * focus an invalid field in a hidden panel, fails ("An invalid form control is not focusable"),
 * and cancels the submit before React Hook Form's onInvalid runs. Those forms therefore set
 * `noValidate`, and this module keeps every native constraint (type=email/url, min/max, step,
 * pattern, maxLength, required, unparseable input) as an error, so turning native validation off
 * does not weaken anything.
 */
type ValidityLike = { valid: boolean; valueMissing?: boolean; typeMismatch?: boolean; patternMismatch?: boolean; rangeUnderflow?: boolean; rangeOverflow?: boolean; stepMismatch?: boolean; tooLong?: boolean; tooShort?: boolean; badInput?: boolean };
export type ConstraintElement = { name?: string; id?: string; type?: string; disabled?: boolean; willValidate?: boolean; validity?: ValidityLike; getAttribute?: (n: string) => string | null; closest?: (s: string) => unknown };
export type NativeIssue = { name: string; message: string; element: ConstraintElement };

export function nativeMessage(el: ConstraintElement): string {
  const v = el.validity!; const attr = (n: string) => el.getAttribute?.(n) ?? null;
  if (v.valueMissing) return REQUIRED_MESSAGE;
  if (v.badInput) return el.type === "number" ? "Enter a number." : el.type === "date" || el.type === "time" ? "Enter a complete, valid value." : "Enter a valid value.";
  if (v.typeMismatch) return el.type === "email" ? "Enter a valid email address." : el.type === "url" ? "Enter a full web address, e.g. https://example.com." : "Enter a valid value.";
  if (v.rangeUnderflow) return el.type === "date" ? `Choose a date on or after ${attr("min")}.` : `Must be at least ${attr("min")}.`;
  if (v.rangeOverflow) return el.type === "date" ? `Choose a date on or before ${attr("max")}.` : `Must be ${attr("max")} or less.`;
  if (v.stepMismatch) return "Enter a whole number.";
  if (v.patternMismatch) return attr("title") || "Use the required format.";
  if (v.tooLong) return `Use at most ${attr("maxlength")} characters.`;
  if (v.tooShort) return `Use at least ${attr("minlength")} characters.`;
  return "Enter a valid value.";
}

/** Every named (or id-bearing), enabled control failing a native constraint, in DOM order (hidden tabs included). */
export function nativeInvalidFields(elements: ArrayLike<ConstraintElement>): NativeIssue[] {
  const out: NativeIssue[] = []; const seen = new Set<string>();
  for (const el of Array.from(elements)) {
    const key = el.name || el.id;
    if (!key || el.disabled || el.willValidate === false || !el.validity || el.validity.valid || seen.has(key)) continue;
    seen.add(key); out.push({ name: key, message: nativeMessage(el), element: el });
  }
  return out;
}

/** Merge RHF errors with native issues, ordered by first DOM appearance so the first invalid tab/step wins. */
export function mergeInDomOrder(rhfErrors: Record<string, unknown>, issues: NativeIssue[], domNames: string[]): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...rhfErrors };
  for (const i of issues) if (!merged[i.name]) merged[i.name] = { type: "native", message: i.message };
  const rank = (k: string) => { const at = domNames.indexOf(k); return at < 0 ? Number.MAX_SAFE_INTEGER : at; };
  return Object.fromEntries(Object.entries(merged).sort(([a], [b]) => rank(a) - rank(b)));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RhfLike = { handleSubmit: (...args: any[]) => (e?: any) => Promise<void>; setError: (name: any, error: { type: string; message: string }) => void };

/** Drop-in for `form.handleSubmit(onValid, onInvalid)` on a `noValidate` form: native failures block submit and reach onInvalid. */
export function submitWithNativeChecks<V = Record<string, any>>(form: RhfLike, onValid: (values: V) => unknown, onInvalid?: (errors: any) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    const elements = Array.from(event.currentTarget.elements) as unknown as ConstraintElement[];
    const issues = nativeInvalidFields(elements);
    const domNames = elements.map(e => e.name || e.id || "").filter(Boolean);
    const fail = (errors: Record<string, unknown>) => {
      for (const i of issues) if (!errors[i.name]) form.setError(i.name, { type: "native", message: i.message });
      onInvalid?.(mergeInDomOrder(errors, issues, domNames));
    };
    return form.handleSubmit((values: V) => issues.length ? fail({}) : onValid(values as V), fail)(event);
  };
}

/** Open collapsed <details> ancestors, then focus: a field in a closed section is otherwise unfocusable. */
export function revealAndFocus(el: HTMLElement | null | undefined) {
  if (!el) return;
  for (let d = el.closest("details"); d; d = d.parentElement?.closest("details") ?? null) (d as HTMLDetailsElement).open = true;
  el.focus();
}
