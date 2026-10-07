/**
 * Clinic-owned onboarding defaults shown read-only in new staff forms. Values come from the authoritative clinic
 * and location records (no separate defaults store). Only the owning Clinic Admin or a Super Admin may change them,
 * and only through Clinic settings; the server enforces the same rule (routes/resources.ts authorizeWrite).
 */
export type InheritedClinic = { id: string; name: string; adminId?: string; address?: string; area?: string; country?: string; city?: string; state?: string; pincode?: string; email?: string | null; phone?: string | null; dateFormat?: string; timeFormat?: string };
export type InheritedBranch = { id: string; clinicId: string; name: string; address?: string; city?: string; state?: string; pincode?: string; timezone?: string; effectiveEmail?: string | null; effectivePhone?: string | null; openingHours?: { dayOfWeek: number; startTime: string; endTime: string }[] | null };

export const canChangeClinicDefaults = (user: { id?: string; role?: string } | undefined, clinic: { adminId?: string } | undefined) =>
  !!user && (user.role === "superAdmin" || user.role === "clinicAdmin" && !!clinic?.adminId && clinic.adminId === user.id);

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Mon-first weekly summary; consecutive days with identical intervals are grouped. Null = no hour limits; [] = closed all week. */
export function openingHoursSummary(hours: InheritedBranch["openingHours"], fmt: (t: string) => string = t => t): string {
  if (hours == null) return "No hour limits set";
  if (!hours.length) return "Closed all week";
  const order = [1, 2, 3, 4, 5, 6, 0];
  const text = (d: number) => hours.filter(h => h.dayOfWeek === d).sort((a, b) => a.startTime.localeCompare(b.startTime)).map(h => `${fmt(h.startTime)}–${fmt(h.endTime)}`).join(", ") || "Closed";
  const groups: { from: number; to: number; value: string }[] = [];
  for (const d of order) { const value = text(d); const last = groups[groups.length - 1]; if (last && last.value === value) last.to = d; else groups.push({ from: d, to: d, value }); }
  return groups.map(g => `${DAYS[g.from]}${g.from !== g.to ? `–${DAYS[g.to]}` : ""} ${g.value}`).join(" · ");
}
export const addressLine = (r: { address?: string; area?: string; city?: string; state?: string; pincode?: string; country?: string }) => [r.address, r.area, r.city, r.state, r.pincode, r.country].filter(Boolean).join(", ") || "No address";
/** Real Clinic settings route (ClinicSettings reads ?clinicId and ?section) for the owner or a Super Admin. */
export const clinicSettingsHref = (clinicId: string, section: "general" | "locations" | "policies" = "general") =>
  `/admin/clinic?clinicId=${encodeURIComponent(clinicId)}&section=${section}`;
/** Contact source wording without exposing anything beyond the location record the viewer can already read. */
export const contactSource = (b: { inheritEmail?: boolean; inheritPhone?: boolean }) =>
  b.inheritEmail === false && b.inheritPhone === false ? "Location's own contact" : b.inheritEmail === false || b.inheritPhone === false ? "Partly the clinic's contact" : "Clinic's contact";

/** New staff only: when inherited values are shown, the creator confirms reuse instead of retyping. Edits never require it. */
export function inheritedConfirmationError(isNew: boolean, clinicIds: unknown, confirmed: unknown) {
  return isNew && Array.isArray(clinicIds) && clinicIds.length > 0 && confirmed !== true ? "Confirm the inherited clinic details before adding this staff member." : undefined;
}

/** Mirrors server authorizeWrite: fields of an EXISTING clinic/location only the owner or Super Admin may change. */
export const OWNER_ONLY_FIELDS: Record<string, string[]> = {
  clinics: ["name", "address", "city", "state", "pincode", "country", "area", "email", "phone", "slug", "timezone", "dateFormat", "timeFormat", "categoryId", "specialityIds", "referralCode", "bookingHorizonDays", "cancellationCutoffMinutes", "policies"],
  branches: ["name", "slug", "address", "city", "state", "pincode", "country", "area", "email", "phone", "inheritEmail", "inheritPhone", "timezone", "openingHours", "linkedSchedule"],
};
export const ownerOnlyLocked = (resource: string, key: string, isExisting: boolean, isOwner: boolean) =>
  isExisting && !isOwner && !!OWNER_ONLY_FIELDS[resource]?.includes(key);
