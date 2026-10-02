import { toast } from "sonner";
import { friendlyError, type ErrorContext } from "./friendly-error";
import { summarizeBulk, type BulkOutcome } from "./bulk-summary";

/** Toast durations (spec §7.7): success 5 s, warning 8 s, critical persistent until dismissed. */
export const TOAST_DURATION = { success: 5000, warning: 8000, critical: Infinity } as const;

export const notifySuccess = (title: string, description?: string) =>
  toast.success(title, { description, duration: TOAST_DURATION.success });
export const notifyWarning = (title: string, description?: string) =>
  toast.warning(title, { description, duration: TOAST_DURATION.warning });
export const notifyCritical = (title: string, description?: string) =>
  toast.error(title, { description, duration: TOAST_DURATION.critical });
/** Friendly translated error toast. Never raw HTTP text. */
export const notifyError = (error: unknown, context: ErrorContext = "generic", title = "Action failed") =>
  notifyCritical(title, friendlyError(error, context));

/** One consolidated message for a bulk action (finding 79). */
export function notifyBulk(outcomes: BulkOutcome[], verb = "updated") {
  const s = summarizeBulk(outcomes, verb);
  const description = s.failures.length ? (
    <ul className="toast-bulk-failures">{s.failures.slice(0, 6).map((f) => <li key={f}>{f}</li>)}{s.failures.length > 6 && <li>and {s.failures.length - 6} more</li>}</ul>
  ) : undefined;
  const fn = s.tone === "success" ? toast.success : s.tone === "warning" ? toast.warning : toast.error;
  return fn(s.title, { description, duration: TOAST_DURATION[s.tone] });
}
