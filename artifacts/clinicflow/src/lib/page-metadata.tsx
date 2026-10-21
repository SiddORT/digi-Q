import { useLayoutEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { homeMetadata, PRIVATE_PAGE_METADATA } from "@workspace/api-zod/public-page";
import { usePublicWebsite } from "./public-website";

export function setMeta(attribute: "name" | "property", key: string, content: string) {
  const nodes = [...document.head.querySelectorAll<HTMLMetaElement>(`meta[${attribute}="${key}"]`)];
  let node = nodes.shift();
  nodes.forEach(duplicate => duplicate.remove());
  if (!node) { node = document.createElement("meta"); node.setAttribute(attribute, key); document.head.append(node); }
  node.content = content;
}
export function setPageMetadata(title: string, description: string, canonical?: string) {
  document.title = title;
  [...document.head.querySelectorAll("title")].slice(1).forEach(node => node.remove());
  setMeta("name", "description", description);
  for (const prefix of ["og", "twitter"]) {
    setMeta(prefix === "og" ? "property" : "name", `${prefix}:title`, title);
    setMeta(prefix === "og" ? "property" : "name", `${prefix}:description`, description);
  }
  document.head.querySelectorAll('link[rel="canonical"], meta[property="og:url"]').forEach(node => node.remove());
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
  const site = usePublicWebsite();
  useLayoutEffect(() => {
    const metadata = path === "/" && !search ? homeMetadata(site.origin) : PRIVATE_PAGE_METADATA;
    setMeta("name", "robots", metadata.robots);
    setPageMetadata(metadata.title, metadata.description, metadata.canonical);
  }, [path, search, site.origin]);
  return null;
}
