/**
 * Shared validators (spec §7.4). Each returns an error message or undefined.
 * All string inputs are trimmed so whitespace-only counts as empty (finding 30).
 */
export type Validator = (value: unknown) => string | undefined;

export const REQUIRED_MESSAGE = "This field is required";
export const PASSWORD_RULE = "At least 8 characters, including letters and numbers.";
export const PASSWORD_MIN_LENGTH = 8;
export const NAME_MIN = 2;
export const NAME_MAX = 100;

export const trimValue = (v: unknown) => (typeof v === "string" ? v.trim() : v);
export const isBlank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

export const required = (message = REQUIRED_MESSAGE): Validator => (v) => (isBlank(v) ? message : undefined);

/** Letters (any script), spaces, hyphen, apostrophe, dot. */
export function validatePersonName(value: unknown, label = "Name"): string | undefined {
  const v = String(trimValue(value) ?? "");
  if (!v) return undefined;
  if (v.length < NAME_MIN) return `${label} must be at least ${NAME_MIN} characters.`;
  if (v.length > NAME_MAX) return `${label} must be ${NAME_MAX} characters or fewer.`;
  if (!/^[\p{L}\p{M}][\p{L}\p{M} .'\u2019-]*$/u.test(v)) return `${label} can contain letters, spaces, hyphens, apostrophes and dots only.`;
  return undefined;
}

export function validateEmail(value: unknown): string | undefined {
  const v = String(trimValue(value) ?? "");
  if (!v) return undefined;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? undefined : "Enter a valid email address, for example name@example.com.";
}

/** International format: + then country code and digits (E.164, 8–15 digits). */
export function normalizePhone(value: unknown): string {
  const v = String(trimValue(value) ?? "");
  const plus = v.startsWith("+");
  const digits = v.replace(/\D/g, "");
  return digits ? `${plus ? "+" : ""}${digits}` : v;
}
export function validatePhone(value: unknown): string | undefined {
  const v = String(trimValue(value) ?? "");
  if (!v) return undefined;
  if (/[^\d\s()+.-]/.test(v)) return "Phone number can contain digits only.";
  const n = normalizePhone(v);
  if (!/^\+[1-9]\d{7,14}$/.test(n)) return "Enter a phone number with country code, for example +91 98765 43210.";
  return undefined;
}

export function validatePassword(value: unknown): string | undefined {
  const v = typeof value === "string" ? value : "";
  if (!v) return undefined;
  if (v.length < PASSWORD_MIN_LENGTH || !/\p{L}/u.test(v) || !/\d/.test(v)) return `Password must be ${PASSWORD_RULE.charAt(0).toLowerCase()}${PASSWORD_RULE.slice(1)}`;
  return undefined;
}
export function passwordChecklist(value: string) {
  return [
    { id: "length", label: `At least ${PASSWORD_MIN_LENGTH} characters`, met: value.length >= PASSWORD_MIN_LENGTH },
    { id: "letter", label: "Contains a letter", met: /\p{L}/u.test(value) },
    { id: "number", label: "Contains a number", met: /\d/.test(value) },
  ];
}

const pad = (n: number) => String(n).padStart(2, "0");
const isoToday = (now: Date) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

/** Expects canonical YYYY-MM-DD. */
export function validateDateOfBirth(value: unknown, now = new Date()): string | undefined {
  const v = String(trimValue(value) ?? "");
  if (!v) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  if (!m || !d || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return "Enter a valid date of birth.";
  if (v > isoToday(now)) return "Date of birth cannot be in the future.";
  return undefined;
}
export function ageFromDateOfBirth(value: unknown, now = new Date()): number | undefined {
  if (validateDateOfBirth(value, now) || isBlank(value)) return undefined;
  const [y, mo, d] = String(value).trim().split("-").map(Number);
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d)) age--;
  return age;
}

export function validateNumberRange(value: unknown, opts: { min?: number; max?: number; integer?: boolean; unit?: string }): string | undefined {
  const raw = typeof value === "string" ? value.trim() : value;
  if (raw === "" || raw === undefined || raw === null) return undefined;
  const n = typeof raw === "number" ? raw : Number(raw);
  const unit = opts.unit ? ` ${opts.unit}` : "";
  if (!Number.isFinite(n)) return "Enter a number.";
  if (opts.integer && !Number.isInteger(n)) return "Enter a whole number.";
  if (opts.min !== undefined && opts.max !== undefined && (n < opts.min || n > opts.max)) return `Enter a value from ${opts.min} to ${opts.max}${unit}.`;
  if (opts.min !== undefined && n < opts.min) return `Enter ${opts.min}${unit} or more.`;
  if (opts.max !== undefined && n > opts.max) return `Enter ${opts.max}${unit} or less.`;
  return undefined;
}

/** Run validators in order; first message wins. */
export const compose = (...validators: Validator[]): Validator => (v) => {
  for (const fn of validators) { const m = fn(v); if (m) return m; }
  return undefined;
};
