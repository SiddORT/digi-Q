import { useCallback, useRef, useState } from "react";
import type { Validator } from "@/lib/validators";

export type Rules<T> = Partial<Record<keyof T & string, Validator | Validator[]>>;
export type Errors<T> = Partial<Record<keyof T & string, string>>;

/** Pure: run rules over trimmed values. */
export function validateValues<T extends Record<string, unknown>>(values: T, rules: Rules<T>): Errors<T> {
  const errors: Errors<T> = {};
  for (const key of Object.keys(rules) as Array<keyof T & string>) {
    const list = ([] as Validator[]).concat(rules[key] ?? []);
    const raw = values[key];
    const v = typeof raw === "string" ? raw.trim() : raw;
    for (const fn of list) { const m = fn(v); if (m) { errors[key] = m; break; } }
  }
  return errors;
}

/** Trim every string value (spaces-only becomes ""). */
export const trimAll = <T extends Record<string, unknown>>(values: T): T =>
  Object.fromEntries(Object.entries(values).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v])) as T;

/**
 * Validate on submit, focus first invalid field, keep values, revalidate corrected fields (spec §7.3).
 * Fields are located by `[name="key"]` or `#id` inside the form ref.
 */
export function useFormValidation<T extends Record<string, unknown>>(rules: Rules<T>) {
  const [errors, setErrors] = useState<Errors<T>>({});
  const submitted = useRef(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const rulesRef = useRef(rules); rulesRef.current = rules;

  const focusFirst = useCallback((errs: Errors<T>) => {
    const order = Object.keys(rulesRef.current);
    const first = order.find((k) => errs[k as keyof T & string]);
    if (!first) return;
    const root: ParentNode = formRef.current ?? document;
    const el = root.querySelector<HTMLElement>(`[name="${CSS.escape(first)}"], #${CSS.escape(first)}, [data-field="${CSS.escape(first)}"]`);
    el?.focus();
  }, []);

  /** Returns trimmed values when valid, otherwise null (and focuses the first invalid field). */
  const validate = useCallback((values: T): T | null => {
    submitted.current = true;
    const errs = validateValues(values, rulesRef.current);
    setErrors(errs);
    if (Object.keys(errs).length) { requestAnimationFrame(() => focusFirst(errs)); return null; }
    return trimAll(values);
  }, [focusFirst]);

  /** Call from onChange: once submitted, revalidates only that field. */
  const revalidate = useCallback((key: keyof T & string, value: unknown) => {
    if (!submitted.current) return;
    const m = validateValues({ [key]: value } as T, { [key]: rulesRef.current[key] } as Rules<T>)[key];
    setErrors((prev) => (prev[key] === m ? prev : { ...prev, [key]: m }));
  }, []);

  const setServerErrors = useCallback((errs: Errors<T>) => { setErrors((p) => ({ ...p, ...errs })); requestAnimationFrame(() => focusFirst(errs)); }, [focusFirst]);
  const reset = useCallback(() => { submitted.current = false; setErrors({}); }, []);

  return { errors, validate, revalidate, setServerErrors, reset, formRef };
}
