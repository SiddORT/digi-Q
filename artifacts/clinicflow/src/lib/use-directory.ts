import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { directoryActor, directoryPage, directoryRequestSignal, directoryScope, DIRECTORY_FRESH_MS } from "./directory-cache";

export const directoryLists: Record<string, any> = {
  clinics: api.listClinics, branches: api.listBranches, doctors: api.listDoctors,
  patients: api.listPatients, users: api.listUsers, masters: api.listMasters,
};
export function useDirectoryActor() {
  const client = useQueryClient();
  // Identity is owned/refreshed by the signed-in boundary. No new observer/poller.
  return directoryActor(client.getQueryData<api.Identity>(api.getGetMeQueryKey()));
}
/** The assignment endpoint returns all catalogs together; share that response
 * across kind-specific pickers rather than repeat it for each kind. */
export function assignmentDirectory(client: ReturnType<typeof useQueryClient>, actor: ReturnType<typeof directoryActor>, params: Record<string, unknown>) {
  return client.fetchQuery({
    queryKey: ["assignment-directory", actor, params],
    staleTime: DIRECTORY_FRESH_MS, retry: false,
    queryFn: ({signal}) => api.getStaffAssignmentOptions(params as any, {signal: directoryRequestSignal(signal)}),
  });
}
export function useDirectoryCardinality(resource: string, params: Record<string, unknown>, enabled: boolean) {
  const client = useQueryClient(), actor = useDirectoryActor(), scope = directoryScope(params);
  return useQuery({
    queryKey: ["operational-cardinality", actor, resource, scope],
    enabled: enabled && !!directoryLists[resource], retry: false,
    staleTime: DIRECTORY_FRESH_MS, refetchOnWindowFocus: false,
    // Shares the picker's first bounded page; never fetch a whole catalog just
    // to distinguish zero/one/many. A verified total remains authoritative.
    queryFn: () => directoryPage(client, actor, resource, { ...scope, page: 1, pageSize: 20 },
      (p, signal) => directoryLists[resource](p, {signal})),
  });
}
