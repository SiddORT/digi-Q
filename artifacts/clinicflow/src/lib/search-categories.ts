// Pure category model for workspace search (unit tested without React).
export type SearchCategory = "patients" | "appointments" | "staff" | "clinics" | "branches" | "schedules" | "reports" | "audit";
export type SearchTab = "all" | "pages" | SearchCategory;

export const PRIMARY_CATEGORIES: SearchCategory[] = ["patients", "appointments", "staff"];
export const MORE_CATEGORIES: SearchCategory[] = ["clinics", "branches", "schedules", "reports", "audit"];
export const CATEGORY_LABEL: Record<SearchCategory, string> = {
  patients: "Patients", appointments: "Appointments", staff: "Staff", clinics: "Clinic Groups", branches: "Clinics",
  schedules: "Schedules", reports: "Reports", audit: "Audit Logs",
};
/** Results per request: All shows a short preview; a category tab pages in larger, bounded steps. */
export const PREVIEW_SIZE = 3;
export const PAGE_SIZE = 10;
export const MAX_CATEGORY_ROWS = 100;

/** Categories this role may search. Mirrors navigation permissions; the API still enforces scope. */
export function permittedCategories(role: string, navigation: string[]): SearchCategory[] {
  const has = (p: string) => navigation.includes(p);
  if (role === "patient") return has("appointments") ? ["appointments"] : [];
  const out: SearchCategory[] = [];
  if (has("patients")) out.push("patients");
  // One appointment category: today's visits deep-link to the queue session, so no separate queue group duplicates them.
  if (has("appointments") || has("queue")) out.push("appointments");
  if (has("users")) out.push("staff");
  if (has("clinics") && role !== "doctor") out.push("clinics");
  if (has("branches")) out.push("branches");
  if (has("availability")) out.push("schedules");
  if (has("reports")) out.push("reports");
  if (has("audit")) out.push("audit");
  return out;
}

/** Each category is made of one or more independently paged sources. Sources are distinct record types
 *  (e.g. receptionist users, clinic-admin users, doctor profiles), so their API totals never double count
 *  the same record and the category total is their exact sum. */
export type SearchSource = "patients" | "appointments" | "receptionists" | "clinicAdmins" | "doctors" | "clinics" | "branches" | "schedules" | "reportClinics" | "reportDoctors" | "audit";
export const SOURCE_LABEL: Record<SearchSource, string> = {
  patients: "Patients", appointments: "Appointments", receptionists: "Receptionists", clinicAdmins: "Clinic Admins", doctors: "Doctors",
  clinics: "Clinic Groups", branches: "Clinics", schedules: "Schedules", reportClinics: "Clinic Reports", reportDoctors: "Doctor Reports", audit: "Audit Logs",
};
export function categorySources(cat: SearchCategory, role: string): SearchSource[] {
  switch (cat) {
    case "staff": return role === "admin" ? ["receptionists", "clinicAdmins", "doctors"] : ["receptionists"];
    case "reports": return role === "doctor" ? ["reportDoctors"] : ["reportClinics", "reportDoctors"];
    default: return [cat] as SearchSource[];
  }
}
/** Exact sum of per-source totals; null until every source has reported. */
export function categoryTotal(totals: (number | null | undefined)[]) {
  return totals.length && totals.every(t => typeof t === "number") ? (totals as number[]).reduce((a, b) => a + b, 0) : null;
}
/** Beyond the in-dialog cap the user continues in the destination listing, which pages through everything. */
export const reachedCap = (shown: number, total: number | null) => total !== null && shown < total && shown >= MAX_CATEGORY_ROWS;

/** Honest count text: never implies more than the server reported. */
export function countLabel(shown: number, total: number | null) {
  if (total === null) return shown ? `${shown} shown` : "No matches";
  if (!total) return "No matches";
  return shown >= total ? `${total} ${total === 1 ? "match" : "matches"}` : `Showing ${shown} of ${total}`;
}
export const canLoadMore = (shown: number, total: number | null) => total !== null && shown < total && shown < MAX_CATEGORY_ROWS;

/** Exact record links: the destination page opens this record id, the search term only narrows the list. */
export function recordHref(role: string, page: string, id: string, search: string, extra: Record<string, string> = {}) {
  if(role==="admin"&&page==="clinics")return `/admin/clinic?${new URLSearchParams({clinicId:id,...extra})}`;
  const q = new URLSearchParams({ ...(search ? { search } : {}), open: id, ...extra });
  return `/${role}/${page}?${q}`;
}
export function appointmentHref(role: string, a: { id: string; reference: string }) {
  const q = new URLSearchParams({ view: "all", search: a.reference || a.id, appointment: a.id });
  return `/${role}/appointments?${q}`;
}
