/** Keep the return target local and limited to the existing listing route. */
export function clinicsReturnHref(search: string) {
  const target = new URLSearchParams(search).get("returnTo") || "";
  return !/[\\\r\n#]/.test(target) && (target === "/admin/clinics" || target.startsWith("/admin/clinics?"))
    ? target : "/admin/clinics";
}

export function clinicDetailsHref(id: string, listSearch: string) {
  const list = new URLSearchParams(listSearch);
  const params = new URLSearchParams();
  for (const key of ["tab", "open", "staffSearch", "branchId"]) {
    if (list.has(key)) params.set(key === "staffSearch" ? "search" : key, list.get(key)!);
    list.delete(key);
  }
  const section = clinicSection(list.get("section"));
  list.delete("section");
  // A return to Clinics restores its own list, not an editor, nested tab or
  // unrelated workspace's query. Record handoffs above remain separate.
  for (const key of [...list.keys()]) if (!["search","page","pageSize","sort","status","adminId"].includes(key)) list.delete(key);
  params.set("returnTo", `/admin/clinics${list.size ? `?${list}` : ""}`);
  return clinicWorkspaceHref(id, section, params.toString());
}

export const clinicSections = ["details", "locations", "staff", "policies", "activity-history"] as const;
export type ClinicSection = typeof clinicSections[number];
export function clinicSection(value: string | null | undefined): ClinicSection {
  if (value === "qrs" || value === "sessions") return "locations";
  if (value === "history") return "activity-history";
  return clinicSections.includes(value as ClinicSection) ? value as ClinicSection : "details";
}
export function parseClinicWorkspace(path: string, search: string) {
  const match = /^\/admin\/clinics\/([^/]+)(?:\/([^/]+))?\/?$/.exec(path);
  const params = new URLSearchParams(search);
  let clinicId = params.get("clinicId") || "";
  if (match) { try { clinicId = decodeURIComponent(match[1]); } catch { clinicId = ""; } }
  return {clinicId, section: clinicSection(match ? match[2] : params.get("section"))};
}
/** Private identity stays an authoritative ID; public addresses keep their saved slugs. */
export function clinicWorkspaceHref(id: string, section: string = "details", search = "") {
  const params = new URLSearchParams(search);
  params.delete("clinicId"); params.delete("section");
  if (params.has("returnTo")) params.set("returnTo", clinicsReturnHref(search));
  const path = id ? `/admin/clinics/${encodeURIComponent(id)}/${clinicSection(section)}` : "/admin/clinic";
  if (!id) params.set("section", clinicSection(section));
  return `${path}${params.size ? `?${params}` : ""}`;
}

/** Only the context-free Superadmin landing is retired, not section or record links. */
export function clinicLandingDestination(page: string, role: string, search: string) {
  const params = new URLSearchParams(search);
  return page === "clinic" && ["superAdmin", "clinicAdmin"].includes(role) &&
    !["clinicId", "section", "branchId"].some(key => !!params.get(key))
    ? `/admin/clinics${params.size ? `?${params}` : ""}` : null;
}
