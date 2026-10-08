/** Keep the return target local and limited to the existing listing route. */
export function clinicsReturnHref(search: string) {
  const target = new URLSearchParams(search).get("returnTo") || "";
  return target === "/admin/clinics" || target.startsWith("/admin/clinics?")
    ? target : "/admin/clinics";
}

export function clinicDetailsHref(id: string, listSearch: string) {
  const params = new URLSearchParams({ clinicId: id });
  params.set("returnTo", `/admin/clinics${listSearch ? `?${listSearch.replace(/^\?/, "")}` : ""}`);
  return `/admin/clinic?${params}`;
}

/** Only the context-free Superadmin landing is retired, not section or record links. */
export function clinicLandingDestination(page: string, role: string, search: string) {
  const params = new URLSearchParams(search);
  return page === "clinic" && role === "superAdmin" &&
    !["clinicId", "section", "branchId"].some(key => !!params.get(key))
    ? `/admin/clinics${params.size ? `?${params}` : ""}` : null;
}
