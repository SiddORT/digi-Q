/**
 * Normalise scanned, uploaded or pasted appointment QR text to the opaque payload the server validates.
 * Same trust rule as components/patient-qr.ts: links are accepted only on this site's origin (relative links are
 * resolved against it), never followed. Raw tokens pass through; the server still verifies signature and freshness.
 */
export type StaffQrResult = { payload: string } | { error: string };
export function staffQrPayload(value: string, origin: string, basePath = ""): StaffQrResult {
  const text = value.trim();
  if (!text) return { error: "Paste the appointment QR text or link first." };
  const looksLikeLink = /^[a-z][a-z0-9+.-]*:/i.test(text) || text.startsWith("/") || text.startsWith("?") || /^check-in(\/|\?|$)/.test(text);
  if (!looksLikeLink) return { payload: text };
  let url: URL;
  try { url = new URL(text.startsWith("check-in") ? `/${text}` : text, origin); } catch { return { error: "This link could not be read. Paste the full check-in link or QR text." }; }
  if (url.origin !== origin || url.username || url.password) return { error: "This link is not from this clinic workspace. Only this site's appointment QR links can be validated." };
  const base = basePath.replace(/\/$/, "");
  const path = base && url.pathname.startsWith(`${base}/`) ? url.pathname.slice(base.length) : url.pathname;
  if (!/^\/check-in\/?$/.test(path)) return { error: "This is not an appointment check-in link." };
  const payload = url.searchParams.get("payload");
  return payload ? { payload } : { error: "This check-in link has no appointment code." };
}
