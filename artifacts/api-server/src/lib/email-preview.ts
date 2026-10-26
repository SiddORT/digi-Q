import { loadLogoBytes } from "./logo-bytes";

/** Only the validated internal logo selected by an already-authorized template
 * request is read. Never return a private storage path or remote-fetch a logo. */
export async function emailPreviewHtml(rendered: { html: string; logoPath?: string },
  load: typeof loadLogoBytes = loadLogoBytes) {
  if (!rendered.logoPath) return rendered.html;
  try {
    const bytes = await load(rendered.logoPath);
    if (bytes.length > 2 * 1024 * 1024) throw new Error("Logo too large");
    return rendered.html.replace('src="cid:clinic-logo"', `src="data:image/png;base64,${bytes.toString("base64")}"`);
  } catch {
    // Failed image preparation must be visible without leaking storage details.
    return rendered.html.replace(/<img\b[^>]*src="cid:clinic-logo"[^>]*>/g,
      '<div style="color:#596780;font-size:12px">Clinic logo unavailable in preview</div>');
  }
}
