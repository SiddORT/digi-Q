import { useQueries, useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { directoryDetail, DIRECTORY_FRESH_MS } from "../lib/directory-cache";
import { useDirectoryActor } from "../lib/use-directory";
import { recordLabel } from "../lib/selection-label";

const resources: Record<string, [string, (id: string, options?: any) => Promise<any>]> = {
  clinicId: ["clinics", api.getClinic], branchId: ["branches", api.getBranch],
  doctorId: ["doctors", api.getDoctor], patientId: ["patients", api.getPatient],
  managingAdminId: ["users", api.getUser], adminId: ["users", api.getUser],
  specializationId: ["masters", api.getMaster], categoryId: ["masters", api.getMaster],
};
/** Exact detail reads supply display text, never filter eligibility. */
export function useFilterNames(filters: Record<string, string | undefined>, publicAccess = false) {
  const client = useQueryClient(), actor = useDirectoryActor();
  const entries = Object.entries(filters).filter(([key, id]) => id && resources[key]);
  const queries = useQueries({ queries: entries.map(([key, id]) => {
    const [resource, get] = resources[key];
    return {
      queryKey: ["filter-name", actor, publicAccess, resource, id, publicAccess ? filters : null], retry: false, staleTime: DIRECTORY_FRESH_MS,
      queryFn: async () => {
        if (publicAccess && ["clinics","branches","doctors"].includes(resource)) {
          const load = {clinics:api.listPublicClinics,branches:api.listPublicBranches,doctors:api.listPublicDoctors}[resource as "clinics"|"branches"|"doctors"];
          const result = await (load as Function)({selectedIds:id,page:1,pageSize:20,...(resource!=="clinics"?{clinicId:filters.clinicId}:{}),...(resource==="doctors"?{branchId:filters.branchId}: {})});
          const record = result.items.find((row:any)=>row.id===id);
          if (!record) throw new Error("Selected filter name is unavailable.");
          return record;
        }
        return directoryDetail(client, actor, resource, id!, signal => get(id!, { signal }));
      },
    };
  }) });
  return {
    name: (key: string) => {
      const query = queries[entries.findIndex(([entry]) => entry === key)];
      return !query ? "Selected item unavailable" : query.error ? "Name could not be loaded" :
        query.data ? recordLabel(query.data) : "Loading selected name…";
    },
    errors: queries.some(query => query.error) ? <p role="alert" className="error-box">Some filter names could not be loaded. Filter values have been retained. <button type="button" onClick={() => queries.forEach(query => { if (query.error) void query.refetch(); })}>Retry filter names</button></p> : null,
  };
}
