/** Authorization follows actual server identity, not its displayed role or email address. */
export function isRealSuperAdmin(user?: { role?: string; email?: string; demo?: boolean; demoFixture?: string } | null) {
  return user?.role === "superAdmin" && !user.demo && !user.demoFixture;
}
/** Internal same-origin anchor target, or null for external, new-tab, hash-only or modified clicks. */
export function internalHref(anchor: HTMLAnchorElement, current: Location, base = "") {
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;
  const url = new URL(anchor.href, current.href);
  if (url.origin !== current.origin) return null;
  if (url.pathname === current.pathname && url.search === current.search) return null;
  const b = base.replace(/\/$/, "");
  const path = b && url.pathname.startsWith(b) ? url.pathname.slice(b.length) || "/" : url.pathname;
  return { path: `${path}${url.search}${url.hash}`, pathname: path };
}
