/**
 * Approved interface glossary. Each known action phrase has exactly one label form, so the same term
 * never appears in two casings. titleCase() applies these first; static JSX labels use the same forms.
 * Sentence-case help text and errors are not affected ("Check in only when…" stays a sentence).
 */
export const UI_GLOSSARY: readonly string[] = [
  "Sign In", "Sign Out", "Sign Up", "Log In", "Log Out", "Check In", "Check Out",
  "Set Up", "Book Appointment", "Book Now", "Book a Visit", "Try Again", "View All", "Load More", "Load More Options",
  "Roles & Permissions", "Reset to Default", "Save Changes", "Save Draft", "Review Changes", "Return Home",
  "Export CSV", "Export Selected CSV", "Download QR", "Retry QR", "More Actions", "Skip Absent",
];
const sorted = [...UI_GLOSSARY].sort((a, b) => b.length - a.length);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pattern = new RegExp(`(^|[^A-Za-z-])(${sorted.map(escape).join("|")})(?=$|[^A-Za-z-])`, "gi");
/** Rewrites any glossary phrase to its approved casing. */
export function applyGlossary(label: string): string {
  return label.replace(pattern, (_m, lead: string, term: string) => lead + (sorted.find(t => t.toLowerCase() === term.toLowerCase()) ?? term));
}
