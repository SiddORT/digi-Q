import { useEffect, useSyncExternalStore } from "react";
import { getPublicWebsiteConfig } from "@workspace/api-client-react";
import { parsePublicOrigin, publicWebsiteUrl } from "@workspace/api-zod/public-website";

type State = { origin: string | null; loading: boolean; error: boolean };
let state: State = { origin: null, loading: true, error: false };
let pending: Promise<string> | undefined;
const listeners = new Set<() => void>();
const publish = (next: State) => { state = next; listeners.forEach(listener => listener()); };
export function loadPublicWebsite(): Promise<string> {
  if (pending) return pending;
  publish({ origin: null, loading: true, error: false });
  pending = getPublicWebsiteConfig({ signal: AbortSignal.timeout(10000), cache: "no-store" })
    .then(config => {
      const origin = parsePublicOrigin(config.publicOrigin);
      if (!origin) throw new Error("Invalid public website configuration.");
      publish({ origin, loading: false, error: false });
      return origin;
    }).catch(() => {
      publish({ origin: null, loading: false, error: true });
      throw new Error("Public website links are unavailable. Retry this action or contact the operator.");
    }).finally(() => { pending = undefined; });
  return pending;
}
export function usePublicWebsite() {
  const current = useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => state, () => state);
  useEffect(() => { if (state.loading && !pending) void loadPublicWebsite().catch(() => {}); }, []);
  return { ...current, retry: () => { void loadPublicWebsite().catch(() => {}); },
    url: (route: string): string | undefined => {
      try { return current.origin ? publicWebsiteUrl(current.origin, route) : undefined; } catch { return undefined; }
    } };
}
/** Async exports must never use a browser-host fallback or a missing configuration. */
export async function absolutePublicUrl(route: string) {
  const origin = state.origin ?? await loadPublicWebsite();
  return publicWebsiteUrl(origin, route);
}
export function PublicWebsiteStatus() {
  const site = usePublicWebsite();
  if (site.origin) return null;
  return <div role={site.loading ? "status" : "alert"} className="notice">
    {site.loading ? "Loading public website links…" : "Public website links are unavailable. Other work can continue."}
    {!site.loading && <button type="button" onClick={site.retry}>Retry Public Links</button>}
  </div>;
}
export function PublicWebsiteLink({ route }: { route: string }) {
  const site = usePublicWebsite();
  return site.origin ? <>{site.url(route) || "Enter a valid URL name to preview this link."}</> : <PublicWebsiteStatus/>;
}
