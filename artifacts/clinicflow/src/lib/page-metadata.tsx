import { useLayoutEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { BRAND_NAME } from "../branding";

export function setMeta(attribute: "name" | "property", key: string, content: string) {
  let node = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!node) { node = document.createElement("meta"); node.setAttribute(attribute, key); document.head.append(node); }
  node.content = content;
}
export function setPageMetadata(title: string, description: string, canonical?: string) {
  document.title = title;
  setMeta("name", "description", description);
  for (const prefix of ["og", "twitter"]) {
    setMeta(prefix === "og" ? "property" : "name", `${prefix}:title`, title);
    setMeta(prefix === "og" ? "property" : "name", `${prefix}:description`, description);
  }
  document.head.querySelector('link[rel="canonical"]')?.remove();
  document.head.querySelector('meta[property="og:url"]')?.remove();
  if (canonical) {
    const link = document.createElement("link"); link.rel = "canonical"; link.href = canonical; document.head.append(link);
    setMeta("property", "og:url", canonical);
  }
}
/** Fail closed until an actual public clinic response supplies page-specific metadata.
 * This is crawler guidance only; server authorization remains mandatory. */
export function RouteMetadataBoundary() {
  const [path] = useLocation();
  const search = useSearch();
  useLayoutEffect(() => {
    setMeta("name", "robots", path === "/" ? "index, follow" : "noindex, nofollow");
    const label = path.startsWith("/admin/clinics/") ? "Clinic" : path.split("/").filter(Boolean).at(-1)?.replaceAll("-", " ") || "Know. Plan. Arrive. Consult.";
    setPageMetadata(`${label.charAt(0).toUpperCase()}${label.slice(1)} | ${BRAND_NAME}`,
      path === "/" ? "Find your clinic, book appointments and follow your place in the queue." : `Secure ${BRAND_NAME} workspace.`);
  }, [path, search]);
  return null;
}
