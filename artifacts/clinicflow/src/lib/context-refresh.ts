import type { QueryClient } from "@tanstack/react-query";
import { DIRECTORY_FRESH_MS } from "./directory-cache";

const contextKeys = new Set([
  "remote-options", "remote-selected", "selected-care", "operational-cardinality",
  "directory-page", "directory-complete", "directory-detail", "assignment-directory", "workspaces", "workspace-branches",
  "weekly-overview", "editor-session-overlap", "exception-base-sessions",
]);
/** One signed-in refresh owner; never cancel and restart an in-flight read. */
export function refreshSignedInContext(client: QueryClient, periodic = false) {
  return client.invalidateQueries({ predicate: q => {
    const key = String(q.queryKey[0]);
    const context = /(?:\/me$|\/doctors|\/clinics|\/clinic-settings|\/branches)/.test(key) || contextKeys.has(key);
    return context && (periodic || q.state.isInvalidated || Date.now() - q.state.dataUpdatedAt >= DIRECTORY_FRESH_MS);
  } }, { cancelRefetch: false });
}
