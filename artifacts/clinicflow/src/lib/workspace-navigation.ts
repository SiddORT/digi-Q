import { clinicWorkspaceHref } from "./clinic-navigation";

/** Destinations describe existing functions, not permissions. Callers still gate
 * discovery by the actual account role; the server owns record authorization. */
export function workspaceHref(role: string, page: string, values: Record<string, string> = {}): string {
  const query = new URLSearchParams(values);
  let path = `/${role}/${page}`;
  if (page === "staff") return staffHref(role, values.tab || (role === "doctor" ? "receptionists" : "doctors"), values);
  if (role === "admin") {
    if (page === "clinic") path = "/admin/clinics";
    if (page === "users" && query.has("tab")) path = "/admin/staff";
    if (["audit", "masters", "integrations", "demo"].includes(page)) {
      path = "/admin/settings"; query.set("area", page);
    }
    if (page === "branches" && query.has("clinicId")) {
      const id = query.get("clinicId")!;
      query.delete("clinicId");
      return clinicWorkspaceHref(id, "locations", query.toString());
    }
  }
  if (role === "doctor" && ["users", "qrs", "branches"].includes(page)) {
    path = "/doctor/clinics";
    query.set("area", page === "users" ? "staff" : page === "qrs" ? "qrs" : "clinics");
  }
  return `${path}${query.size ? `?${query}` : ""}`;
}

export function staffHref(role: string, tab: string, values: Record<string, string> = {}): string {
  return workspaceHref(role, "users", { ...values, tab });
}

/** A nested workspace is discoverable even when it has no sidebar item.
 * Never use these client hints as server authorization or retry a rejected
 * scoped request against an alternate broader endpoint. */
export function workspaceFunctions(actualRole: string): string[] {
  const care = ["dashboard", "appointments", "queue", "patients", "availability", "profile", "book"];
  switch (actualRole) {
    case "superAdmin": return [...care, "clinics", "staff", "users", "branches", "qrs", "reports", "communication", "templates", "settings", "masters", "audit", "integrations", "demo"];
    case "clinicAdmin": return [...care, "clinics", "staff", "branches", "qrs", "reports", "templates"];
    case "doctor": return [...care, "clinics", "staff", "qrs"];
    case "receptionist": return care;
    case "patient": return ["dashboard", "book", "appointments", "queue", "profile"];
    default: return [];
  }
}
