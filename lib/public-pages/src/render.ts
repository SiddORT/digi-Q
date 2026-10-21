import {
  homeMetadata, PRIVATE_PAGE_METADATA, publicClinicMetadata, publicPageRoute,
  type PageMetadata, type PublicPlace,
} from "@workspace/api-zod/public-page";

export type PublicIdentity = { clinic: PublicPlace; branch?: PublicPlace };
export type IdentityLookup = (clinicSlug: string, branchSlug?: string) => Promise<PublicIdentity | null>;
export type RenderedPage = { html: string; status: number; metadata: PageMetadata };
export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Controlled public rendering, not a serialized API response or signed-in SSR.
 * The input template is our own Vite shell; strip owned tags before inserting one set. */
export function injectMetadata(template: string, metadata: PageMetadata, identity?: PublicIdentity): string {
  const clean = template
    .replace(/<title\b[^>]*>[\s\S]*?<\/title\s*>/gi, "")
    .replace(/<meta\b[^>]*(?:name|property)\s*=\s*["'](?:description|robots|og:(?:title|description|url)|twitter:(?:title|description))["'][^>]*>/gi, "")
    .replace(/<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*>/gi, "");
  const tag = (attr: string, key: string, value: string) => `<meta ${attr}="${key}" content="${escapeHtml(value)}" />`;
  const tags = [
    `<title>${escapeHtml(metadata.title)}</title>`,
    tag("name", "description", metadata.description), tag("name", "robots", metadata.robots),
    tag("property", "og:title", metadata.title), tag("property", "og:description", metadata.description),
    tag("name", "twitter:title", metadata.title), tag("name", "twitter:description", metadata.description),
    ...(metadata.canonical ? [`<link rel="canonical" href="${escapeHtml(metadata.canonical)}" />`, tag("property", "og:url", metadata.canonical)] : []),
  ].join("\n");
  const html = clean.replace(/<\/head\s*>/i, `${tags}\n</head>`);
  // React replaces this public-only fallback on startup. No IDs, doctors, QR,
  // appointments, contacts, credentials or request data are embedded.
  return identity ? html.replace('<div id="root"></div>',
    `<div id="root"><main><h1>${escapeHtml([identity.branch?.name, identity.clinic.name].filter(Boolean).join(" · "))}</h1><p>${escapeHtml(metadata.description)}</p></main></div>`) : html;
}

export async function renderPublicPage(rawUrl: string, template: string, lookup: IdentityLookup, origin: unknown): Promise<RenderedPage> {
  const route = publicPageRoute(rawUrl);
  let metadata: PageMetadata = { ...PRIVATE_PAGE_METADATA }, status = 200;
  let identity: PublicIdentity | undefined;
  if (route.kind === "home") metadata = homeMetadata(origin);
  if (route.kind === "missing") {
    status = 404;
    metadata = { ...PRIVATE_PAGE_METADATA, title: "Page not found | DigiQ Doctors" };
  }
  if (route.kind === "clinic") {
    try {
      const found = await lookup(route.clinicSlug, route.branchSlug);
      if (!found) {
        status = 404;
        metadata = { ...PRIVATE_PAGE_METADATA, title: "Clinic page not found | DigiQ Doctors" };
      } else {
        identity = found;
        metadata = publicClinicMetadata(found.clinic, found.branch, route.path, origin);
      }
    } catch {
      // Infrastructure failures must not masquerade as a missing clinic or
      // fall through to an indexable, stale success shell.
      status = 503;
      metadata = { ...PRIVATE_PAGE_METADATA, title: "Clinic page unavailable | DigiQ Doctors" };
    }
  }
  return { html: injectMetadata(template, metadata, identity), status, metadata };
}
