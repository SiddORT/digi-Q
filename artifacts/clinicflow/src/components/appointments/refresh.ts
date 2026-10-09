import type { QueryClient } from "@tanstack/react-query";

/** Refresh visit-derived observers without invalidating unrelated profile/editor drafts. */
export function refreshAppointmentObservers(client: QueryClient) {
  return client.invalidateQueries({ predicate: query => query.queryKey.some(key =>
    typeof key === "string" && /^\/api\/(?:appointments(?:\/|$)|public\/availability(?:\/|$)|queue(?:\/|$)|dashboard(?:\/|$)|reports(?:\/|$)|patients\/[^/]+\/activity(?:\/|$)|notifications(?:\/|$)|session-contexts(?:\/|$))/.test(key)
  ) });
}
