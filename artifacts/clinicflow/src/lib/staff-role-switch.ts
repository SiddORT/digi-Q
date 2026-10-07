/** Add Staff role switching: which values carry over and whether anything would be discarded. */
export const SHARED_STAFF_FIELDS = ["fullName", "email", "mobile"] as const;
export type SharedStaff = Partial<Record<(typeof SHARED_STAFF_FIELDS)[number], string>>;

const filled = (value: unknown) => Array.isArray(value) ? value.length > 0 : typeof value === "number" ? !Number.isNaN(value) : typeof value === "string" ? value.trim() !== "" : value != null && value !== false;
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * values: current form values. defaults: values the role-specific form started with (e.g. a fixed clinic).
 * Returns the shared fields to keep and whether role-specific input would be lost by switching.
 */
export function planRoleSwitch(values: Record<string, unknown>, defaults: Record<string, unknown> = {}, opaqueDirty = false) {
  const shared: SharedStaff = {};
  for (const key of SHARED_STAFF_FIELDS) { const value = values[key]; if (typeof value === "string" && value.trim()) shared[key] = value; }
  const ignored = new Set<string>([...SHARED_STAFF_FIELDS, "status"]);
  const discards = opaqueDirty || Object.entries(values).some(([key, value]) => !ignored.has(key) && filled(value) && !same(value, defaults[key]));
  return { shared, discards };
}
