// Only the site's public booking links are valid patient QR destinations.
// In particular, appointment check-in QRs are staff-only and must not be accepted here.
const reserved = new Set([
  "admin", "doctor", "receptionist", "patient", "api", "auth", "sign-in", "sign-up",
  "login", "logout", "register", "register-clinic", "register-doctor", "onboarding",
  "patient-login", "scan-qr", "guest-booking", "forgot-password", "set-password",
  "check-in", "display", "book", "settings", "users", "assets", "public", "health",
  "healthz", "favicon", "robots", "sitemap", "clinics", "branches", "appointments",
  "patients", "queue", "reports", "masters", "audit", "qrs", "availability",
  "exceptions", "signup", "dashboard", "doctors", "schedules", "booking", "qr",
  "guest", "invite", "invitations", "reset-password", "account", "me",
  "clinicflow-project-deck", "__mockup",
]);
export function patientBookingPath(value: string, origin: string, basePath = ""): string | null {
  let url: URL;
  try { url = new URL(value.trim()); } catch { return null; }
  if (url.origin !== origin || url.username || url.password) return null;
  const base = basePath.replace(/\/$/, "");
  const path = base && url.pathname.startsWith(`${base}/`) ? url.pathname.slice(base.length) : !base ? url.pathname : "";
  if (!path) return null;
  if (/^\/book\/[A-Za-z0-9_-]+\/?$/.test(path) && !url.search && !url.hash) return `${path}`;
  if (/^\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/.test(path) && url.searchParams.get("book") === "1" && url.searchParams.size === 1 && !url.hash) {
    const [, clinicSlug, branchSlug] = path.split("/");
    if (!reserved.has(clinicSlug) && !reserved.has(branchSlug)) return `${path}?book=1`;
  }
  return null;
}