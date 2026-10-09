/** Pure policy helpers for notifications, workspaces, saved views and documents. No I/O. */

export const QUEUE_STATUSES = new Set(["checkedIn", "waiting", "called", "inConsultation"]);
export function notificationKind(toStatus: string, booking = false): "queue" | "appointments" {
  if (booking) return "appointments";
  return QUEUE_STATUSES.has(toStatus) ? "queue" : "appointments";
}

/**
 * Narrow a resolved user to one active clinic. Never expands: the clinic must already be
 * assigned; branch IDs are filtered to that clinic. Super admins and patients are unchanged.
 */
export function narrowToWorkspace<T extends { role: string; clinicIds: string[]; branchIds: string[] }>(user: T, activeClinicId: string | null | undefined, branchClinic: Map<string, string>): T & { activeClinicId: string | null } {
  if (!activeClinicId || user.role === "superAdmin" || user.role === "patient" || user.clinicIds.length < 2 || !user.clinicIds.includes(activeClinicId))
    return { ...user, activeClinicId: null };
  return { ...user, clinicIds: [activeClinicId], branchIds: user.branchIds.filter(b => branchClinic.get(b) === activeClinicId), activeClinicId };
}

export const VIEW_TABLE_KEY = /^[a-z][a-z0-9-]{0,59}$/;
export const VIEW_FILTER_KEY = /^[a-zA-Z][a-zA-Z0-9]{0,39}$/;
export const VIEW_SAFE_VALUE = /^[A-Za-z0-9_\-:.,]{1,80}$/;
export const UNSAFE_VIEW_KEYS = new Set(["search", "q", "page", "name", "fullName", "email", "mobile", "phone", "patientName", "reference"]);
const COLUMN = /^[a-zA-Z][a-zA-Z0-9_-]{0,59}$/;
export const SHARE_ROLES = new Set(["superAdmin", "clinicAdmin"]);
export const SHARED_STAFF_ROLES = new Set(["clinicAdmin", "doctor", "receptionist"]);
/** Clinic admins share with all staff of their clinics (there is one admin per clinic); super admins share with super admins. */
export const shareAudience = (role: string) => role === "superAdmin" ? "superAdmin" : "staff";
export function receivesSharedView(viewerRole: string, sharedRole: string | null) {
  if (!sharedRole) return false;
  return sharedRole === "staff" ? SHARED_STAFF_ROLES.has(viewerRole) : sharedRole === viewerRole;
}

/** Drops anything that could carry free text (possible PHI). Throws on invalid table key/name. */
export function sanitizeSavedView(input: { tableKey: string; name: string; filters?: Record<string, unknown>; columns?: { order?: unknown; hidden?: unknown; pinned?: unknown } }) {
  if (!VIEW_TABLE_KEY.test(input.tableKey)) throw new Error("Invalid table");
  const name = String(input.name || "").trim().slice(0, 60);
  if (!name) throw new Error("Enter a view name");
  const filters: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.filters || {}).slice(0, 30)) {
    if (UNSAFE_VIEW_KEYS.has(k) || !VIEW_FILTER_KEY.test(k)) continue;
    if (typeof v === "string" && VIEW_SAFE_VALUE.test(v)) filters[k] = v;
  }
  const cols = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && COLUMN.test(x)).slice(0, 40) : [];
  const columns = input.columns ? { order: cols(input.columns.order), hidden: cols(input.columns.hidden), pinned: typeof input.columns.pinned === "string" && COLUMN.test(input.columns.pinned) ? input.columns.pinned : null } : undefined;
  return { tableKey: input.tableKey, name, filters, columns };
}

export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain"] as const;
/** Detect type from magic bytes; the client-declared type is never trusted. */
export function sniffDocument(bytes: Buffer): (typeof DOCUMENT_TYPES)[number] | null {
  if (!bytes.length || bytes.length > DOCUMENT_MAX_BYTES) return null;
  const head = bytes.subarray(0, 12);
  if (head.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  if (head.subarray(0, 4).toString("latin1") === "RIFF" && head.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  // Plain text: valid UTF-8 with no control bytes other than tab/newline/carriage return.
  const text = bytes.toString("utf8");
  if (Buffer.from(text, "utf8").equals(bytes) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) return "text/plain";
  return null;
}
export function safeDocumentName(name: string) {
  const cleaned = String(name || "").replace(/[\\/\u0000-\u001f"<>|:*?]/g, "_").replace(/^[._\s]+/, "").trim().slice(0, 160);
  return cleaned || "document";
}
