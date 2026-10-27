import { parsePublicOrigin, publicWebsiteUrl } from "./public-website";

export const PRIVATE_PAGE_METADATA: PageMetadata = {
  title: "Secure workspace | DigiQ Doctors",
  description: "Secure DigiQ Doctors workspace.",
  robots: "noindex, nofollow",
};
export const reservedPublicPaths = new Set([
  "api", "admin", "auth", "login", "logout", "register", "signup", "sign-in", "sign-up",
  "onboarding", "dashboard", "clinics", "branches", "doctors", "patients", "appointments",
  "queue", "settings", "reports", "users", "masters", "schedules", "availability",
  "booking", "book", "display", "qr", "public", "guest", "invite", "invitations",
  "forgot-password", "reset-password", "account", "me", "assets", "favicon",
  "__mockup", "clinicflow-project-deck", "register-clinic", "register-doctor",
  "patient-login", "demo-login", "scan-qr", "guest-booking", "set-password", "check-in",
  "doctor", "patient", "receptionist", "audit", "qrs", "exceptions", "health", "healthz",
  "robots", "sitemap", "live-ticket",
]);
// Match the saved-slug contract, including existing consecutive hyphens.
export function validPublicSlug(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/.test(value) && !reservedPublicPaths.has(value);
}
export type PublicPageRoute =
  | { kind: "home"; path: "/" }
  | { kind: "clinic"; path: string; clinicSlug: string; branchSlug?: string }
  | { kind: "private" | "missing" };
export function publicPageRoute(rawUrl: string): PublicPageRoute {
  const [pathname, search = ""] = rawUrl.split("?");
  const parts = pathname.replace(/\/$/, "").split("/").slice(1);
  // Never interpret opaque references or credentials as public clinic identity.
  if (reservedPublicPaths.has(parts[0])) return { kind: "private" };
  if (!pathname.startsWith("/") || /[%\\#]/.test(pathname)) return { kind: "missing" };
  const params = new URLSearchParams(search);
  const directoryKeys = new Set(["search", "page", "pageSize", "sort"]);
  let privateQuery = false;
  params.forEach((_value, key) => { if (!directoryKeys.has(key)) privateQuery = true; });
  if (privateQuery) return { kind: "private" };
  if (pathname === "/") return { kind: "home", path: "/" };
  if (parts.length < 1 || parts.length > 2 || !parts.every(validPublicSlug)) return { kind: "missing" };
  return { kind: "clinic", path: `/${parts.join("/")}`, clinicSlug: parts[0], branchSlug: parts[1] };
}
export type PublicPlace = { name: string; address?: string | null; city?: string | null };
export type PageMetadata = { title: string; description: string; robots: string; canonical?: string };
export function publicClinicMetadata(clinic: PublicPlace, branch: PublicPlace | undefined, path: string, origin: unknown): PageMetadata {
  const place = [branch?.name, clinic.name].filter(Boolean).join(" · ");
  const address = [branch?.address || clinic.address, branch?.city].filter(Boolean).join(", ");
  const configuredOrigin = parsePublicOrigin(origin);
  return {
    title: `${place} | DigiQ Doctors`,
    description: `Visit ${place}${address ? ` at ${address}` : ""}. Find care specialists, clinic information and available booking options.`,
    robots: configuredOrigin ? "index, follow" : "noindex, nofollow",
    canonical: configuredOrigin ? publicWebsiteUrl(configuredOrigin, path) : undefined,
  };
}
export function homeMetadata(origin: unknown): PageMetadata {
  const configuredOrigin = parsePublicOrigin(origin);
  return {
    title: "DigiQ Doctors | Know. Plan. Arrive. Consult.",
    description: "Find your clinic, book appointments and follow your place in the queue.",
    robots: configuredOrigin ? "index, follow" : "noindex, nofollow",
    canonical: configuredOrigin ? publicWebsiteUrl(configuredOrigin, "/") : undefined,
  };
}
