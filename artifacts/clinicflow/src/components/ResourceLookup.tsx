import { useEffect, useRef, useState, type AriaAttributes } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { SearchableSelect } from "./SearchableSelect";
import { SearchableMultiSelect } from "./SearchableMultiSelect";
import { useDebouncedValue } from "./ListingControls";
import { selectedIdBatches, retainSelectedRecords } from "./relation-validity";
import { soleAssigned } from "../lib/sole-option";
import { cachedComplete, directoryDetail, directoryPage, DIRECTORY_FRESH_MS } from "../lib/directory-cache";
import { assignmentDirectory, directoryLists as lists, useDirectoryActor, useDirectoryCardinality } from "../lib/use-directory";
import { recordLabel } from "../lib/selection-label";

const getters: Record<string, any> = { clinics: api.getClinic, branches: api.getBranch, doctors: api.getDoctor, patients: api.getPatient, users: api.getUser, masters: api.getMaster };
type Props = Pick<AriaAttributes, "aria-describedby" | "aria-invalid" | "aria-required" | "aria-labelledby"> & { resource: string; value: string; onChange: (value: string) => void; label?: string; id?: string; error?: string; placeholder?: string; params?: Record<string, unknown>; disabled?: boolean; required?: boolean; fixed?: boolean; autoSole?: boolean; wrapFixedLabel?: boolean; onSelectedRecords?: (records: any[], verifiedMissing: string[]) => void };
type MultiProps = Omit<Props, "value" | "onChange"> & { value: string[]; onChange: (value: string[]) => void; onRecords?: (records: any[]) => void; isOptionDisabled?: (record:any)=>boolean };

function lookupName(resource: string) {
  const name = resource.split(":").pop() || "options";
  return name === "masters" ? "values" : name==="branches"?"clinics":name==="clinics"?"clinic groups":name;
}

function useOptions(resource: string, selected: string[], params: Record<string, unknown>, enabled=true) {
  const client = useQueryClient(), actor = useDirectoryActor();
  const retained = useRef(new Map<string, any>());
  const labelScope = JSON.stringify([actor, resource, params]);
  const retainedScope = useRef(labelScope);
  if (retainedScope.current !== labelScope) { retained.current.clear(); retainedScope.current = labelScope; }
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search);
  const assignment = resource.startsWith("assignment:");
  const kind = resource.split(":")[1];
  const query = useInfiniteQuery({
    queryKey: ["remote-options", actor, resource, params, debounced],
    retry: false,
    initialPageParam: 1,
    enabled,
    queryFn: async ({ pageParam }) => {
      const request = { ...params, search: debounced || undefined, page: pageParam, pageSize: 20 };
      const load=async (scope:Record<string,unknown>)=>{
        if (assignment) {
          const result: any = await assignmentDirectory(client, actor, scope);
          const metadata = result.pagination?.[kind];
          return { items: result[kind] || [], total: metadata?.total ?? result[kind]?.length ?? 0, page: pageParam };
        }
        return directoryPage(client, actor, resource, scope, (p, signal) => lists[resource](p,{signal}));
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
     staleTime: DIRECTORY_FRESH_MS, refetchOnWindowFocus: false,
  });
  const loading = enabled && ((query.isPending && !query.isError) || query.isFetching);
   const rows: any[] = query.data?.pages.flatMap((p: any) => p.items) || [];
   // A selected row on the current page needs no duplicate detail request.
   const missing = selected.filter(id => !rows.some(row => row.id === id));
  const selectedQuery = useQuery({
     queryKey: ["remote-selected", actor, resource, missing.join(","), params],
     retry: false,
      enabled: missing.length > 0 && (!enabled || !query.isPending || query.isError),
    queryFn: async () => {
      if (!assignment) {
        const complete = await cachedComplete(client, actor, resource, params);
        if (complete) {
          const found = complete.items.filter(row => missing.includes(row.id));
          if (params.doctorId && ["clinics", "branches"].includes(resource)) return found;
          // A missing row in an ordinary scoped picker does not prove the saved
          // label is inaccessible. Preserve detail hydration without making it
          // selectable in the new scope.
          const unfound = missing.filter(id => !found.some(row => row.id === id));
          return [...found, ...await Promise.all(unfound.map(id => directoryDetail(client, actor, resource, id,
            signal => getters[resource](id,{signal}))))];
        }
      }
      if (assignment) {
         // Selected hydration uses the same clinic scope as the option request,
         // including the per-clinic requests for multi-clinic branch mappings.
         const clinicIds = kind === "branches" ? String(params.clinicId || "").split(",").filter(Boolean) : [];
         const scopes = clinicIds.length ? clinicIds.map(clinicId => ({ ...params, clinicId })) : [params];
         const results: any[] = await Promise.all(scopes.flatMap(scope => selectedIdBatches(missing).map(ids =>
           assignmentDirectory(client, actor, { ...scope, search: undefined, selectedIds: ids.join(","), pageSize: 100 }))));
         if (results.some(result => result.pagination?.[kind]?.total > (result[kind] || []).length))
           throw new Error("Selected options were only partially loaded. Please retry.");
         return [...new Map(results.flatMap(result => result[kind] || []).map(row => [row.id, row])).values()];
      }
       // A detail getter hydrates a saved label; it cannot prove membership in
       // the new operational context. Exact-ID list reads apply actor and
       // doctor permissions before returning the row.
       if(params.doctorId && ["clinics","branches"].includes(resource)){
         const results = await Promise.all(selectedIdBatches(missing).map(ids =>
           directoryPage(client, actor, resource, {...params,search:undefined,selectedIds:ids.join(","),page:1,pageSize:100},
             (p, signal) => lists[resource](p,{signal}))));
         if(results.some(result=>result.total>result.items.length))throw new Error("Selected assignments were only partially loaded. Please retry.");
         return results.flatMap(result => result.items);
       }
       return Promise.all(missing.map(id => directoryDetail(client, actor, resource, id,
         signal => getters[resource](id,{signal}))));
    },
     staleTime: DIRECTORY_FRESH_MS, refetchOnWindowFocus: false,
  });
   const selectedRows: any[] = selectedQuery.error ? [] : selectedQuery.data || [];
   const merged = [...new Map([...rows, ...selectedRows].map(row => [row.id, row])).values()];
   // Cache only selected labels, never option pages or authority about membership.
    if (selectedQuery.isSuccess) missing.filter(id => !selectedRows.some(row => row.id === id)).forEach(id => retained.current.delete(id));
    retained.current=retainSelectedRecords(selectedQuery.error ? new Map() : retained.current,selected,merged);
   const verifiedMissing = (assignment && kind === "branches" || params.doctorId && ["clinics","branches"].includes(resource)) && selectedQuery.isSuccess && !selectedQuery.error ? missing.filter(id => !selectedRows.some(row => row.id === id)) : [];
   // Hydration supplies labels at rest, but must not turn an empty search into a
   // false result (or make an out-of-scope selected row selectable).
   const visible = [...new Map([...(debounced ? rows : merged), ...selected.flatMap(id => retained.current.has(id) ? [retained.current.get(id)] : [])].map(row => [row.id, row])).values()];
    return { query, labelScope, loading: loading || (missing.length > 0 && selectedQuery.isFetching), selectedQuery, selectedPending: missing.length > 0 && selectedQuery.isPending, rows: merged, selectedRecords: [...rows, ...selectedRows].filter(row => selected.includes(row.id)), verifiedMissing, search: setSearch, options: visible.map(row => ({ value: row.id, label: `${recordLabel(row)}${row.status==="inactive"?" · Inactive":""}`, disabled: !rows.some(option => option.id === row.id)||(params.status==="active"&&row.status==="inactive") })) };
}

export function ResourceLookup({ resource, value, onChange, params = {}, onSelectedRecords, fixed = false, autoSole = false, wrapFixedLabel = false, ...props }: Props) {
  const lookup = useOptions(resource, value ? [value] : [], params, fixed || !props.disabled);
  // This request never uses picker search or hydrated selections. A partial page
  // and an error cannot turn the first displayed result into a default.
  const scope = useDirectoryCardinality(resource, params, autoSole && !fixed && !props.disabled);
  const sole = scope.isSuccess ? soleAssigned<any>(scope.data, !!scope.error) : null;
  useEffect(() => { if (!value && sole && !scope.isFetching) onChange(sole.id); }, [value, sole?.id, scope.isFetching, onChange]);
   const scopeKey = JSON.stringify(params);
   const recordsKey = JSON.stringify(lookup.selectedRecords);
   const missingKey = lookup.verifiedMissing.join(",");
   useEffect(() => { if (!lookup.query.isPending && !lookup.query.error && !lookup.selectedPending && !lookup.selectedQuery.error) onSelectedRecords?.(lookup.selectedRecords, lookup.verifiedMissing); }, [scopeKey, recordsKey, missingKey, lookup.query.isPending, lookup.query.error, lookup.selectedPending, lookup.selectedQuery.error, onSelectedRecords]);
  const placeholder=props.placeholder||`Search ${lookupName(resource)}…`;
  const awaitingScope=autoSole&&!props.disabled&&(scope.isPending||!!scope.error||scope.isSuccess&&scope.data?.total===0);
  if (fixed || awaitingScope || (sole && (!value || value === sole.id))) {
    const record = value ? lookup.selectedRecords.find(row => row.id === value) : sole;
    return <div className="fixed-scope" data-testid={`fixed-scope-${resource}`}>
      {props.label && <label htmlFor={props.id}>{props.label}{props.required ? " *" : ""}</label>}
      {wrapFixedLabel?<div id={props.id} role="textbox" aria-readonly="true" aria-label={props.label} aria-describedby={props["aria-describedby"]} tabIndex={0} className="fixed-scope-value">{record ? recordLabel(record) : (value ? lookup.loading ? "Loading saved assignment…" : "Saved assignment unavailable" : scope.isPending&&!fixed ? "Loading assigned options…" : "Not assigned")}</div>:<input id={props.id} aria-label={props.label} readOnly value={record ? recordLabel(record) : (value ? lookup.loading ? "Loading saved assignment…" : "Saved assignment unavailable" : scope.isPending&&!fixed ? "Loading assigned options…" : "Not assigned")} aria-describedby={props["aria-describedby"]}/>}
      {props.error && <p role="alert" className="field-error">{props.error}</p>}
      <LookupError error={lookup.query.error || lookup.selectedQuery.error} retry={() => {void lookup.query.refetch();void lookup.selectedQuery.refetch();}}/>
      {autoSole&&scope.isSuccess&&scope.data?.total===0&&<p role="status">No active assigned {lookupName(resource)} are available in this scope. Ask your clinic administrator to review assignments.</p>}
      <LookupError error={scope.error} retry={() => {void scope.refetch();}}/>
    </div>;
  }
   return <><SearchableSelect {...props} retainSelectionLabel={false} labelScope={lookup.labelScope} placeholder={placeholder} value={value} onChange={onChange} options={lookup.options} onSearchChange={lookup.search} loading={lookup.loading} error={props.error||(lookup.selectedQuery.error ? "Unable to load selected names. Your selection has been retained." : lookup.query.error ? "Unable to load options." : undefined)} onRetry={()=>{if(!props.disabled)void lookup.query.refetch();if(value)void lookup.selectedQuery.refetch();}} hasMore={lookup.query.hasNextPage} onLoadMore={() => lookup.query.fetchNextPage()} />
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
    return <><SearchableMultiSelect {...props} retainSelectionLabel={false} labelScope={lookup.labelScope} placeholder={placeholder} value={value} onChange={onChange} options={lookup.options.map(option=>({...option,disabled:option.disabled||(!value.includes(option.value)&&!!isOptionDisabled?.(lookup.rows.find(row=>row.id===option.value)))}))} onSearchChange={lookup.search} isLoading={lookup.loading} error={props.error||(lookup.selectedQuery.error ? "Unable to load selected names. Your selection has been retained." : lookup.query.error ? "Unable to load options." : undefined)} onRetry={()=>{if(!props.disabled)void lookup.query.refetch();if(value.length)void lookup.selectedQuery.refetch();}} hasMore={lookup.query.hasNextPage} onLoadMore={() => lookup.query.fetchNextPage()} />
    <LookupError error={lookup.query.error || lookup.selectedQuery.error} retry={() => { lookup.query.refetch(); lookup.selectedQuery.refetch(); }} /></>;
}
function LookupError({ error, retry }: { error: unknown; retry: () => void }) {
  return error ? <div role="alert" className="error-box">Unable to load options. Your selection has been retained. <button type="button" onClick={retry}>Retry Options</button></div> : null;
}
export default ResourceLookup;