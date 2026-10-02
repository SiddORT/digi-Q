/**
 * Central error translator (spec §7.8, findings 20/40/41).
 * Never returns HTTP status lines, stack traces, JSON or raw provider text.
 * Human validation messages from the API (4xx bodies) are preserved.
 */
export type ErrorContext = "save" | "load" | "delete" | "auth" | "generic";

export const FRIENDLY = {
  sessionExpired: "Session expired. Please sign in again.",
  accessDenied: "Access denied. You do not have permission to do this.",
  notFound: "Record not found. It may have been removed.",
  saveFailed: "Unable to save changes. Please try again.",
  loadFailed: "Unable to load data. Please try again.",
  deleteFailed: "Unable to complete this action. Please try again.",
  network: "Unable to reach DigiQ. Check your connection and try again.",
  rateLimited: "Too many attempts. Please wait a moment and try again.",
  generic: "Something went wrong. Please try again.",
} as const;

const RAW_PATTERNS = [
  /\bHTTP\s*\d{3}\b/i, /^\s*\d{3}\b/, /\b(unauthori[sz]ed|forbidden|internal server error|bad gateway|service unavailable)\b/i,
  /\bat\s+\S+\s*\(.*:\d+:\d+\)/, /\b(TypeError|ReferenceError|SyntaxError|ECONN\w+|ETIMEDOUT|ENOTFOUND)\b/,
  /^\s*[{[<]/, /\b(sql|postgres|drizzle|stack|undefined|null is not|cannot read propert)/i,
  /Failed to fetch|NetworkError|Load failed/i, /\bJSON\b/,
];

/** True when text is safe to show verbatim (plain human sentence). */
export function isFriendlyText(text: unknown): text is string {
  if (typeof text !== "string") return false;
  const t = text.trim();
  if (!t || t.length > 240) return false;
  return !RAW_PATTERNS.some((p) => p.test(t));
}

function field(data: unknown, key: string): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const v = (data as Record<string, unknown>)[key];
  return typeof v === "string" ? v : undefined;
}

/** Extract the server's human message (without the "HTTP 400 Bad Request:" prefix). */
export function serverMessage(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const e = error as { data?: unknown; message?: unknown; errors?: Array<{ longMessage?: string; message?: string }> };
  const fromData = field(e.data, "message") ?? field(e.data, "error") ?? field(e.data, "detail") ?? field(e.data, "title")
    ?? (typeof e.data === "string" ? e.data : undefined);
  const fromList = e.errors?.[0]?.longMessage ?? e.errors?.[0]?.message;
  const fromMessage = typeof e.message === "string" ? e.message.replace(/^HTTP\s*\d{3}[^:]*:\s*/i, "") : undefined;
  return [fromData, fromList, fromMessage].find(isFriendlyText);
}

export function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const s = (error as { status?: unknown }).status;
  if (typeof s === "number") return s;
  const m = typeof (error as { message?: unknown }).message === "string" ? /^HTTP\s*(\d{3})/i.exec((error as { message: string }).message) : null;
  return m ? Number(m[1]) : undefined;
}

const contextFallback = (c: ErrorContext) =>
  c === "save" ? FRIENDLY.saveFailed : c === "load" ? FRIENDLY.loadFailed : c === "delete" ? FRIENDLY.deleteFailed : FRIENDLY.generic;

/** Map any thrown value to friendly user-facing text. */
export function friendlyError(error: unknown, context: ErrorContext = "generic", fallback?: string): string {
  const status = errorStatus(error);
  const fb = fallback ?? contextFallback(context);
  if (status === 401) return context === "auth" ? serverMessage(error) ?? FRIENDLY.sessionExpired : FRIENDLY.sessionExpired;
  if (status === 403) return serverMessage(error) ?? FRIENDLY.accessDenied;
  if (status === 404) return FRIENDLY.notFound;
  if (status === 429) return FRIENDLY.rateLimited;
  if (status !== undefined && status >= 500) return fb;
  if (error instanceof TypeError && /fetch|network|load failed/i.test(error.message)) return FRIENDLY.network;
  if (typeof error === "string") return isFriendlyText(error) ? error : fb;
  return serverMessage(error) ?? fb;
}

/** Per-field errors returned by the API (`{ fieldErrors: { name: "..." } }` or `{ errors: [{ path, message }] }`). */
export function fieldErrorsFrom(error: unknown): Record<string, string> {
  const data = error && typeof error === "object" ? (error as { data?: unknown }).data : undefined;
  const out: Record<string, string> = {};
  if (!data || typeof data !== "object") return out;
  const fe = (data as { fieldErrors?: Record<string, unknown> }).fieldErrors;
  if (fe && typeof fe === "object") for (const [k, v] of Object.entries(fe)) {
    const msg = Array.isArray(v) ? v[0] : v;
    if (isFriendlyText(msg)) out[k] = msg;
  }
  const list = (data as { errors?: Array<{ path?: unknown; message?: unknown }> }).errors;
  if (Array.isArray(list)) for (const item of list) {
    const key = Array.isArray(item.path) ? String(item.path[0] ?? "") : typeof item.path === "string" ? item.path : "";
    if (key && !out[key] && isFriendlyText(item.message)) out[key] = item.message;
  }
  return out;
}
