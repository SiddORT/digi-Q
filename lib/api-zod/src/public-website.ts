/** Public links are root-hosted; never infer authority from a request or browser. */
export function parsePublicOrigin(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!/^https:\/\/[^/?#\\]+\/*$/i.test(text) || /[\s\\@]/.test(text)) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      !/^\/*$/.test(url.pathname) || !url.hostname) return null;
    return url.origin;
  } catch { return null; }
}

export function publicWebsiteUrl(origin: string, route: string): string {
  const site = parsePublicOrigin(origin);
  if (!site) throw new Error("Public website links are unavailable. Retry or contact the operator.");
  // Stored routes remain unchanged. Absolute input must already belong to this authority.
  if (!route.startsWith("/") && !route.startsWith(`${site}/`)) throw new Error("Untrusted public website link.");
  if (route.startsWith("//") || /[\\\r\n\t]/.test(route)) throw new Error("Invalid public website route.");
  const url = new URL(route, site);
  if (url.origin !== site || url.username || url.password) throw new Error("Untrusted public website link.");
  return url.href;
}
