/** Pure workspace-location rules shared by the selector and its tests. */
export type WorkspaceBranchOption = { id: string; clinicId: string; name: string; clinicName: string };

/** Pages whose data is filtered to the selected location. Global management pages (clinics, locations,
 *  users, settings, masters, audit, templates, permissions, integrations, QR codes) are never restricted. */
export const BRANCH_SCOPED_PAGES = ["dashboard", "appointments", "queue", "book", "availability", "exceptions", "patients", "reports"];

/** Staff roles that work at a location. Patients, guests (no identity) and super admins are never scoped. */
export function branchSelectorMode(role?: string | null): "off" | "on" {
  return role === "doctor" || role === "receptionist" || role === "clinicAdmin" ? "on" : "off";
}

export const workspaceBranchKey = (userId: string) => `dq.workspace.branch.${userId}`;

/** A remembered choice is used only if it is still in the authorized active list; otherwise the first location. */
export function resolveSavedBranch(saved: string, branches: WorkspaceBranchOption[]): string {
  if (saved && branches.some(b => b.id === saved)) return saved;
  return branches[0]?.id || "";
}

/** Query keys that depend on a location; removed on switch so no page restores the previous location, doctor or session. */
export const SCOPED_QUERY_KEYS = ["clinic", "branch", "doctor", "clinicId", "branchId", "doctorId", "sessionId", "startTime", "appointment", "page"];
export function scopedQueryStrip(search: string): string {
  const params = new URLSearchParams(search);
  for (const key of SCOPED_QUERY_KEYS) params.delete(key);
  return params.toString();
}
