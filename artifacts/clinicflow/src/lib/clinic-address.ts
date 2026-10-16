import { errorStatus, serverMessage } from "./friendly-error";

// Match the application paths rejected by the server; availability remains authoritative.
const reserved = new Set(("api admin auth login logout register signup sign-in sign-up onboarding dashboard clinics branches doctors patients appointments queue settings reports users masters schedules availability booking book display qr public guest invite invitations forgot-password reset-password account me assets favicon __mockup clinicflow-project-deck register-clinic register-doctor patient-login scan-qr guest-booking set-password check-in doctor patient receptionist audit qrs exceptions health healthz robots sitemap").split(" "));

export const normalizeClinicSlug = (value: string) => value.toLowerCase().normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "").slice(0, 63).replace(/-+$/g, "");

export function clinicAddressProblem(slug: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 63)
    return "Clinic URL name must use 3–63 lowercase letters, numbers and hyphens between words.";
  if (reserved.has(slug)) return "This Clinic URL name is reserved for the application. Choose a clinic-specific name.";
  return "";
}

/** Blank input is resolved once; custom input is checked, never silently replaced. */
export async function resolveClinicAddress(name: string, input: string, check: (slug: string) => Promise<boolean>, unique = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12)): Promise<string> {
  if (input.trim()) {
    const problem = clinicAddressProblem(input);
    if (problem) throw new Error(problem);
    if (!await check(input)) throw new Error("This Clinic URL name is unavailable. Try adding your city or a distinctive clinic name.");
    return input;
  }
  const normalized = normalizeClinicSlug(name);
  const base = normalized.length < 3 ? (normalized ? `clinic-${normalized}` : "clinic") : normalized;
  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = attempt === 0 ? "" : attempt < 7 ? `-${attempt + 1}` : `-${unique()}`;
    const candidate = `${base.slice(0, 63 - suffix.length).replace(/-+$/g, "")}${suffix}`;
    if (!clinicAddressProblem(candidate) && await check(candidate)) return candidate;
  }
  throw new Error("Could not find an available Clinic URL name. Try again or enter a distinctive Clinic URL name.");
}

export function locationAddressProblem(slug: string): string {
  return clinicAddressProblem(slug).replace(/Clinic URL name/g, "Location URL name").replace("clinic-specific", "location-specific");
}

/** Reserve every explicit (including previously generated) value before resolving blanks.
 * New locations have no saved namespace yet; the creation transaction remains authoritative.
 */
export function resolveLocationAddresses<T extends { name: string; slug: string }>(locations: T[]): T[] {
  const taken = new Set<string>();
  for (const location of locations) {
    if (!location.slug.trim()) continue;
    const problem = locationAddressProblem(location.slug);
    if (problem) throw new Error(problem);
    if (taken.has(location.slug)) throw new Error("Each location needs a different Location URL name.");
    taken.add(location.slug);
  }
  return locations.map(location => {
    if (location.slug.trim()) return location;
    const normalized = normalizeClinicSlug(location.name);
    const base = normalized.length < 3 ? (normalized ? `location-${normalized}` : "location") : normalized;
    // At most locations.length names are occupied, plus one reserved base.
    for (let attempt = 0; attempt < locations.length + 2; attempt++) {
      const suffix = attempt ? `-${attempt + 1}` : "";
      const slug = `${base.slice(0, 63 - suffix.length).replace(/-+$/g, "")}${suffix}`;
      if (!taken.has(slug) && !locationAddressProblem(slug)) {
        taken.add(slug);
        return { ...location, slug };
      }
    }
    throw new Error("Could not generate a Location URL name. Enter a distinctive name and Continue.");
  });
}

/** Only a definite URL rejection gets edit guidance; uncertain creates retain their receipt path. */
export function clinicAddressConflict(error: unknown): boolean {
  return errorStatus(error) === 409 && /public URL is already in use/i.test(serverMessage(error) || "");
}
