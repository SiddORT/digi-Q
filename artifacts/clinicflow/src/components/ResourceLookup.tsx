import { useEffect, useRef, useState, type AriaAttributes } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { SearchableSelect } from "./SearchableSelect";
import { SearchableMultiSelect } from "./SearchableMultiSelect";
import { useDebouncedValue } from "./ListingControls";
import { selectedIdBatches, retainSelectedRecords } from "./relation-validity";
import { soleAssigned } from "../lib/sole-option";

const lists: Record<string, any> = { clinics: api.listClinics, branches: api.listBranches, doctors: api.listDoctors, patients: api.listPatients, users: api.listUsers, masters: api.listMasters };
const getters: Record<string, any> = { clinics: api.getClinic, branches: api.getBranch, doctors: api.getDoctor, patients: api.getPatient, users: api.getUser, masters: api.getMaster };
type Props = Pick<AriaAttributes, "aria-describedby" | "aria-invalid" | "aria-required" | "aria-labelledby"> & { resource: string; value: string; onChange: (value: string) => void; label?: string; id?: string; error?: string; placeholder?: string; params?: Record<string, unknown>; disabled?: boolean; required?: boolean; fixed?: boolean; autoSole?: boolean; onSelectedRecords?: (records: any[], verifiedMissing: string[]) => void };
type MultiProps = Omit<Props, "value" | "onChange"> & { value: string[]; onChange: (value: string[]) => void; onRecords?: (records: any[]) => void; isOptionDisabled?: (record:any)=>boolean };

function lookupName(resource: string) {
  const name = resource.split(":").pop() || "options";
  return name === "masters" ? "values" : name==="branches"?"clinics":name==="clinics"?"clinic groups":name;
}

function useOptions(resource: string, selected: string[], params: Record<string, unknown>, enabled=true) {
  const retained = useRef(new Map<string, any>());
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search);
  const assignment = resource.startsWith("assignment:");
  const kind = resource.split(":")[1];
  const query = useInfiniteQuery({
    queryKey: ["remote-options", resource, params, debounced],
    retry: false,
    initialPageParam: 1,
    enabled,
    queryFn: async ({ pageParam }) => {
      const request = { ...params, search: debounced || undefined, page: pageParam, pageSize: 20 };
      const load=async (scope:Record<string,unknown>)=>{
        if (assignment) {
          const result: any = await api.getStaffAssignmentOptions(scope as any,{signal:AbortSignal.timeout(20000)});
          const metadata = result.pagination?.[kind];
          return { items: result[kind] || [], total: metadata?.total ?? result[kind]?.length ?? 0, page: pageParam };
        }
        return lists[resource](scope,{signal:AbortSignal.timeout(20000)});
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
     staleTime: 120000,
  });
  const loading = enabled && ((query.isPending && !query.isError) || query.isFetching);
   const rows: any[] = query.data?.pages.flatMap((p: any) => p.items) || [];
   // A selected row on the current page needs no duplicate detail request.
   const missing = selected.filter(id => !rows.some(row => row.id === id));
  const selectedQuery = useQuery({
     queryKey: ["remote-selected", resource, missing.join(","), params],
     retry: false,
     enabled: enabled && missing.length > 0 && (!query.isPending || query.isError),
    queryFn: async () => {
      if (assignment) {
         // Selected hydration uses the same clinic scope as the option request,
         // including the per-clinic requests for multi-clinic branch mappings.
         const clinicIds = kind === "branches" ? String(params.clinicId || "").split(",").filter(Boolean) : [];
         const scopes = clinicIds.length ? clinicIds.map(clinicId => ({ ...params, clinicId })) : [params];
         const results: any[] = await Promise.all(scopes.flatMap(scope => selectedIdBatches(missing).map(ids =>
           api.getStaffAssignmentOptions({ ...scope, search: undefined, selectedIds: ids.join(","), pageSize: 100 } as any,{signal:AbortSignal.timeout(20000)}))));
         if (results.some(result => result.pagination?.[kind]?.total > (result[kind] || []).length))
           throw new Error("Selected options were only partially loaded. Please retry.");
         return [...new Map(results.flatMap(result => result[kind] || []).map(row => [row.id, row])).values()];
      }
       // A detail getter hydrates a saved label; it cannot prove membership in
       // the new operational context. Exact-ID list reads apply actor and
       // doctor permissions before returning the row.
       if(params.doctorId && ["clinics","branches"].includes(resource)){
         const result=await lists[resource]({...params,search:undefined,selectedIds:missing.join(","),page:1,pageSize:100},{signal:AbortSignal.timeout(20000)});
         if(result.total>result.items.length)throw new Error("Selected assignments were only partially loaded. Please retry.");
         return result.items;
       }
       return Promise.all(missing.map(id => getters[resource](id,{signal:AbortSignal.timeout(20000)})));
    },
     staleTime: 120000,
  });
   const selectedRows: any[] = selectedQuery.data || [];
   const merged = [...new Map([...rows, ...selectedRows].map(row => [row.id, row])).values()];
   // Cache only selected labels, never option pages or authority about membership.
   retained.current=retainSelectedRecords(retained.current,selected,merged);
   const verifiedMissing = (assignment && kind === "branches" || params.doctorId && ["clinics","branches"].includes(resource)) && selectedQuery.isSuccess ? missing.filter(id => !selectedRows.some(row => row.id === id)) : [];
   // Hydration supplies labels at rest, but must not turn an empty search into a
   // false result (or make an out-of-scope selected row selectable).
   const visible = [...new Map([...(debounced ? rows : merged), ...selected.flatMap(id => retained.current.has(id) ? [retained.current.get(id)] : [])].map(row => [row.id, row])).values()];
   return { query, loading, selectedQuery, selectedPending: enabled && missing.length > 0 && selectedQuery.isPending, rows: merged, selectedRecords: [...rows, ...selectedRows].filter(row => selected.includes(row.id)), verifiedMissing, search: setSearch, options: visible.map(row => ({ value: row.id, label: `${row.name || row.fullName || row.id}${row.status==="inactive"?" · Inactive":""}`, disabled: !rows.some(option => option.id === row.id)||(params.status==="active"&&row.status==="inactive") })) };
}

export function ResourceLookup({ resource, value, onChange, params = {}, onSelectedRecords, fixed = false, autoSole = false, ...props }: Props) {
  const lookup = useOptions(resource, value ? [value] : [], params, fixed || !props.disabled);
  // This request never uses picker search or hydrated selections. A partial page
  // and an error cannot turn the first displayed result into a default.
  const scope = useQuery<any>({
    queryKey: ["operational-cardinality", resource, params],
    enabled: autoSole && !fixed && !props.disabled && !!lists[resource],
    retry: false, staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 30000,
    queryFn: () => lists[resource]({...params, search: undefined, page: 1, pageSize: 2}, {signal: AbortSignal.timeout(20000)}),
  });
  const sole = scope.isSuccess ? soleAssigned<any>(scope.data, !!scope.error) : null;
  useEffect(() => { if (!value && sole && !scope.isFetching) onChange(sole.id); }, [value, sole?.id, scope.isFetching, onChange]);
   const scopeKey = JSON.stringify(params);
   const recordsKey = JSON.stringify(lookup.selectedRecords);
   const missingKey = lookup.verifiedMissing.join(",");
   useEffect(() => { if (!lookup.query.isPending && !lookup.query.error && !lookup.selectedPending && !lookup.selectedQuery.error) onSelectedRecords?.(lookup.selectedRecords, lookup.verifiedMissing); }, [scopeKey, recordsKey, missingKey, lookup.query.isPending, lookup.query.error, lookup.selectedPending, lookup.selectedQuery.error, onSelectedRecords]);
  const placeholder=props.placeholder||`Search ${lookupName(resource)}…`;
  const awaitingScope=autoSole&&!props.disabled&&(scope.isPending||!!scope.error||scope.isSuccess&&scope.data?.total===0);
  if (fixed || awaitingScope || (sole && (!value || value === sole.id))) {
    const record = lookup.selectedRecords.find(row => row.id === value) || sole;
    return <div className="fixed-scope" data-testid={`fixed-scope-${resource}`}>
      {props.label && <label htmlFor={props.id}>{props.label}{props.required ? " *" : ""}</label>}
      <input id={props.id} aria-label={props.label} readOnly value={record?.name || record?.fullName || (value ? lookup.loading ? "Loading saved assignment…" : "Saved assignment unavailable" : scope.isPending&&!fixed ? "Loading assigned options…" : "Not assigned")} aria-describedby={props["aria-describedby"]}/>
      {props.error && <p role="alert" className="field-error">{props.error}</p>}
      <LookupError error={lookup.query.error || lookup.selectedQuery.error} retry={() => {void lookup.query.refetch();void lookup.selectedQuery.refetch();}}/>
      {autoSole&&scope.isSuccess&&scope.data?.total===0&&<p role="status">No active assigned {lookupName(resource)} are available in this scope. Ask your clinic administrator to review assignments.</p>}
      <LookupError error={scope.error} retry={() => {void scope.refetch();}}/>
    </div>;
  }
   return <><SearchableSelect {...props} placeholder={placeholder} value={value} onChange={onChange} options={lookup.options} onSearchChange={lookup.search} loading={lookup.loading} error={props.error||(lookup.query.error ? "Unable to load options." : undefined)} onRetry={()=>{void lookup.query.refetch();if(value)void lookup.selectedQuery.refetch();}} hasMore={lookup.query.hasNextPage} onLoadMore={() => lookup.query.fetchNextPage()} />
    {autoSole && scope.isSuccess && scope.data?.total === 0 && <p role="status">No active assigned {lookupName(resource)} are available in this scope. Ask your clinic administrator to review assignments.</p>}
    <LookupError error={scope.error} retry={() => {void scope.refetch();}}/>
    <LookupError error={lookup.query.error || lookup.selectedQuery.error} retry={() => { lookup.query.refetch(); lookup.selectedQuery.refetch(); }} /></>;
}
export function ResourceMultiLookup({ resource, value, onChange, params = {}, onRecords, onSelectedRecords, isOptionDisabled, ...props }: MultiProps) {
  const lookup = useOptions(resource, value, params, !props.disabled);
  const scopeKey = JSON.stringify(params);
  const recordsKey = JSON.stringify(lookup.rows);
  useEffect(() => { onRecords?.(lookup.rows); }, [recordsKey]);
   const selectedKey = JSON.stringify(lookup.selectedRecords);
   const missingKey = lookup.verifiedMissing.join(",");
   useEffect(() => { if (!lookup.query.isPending && !lookup.query.error && !lookup.selectedPending && !lookup.selectedQuery.error) onSelectedRecords?.(lookup.selectedRecords, lookup.verifiedMissing); }, [scopeKey, selectedKey, missingKey, lookup.query.isPending, lookup.query.error, lookup.selectedPending, lookup.selectedQuery.error, onSelectedRecords]);
  const placeholder=props.placeholder||`Search ${lookupName(resource)}…`;
   return <><SearchableMultiSelect {...props} placeholder={placeholder} value={value} onChange={onChange} options={lookup.options.map(option=>({...option,disabled:option.disabled||(!value.includes(option.value)&&!!isOptionDisabled?.(lookup.rows.find(row=>row.id===option.value)))}))} onSearchChange={lookup.search} isLoading={lookup.loading} error={props.error||(lookup.query.error ? "Unable to load options." : undefined)} onRetry={()=>{void lookup.query.refetch();if(value.length)void lookup.selectedQuery.refetch();}} hasMore={lookup.query.hasNextPage} onLoadMore={() => lookup.query.fetchNextPage()} />
    <LookupError error={lookup.query.error || lookup.selectedQuery.error} retry={() => { lookup.query.refetch(); lookup.selectedQuery.refetch(); }} /></>;
}
function LookupError({ error, retry }: { error: unknown; retry: () => void }) {
  return error ? <div role="alert" className="error-box">Unable to load options. Your selection has been retained. <button type="button" onClick={retry}>Retry Options</button></div> : null;
}
export default ResourceLookup;