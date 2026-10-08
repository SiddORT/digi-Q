import { hashKey, type QueryClient } from "@tanstack/react-query";

export const DIRECTORY_FRESH_MS = 60_000;
export type DirectoryPage = { items: any[]; total: number; page?: number };
export type DirectoryLoader = (params: Record<string, unknown>, signal: AbortSignal) => Promise<DirectoryPage>;
export type DirectoryActor = readonly unknown[];

/** No implicit narrowing: every non-transport parameter participates in scope. */
export function directoryScope(params: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(params).filter(([key, value]) =>
    !["page", "pageSize", "search", "selectedIds"].includes(key) && value !== undefined && value !== ""));
}
export function directoryActor(identity?: { user?: { id: string; role?: string } | null; doctorId?: string | null }) {
  return [identity?.user?.id || "anonymous", identity?.user?.role || "", identity?.doctorId || ""] as const;
}
export function directoryCompleteKey(actor: DirectoryActor, resource: string, params: Record<string, unknown>) {
  return ["directory-complete", actor, resource, directoryScope(params)] as const;
}
export function directoryRequestSignal(signal: AbortSignal) {
  return AbortSignal.any([signal, AbortSignal.timeout(20000)]);
}
export function directoryDetail(client: QueryClient, actor: DirectoryActor, resource: string, id: string, load: (signal: AbortSignal) => Promise<any>) {
  return client.fetchQuery({
    queryKey: ["directory-detail", actor, resource, id],
    staleTime: DIRECTORY_FRESH_MS, retry: false, queryFn: ({signal}) => load(directoryRequestSignal(signal)),
  });
}
function fresh(client: QueryClient, key: readonly unknown[]) {
  const state = client.getQueryState(key);
  return state?.status === "success" && !state.isInvalidated && Date.now() - state.dataUpdatedAt < DIRECTORY_FRESH_MS;
}
function checked(page: DirectoryPage) {
  if (!Array.isArray(page.items) || !Number.isInteger(page.total) || page.total < page.items.length)
    throw new Error("Directory pagination could not be verified. Please retry.");
  return page;
}

/** Reuse only a verified full, unsearched result. The sole permitted projection is
 * clinicId on a branch catalog; all actor/doctor/status/other filters must match.
 */
export async function cachedComplete(
  client: QueryClient, actor: DirectoryActor, resource: string, params: Record<string, unknown>,
): Promise<DirectoryPage | undefined> {
  const scope = directoryScope(params);
  const exact = directoryCompleteKey(actor, resource, scope);
  const candidates = [exact];
  if (resource === "branches" && scope.clinicId) {
    const { clinicId: _, ...allClinics } = scope;
    candidates.push(directoryCompleteKey(actor, resource, allClinics));
  }
  for (const key of candidates) {
    const query = client.getQueryCache().find({ queryKey: key, exact: true });
    // A workspace read already in flight should not spawn a second directory read.
    if (query?.state.fetchStatus === "fetching") await query.promise;
    if (!fresh(client, key)) continue;
    const result = client.getQueryData<DirectoryPage>(key);
    if (!result || result.total !== result.items.length || new Set(result.items.map(row => row.id)).size !== result.total) continue;
    const items = hashKey(key) === hashKey(exact) ? result.items
      : result.items.filter(row => row.clinicId === scope.clinicId);
    return { items, total: items.length };
  }
  return undefined;
}

export async function directoryPage(
  client: QueryClient, actor: DirectoryActor, resource: string, params: Record<string, unknown>, load: DirectoryLoader,
): Promise<DirectoryPage> {
  // Exact selected-ID and searched reads never establish cardinality.
  const complete = !params.search && !params.selectedIds ? await cachedComplete(client, actor, resource, params) : undefined;
  if (complete) {
    const page = Number(params.page || 1), size = Number(params.pageSize || 20);
    return { items: complete.items.slice((page - 1) * size, page * size), total: complete.total, page };
  }
  return client.fetchQuery({
    queryKey: ["directory-page", actor, resource, params],
    staleTime: DIRECTORY_FRESH_MS, retry: false,
    queryFn: async ({signal}) => {
      const result = checked(await load(params, directoryRequestSignal(signal)));
      signal.throwIfAborted();
      if (!params.search && !params.selectedIds && Number(params.page || 1) === 1 && result.total === result.items.length
        && new Set(result.items.map(row => row.id)).size === result.total) {
        client.setQueryData(directoryCompleteKey(actor, resource, params), result);
      }
      return result;
    },
  });
}

export function completeDirectory(
  client: QueryClient, actor: DirectoryActor, resource: string, params: Record<string, unknown>, load: DirectoryLoader,
) {
  return client.fetchQuery({
    queryKey: directoryCompleteKey(actor, resource, params),
    staleTime: DIRECTORY_FRESH_MS, retry: false,
    queryFn: async ({signal}) => {
      const items: any[] = [];
      const ids = new Set<string>();
      let expected: number | undefined;
      for (let page = 1; ; page++) {
        signal.throwIfAborted();
        const result = checked(await directoryPageWithoutComplete(client, actor, resource, { ...directoryScope(params), page, pageSize: 100 }, load, signal));
        if (expected !== undefined && result.total !== expected) throw new Error("Directory changed while loading. Please retry.");
        expected = result.total;
        for (const row of result.items) {
          if (ids.has(row.id)) throw new Error("Directory pagination was inconsistent. Please retry.");
          ids.add(row.id);
        }
        items.push(...result.items);
        if (items.length > expected)
          throw new Error("Directory pagination was inconsistent. Please retry.");
        if (items.length === expected) return { items, total: expected };
        if (!result.items.length) throw new Error("Your assigned locations were only partially loaded. Retry Locations.");
      }
    },
  });
}
function directoryPageWithoutComplete(client: QueryClient, actor: DirectoryActor, resource: string, params: Record<string, unknown>, load: DirectoryLoader, parentSignal: AbortSignal) {
  // Do not await our own complete-directory promise.
  return client.fetchQuery({
    queryKey: ["directory-page", actor, resource, params], staleTime: DIRECTORY_FRESH_MS,
    retry: false, queryFn: ({signal}) => load(params, directoryRequestSignal(AbortSignal.any([parentSignal, signal]))),
  });
}
