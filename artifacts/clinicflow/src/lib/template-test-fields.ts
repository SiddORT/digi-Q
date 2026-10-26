import { notificationVariableField } from "@workspace/api-zod/notification-variable-contract";
import { formatDate, formatTime, isCanonicalDate, isCanonicalTime, type DateTimePreferences } from "./date-time.ts";

/** Test API accepts already-rendered values, just like dispatch. Never create an instant from a session clock. */
export function templateTestValue(name: string, value: string, preferences: DateTimePreferences) {
  const kind = notificationVariableField(name).kind;
  return !value ? "" : kind === "date" ? isCanonicalDate(value) ? formatDate(value, preferences) : ""
    : kind === "time" ? isCanonicalTime(value) ? formatTime(value, preferences) : "" : value;
}
