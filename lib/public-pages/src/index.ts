import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import type { IncomingMessage, ServerResponse } from "node:http";
import { renderPublicPage, type IdentityLookup } from "./render";
export { renderPublicPage, injectMetadata } from "./render";

/** An explicit, public-only projection. Never reuse the directory response:
 * it also contains operational data such as QR references and live sessions. */
export const lookupPublicIdentity: IdentityLookup = async (clinicSlug, branchSlug) => {
  const result = await db.execute(branchSlug
    ? sql`select c.data->>'name' as clinic_name, c.data->>'address' as clinic_address,
          b.data->>'name' as branch_name, b.data->>'address' as branch_address,
          b.data->>'city' as branch_city
        from clinics c join branches b on b.clinic_id=c.id
        where c.status='active' and b.status='active'
          and c.data->>'slug'=${clinicSlug} and b.data->>'slug'=${branchSlug} limit 1`
    : sql`select data->>'name' as clinic_name, data->>'address' as clinic_address
        from clinics where status='active' and data->>'slug'=${clinicSlug} limit 1`);
  const row = result.rows[0];
  if (!row) return null;
  return {
    clinic: { name: String(row.clinic_name || "Clinic"), address: row.clinic_address as string | null },
    branch: branchSlug ? { name: String(row.branch_name || "Location"), address: row.branch_address as string | null, city: row.branch_city as string | null } : undefined,
  };
};

export function publicHtmlMiddleware(
  loadTemplate: () => Promise<string>,
  transform?: (url: string, html: string) => Promise<string>,
) {
  return async (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => {
    const url = req.url || "/";
    const path = url.split("?")[0];
    // Leave assets and APIs to their existing hosts; /index.html itself is
    // never a public clinic alias. Extensionless paths are document routes.
    if (!["GET", "HEAD"].includes(req.method || "") || path.startsWith("/api/") ||
      /^\/(?:@|src\/|node_modules\/|__)/.test(path) ||
      (path.split("/").at(-1)?.includes(".") && path !== "/index.html")) return next();
    try {
      let page = await renderPublicPage(path === "/index.html" ? "/auth" : url,
        await loadTemplate(), lookupPublicIdentity, process.env.CLINICFLOW_PUBLIC_ORIGIN);
      if (transform) page = { ...page, html: await transform(url, page.html) };
      res.statusCode = page.status;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      // Do not let proxies mix routes, hosts, signed-in requests or old clinic state.
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Robots-Tag", page.metadata.robots);
      if (page.status === 503) res.setHeader("Retry-After", "60");
      res.end(req.method === "HEAD" ? undefined : page.html);
    } catch (error) { next(error); }
  };
}
