import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { SearchableSelect } from "./SearchableSelect";
import { SearchableMultiSelect } from "./SearchableMultiSelect";
import { useDebouncedValue } from "./ListingControls";

const lists: Record<string, any> = { clinics: api.listClinics, branches: api.listBranches, doctors: api.listDoctors, patients: api.listPatients, users: api.listUsers, masters: api.listMasters };
const getters: Record<string, any> = { clinics: api.getClinic, branches: api.getBranch, doctors: api.getDoctor, patients: api.getPatient, users: api.getUser, masters: api.getMaster };
type Props = { resource: string; value: string; onChange: (value: string) => void; label?: string; placeholder?: string; params?: Record<string, unknown>; disabled?: boolean; required?: boolean };
type MultiProps = Omit<Props, "value" | "onChange"> & { value: string[]; onChange: (value: string[]) => void; onRecords?: (records: any[]) => void; isOptionDisabled?: (record:any)=>boolean };

function lookupName(resource: string) {
  const name = resource.split(":").pop() || "options";
  return name === "masters" ? "values" : name;
}

function useOptions(resource: string, selected: string[], params: Record<string, unknown>, enabled=true) {
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search);
  const cache = useRef(new Map<string, any>());
  const assignment = resource.startsWith("assignment:");
  const kind = resource.split(":")[1];
  const query = useInfiniteQuery({
    queryKey: ["remote-options", resource, params, debounced],
    initialPageParam: 1,
    enabled,
    queryFn: async ({ pageParam }) => {
      const request = { ...params, search: debounced || undefined, page: pageParam, pageSize: 20 };
      const load=async (scope:Record<string,unknown>)=>{
        if (assignment) {
          const result: any = await api.getStaffAssignmentOptions(scope as any);
          const metadata = result.pagination?.[kind];
          return { items: result[kind] || [], total: metadata?.total ?? result[kind]?.length ?? 0, page: pageParam };
        }
        return lists[resource](scope);
      };
      // Branch catalogs accept one clinic per request. Each clinic request stays bounded and searchable.
      const clinicIds=String(params.clinicId||"").split(",").filter(Boolean);
      if(clinicIds.length>1&&(resource==="branches"||resource==="assignment:branches")){
        const results=await Promise.all(clinicIds.map(clinicId=>load({...request,clinicId})));
        return {items:results.flatMap(result=>result.items),total:results.reduce((n,result)=>n+result.total,0),page:pageParam};
      }
      return load(request);
    },
    getNextPageParam: (last: any, pages) => pages.reduce((n, p: any) => n + p.items.length, 0) < last.total ? pages.length + 1 : undefined,
    staleTime: 30000,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
  const selectedQuery = useQuery({
    queryKey: ["remote-selected", resource, selected.join(","), params],
    enabled: enabled && selected.length > 0,
    queryFn: async () => {
      if (assignment) {
        const result: any = await api.getStaffAssignmentOptions({ ...params, search: undefined, clinicId: undefined, selectedIds: selected.join(","), pageSize: 100 } as any);
        return result[kind] || [];
      }
      // Refresh selected records too: cached labels are not a server freshness check.
      return Promise.all(selected.map(id => getters[resource](id)));
    },
    staleTime: 60000,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
  const rows: any[] = query.data?.pages.flatMap((p: any) => p.items) || [];
  [...rows, ...(selectedQuery.data || [])].forEach(row => cache.current.set(row.id, row));
  const merged = [...new Map([...rows, ...selected.map(id => cache.current.get(id)).filter(Boolean)].map(row => [row.id, row])).values()];
  return { query, selectedQuery, rows: merged, search: setSearch, options: merged.map(row => ({ value: row.id, label: row.name || row.fullName || row.id })) };
}

export function ResourceLookup({ resource, value, onChange, params = {}, ...props }: Props) {
  const lookup = useOptions(resource, value ? [value] : [], params, !props.disabled);
  const placeholder=props.placeholder||`Search ${lookupName(resource)}…`;
  return <><SearchableSelect {...props} placeholder={placeholder} value={value} onChange={onChange} options={lookup.options} onSearchChange={lookup.search} loading={lookup.query.isFetching} hasMore={lookup.query.hasNextPage} onLoadMore={() => lookup.query.fetchNextPage()} />
    <LookupError error={lookup.query.error || lookup.selectedQuery.error} retry={() => { lookup.query.refetch(); lookup.selectedQuery.refetch(); }} /></>;
}
export function ResourceMultiLookup({ resource, value, onChange, params = {}, onRecords, isOptionDisabled, ...props }: MultiProps) {
  const lookup = useOptions(resource, value, params, !props.disabled);
  const recordsKey = JSON.stringify(lookup.rows);
  useEffect(() => { onRecords?.(lookup.rows); }, [recordsKey]);
  const placeholder=props.placeholder||`Search ${lookupName(resource)}…`;
  return <><SearchableMultiSelect {...props} placeholder={placeholder} value={value} onChange={onChange} options={lookup.options.map(option=>({...option,disabled:!value.includes(option.value)&&!!isOptionDisabled?.(lookup.rows.find(row=>row.id===option.value))}))} onSearchChange={lookup.search} isLoading={lookup.query.isFetching} hasMore={lookup.query.hasNextPage} onLoadMore={() => lookup.query.fetchNextPage()} />
    <LookupError error={lookup.query.error || lookup.selectedQuery.error} retry={() => { lookup.query.refetch(); lookup.selectedQuery.refetch(); }} /></>;
}
function LookupError({ error, retry }: { error: unknown; retry: () => void }) {
  return error ? <div role="alert" className="error-box">{error instanceof Error ? error.message : "Unable to load options. Please try again."} <button type="button" onClick={retry}>Retry options</button></div> : null;
}
export default ResourceLookup;