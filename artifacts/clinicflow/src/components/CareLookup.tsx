import { useRef, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { SearchableSelect } from "./SearchableSelect";
import { useDebouncedValue } from "./ListingControls";
import { ResourceLookup } from "./ResourceLookup";
import { useDirectoryActor } from "../lib/use-directory";
import { recordLabel } from "../lib/selection-label";
import { retainSelectedRecords } from "./relation-validity";
import { directoryDetail, directoryRequestSignal, publicSelectedCareOptions, retainPublicSelectedCare, DIRECTORY_FRESH_MS } from "../lib/directory-cache";

type RecordValue = { id: string; name?: string; fullName?: string; reference?: string; doctorName?: string; token?: number | string; branchName?: string; [key: string]: unknown };
type Kind = "clinics" | "branches" | "doctors" | "patients" | "appointments";
const loaders = { clinics: api.listClinics, branches: api.listBranches, doctors: api.listDoctors, patients: api.listPatients, appointments: api.listAppointments };
const publicLoaders = { clinics: api.listPublicClinics, branches: api.listPublicBranches, doctors: api.listPublicDoctors };
export function useSelectedCare(kind: "clinics" | "branches" | "doctors" | "patients", id: string, isPublic = false, params: Record<string, unknown> = {}) {
  const actor = useDirectoryActor();
  const client = useQueryClient();
  return useQuery<RecordValue>({
    ...(isPublic && kind !== "patients" ? publicSelectedCareOptions(actor, kind, id, params,
      (p, signal) => (publicLoaders[kind] as Function)(p, { signal })) : {
    queryKey: ["selected-care", actor, kind, id, isPublic, params],
    retry: false,
    staleTime: DIRECTORY_FRESH_MS,
    enabled: !!id,
    queryFn: async () => {
      const get = { clinics: api.getClinic, branches: api.getBranch, doctors: api.getDoctor, patients: api.getPatient }[kind];
      return await directoryDetail(client, actor, kind, id, signal => (get as Function)(id,{signal})) as RecordValue;
    }
    }),
  });
}
type CareLookupProps = {
  kind: Kind; label: string; value: string; onChange: (value: string, record?: RecordValue) => void;
   params?: Record<string, unknown>; publicAccess?: boolean; disabled?: boolean; selectedLabel?: string; fixed?: boolean;
};
export function CareLookup(props: CareLookupProps) {
   if (!props.publicAccess && props.kind !== "appointments") return <ResourceLookup resource={props.kind} label={props.label} value={props.value} onChange={props.onChange} params={{ ...props.params, status: "active" }} disabled={props.disabled} fixed={props.fixed} autoSole={["clinics","branches","doctors"].includes(props.kind)}/>;
  return <PublicCareLookup {...props}/>;
}
function PublicCareLookup({ kind, label, value, onChange, params = {}, publicAccess = false, disabled = false, selectedLabel }: CareLookupProps) {
  const actor = useDirectoryActor();
  const client = useQueryClient();
  const labelScope = JSON.stringify([actor, kind, publicAccess, params]);
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search);
  const retained = useRef(new Map<string, RecordValue>());
  const retainedScope = useRef(labelScope);
  if (retainedScope.current !== labelScope) { retained.current.clear(); retainedScope.current = labelScope; }
  const query = useInfiniteQuery({
    queryKey: ["care-options", actor, kind, publicAccess, params, debounced],
    retry: false,
    staleTime: DIRECTORY_FRESH_MS,
    enabled: !disabled,
    initialPageParam: 1,
    queryFn: ({pageParam, signal}) => {
      const load = publicAccess && kind in publicLoaders ? publicLoaders[kind as keyof typeof publicLoaders] : loaders[kind];
      return (load as Function)({ ...params, ...(kind !== "appointments" ? { status: "active" } : {}), search: debounced, page: pageParam, pageSize: 20 }, { signal: directoryRequestSignal(signal) }) as Promise<{ items: RecordValue[]; total: number }>;
    },
    getNextPageParam: (last,pages) => pages.reduce((count,page)=>count+page.items.length,0)<last.total?pages.length+1:undefined
  });
  const records=query.data?.pages.flatMap(page=>page.items)||[];
  const selected = useQuery<RecordValue>({
    ...(publicAccess && kind in publicLoaders ? publicSelectedCareOptions(actor, kind, value, params,
      (p, signal) => (publicLoaders[kind as keyof typeof publicLoaders] as Function)(p, { signal })) : {
    queryKey: ["care-selected", actor, kind, publicAccess, value, params],
    enabled: !!value && !records.some(item => item.id === value),
    retry: false,
    queryFn: async (): Promise<RecordValue> => {
      if (kind === "appointments") return { ...await api.getAppointment(value) };
      const load = publicAccess && kind in publicLoaders ? publicLoaders[kind as keyof typeof publicLoaders] : loaders[kind];
      const result = await (load as Function)({ ...params, selectedIds: value, page: 1, pageSize: 20 });
      const record = result.items.find((item: RecordValue) => item.id === value);
      if (!record) throw new Error("Selected record is no longer available in this scope.");
      return record as RecordValue;
    },
    }),
  });
  const selectedRecord = selected.data?.id === value ? selected.data : undefined;
  retained.current = retainSelectedRecords(selected.error ? new Map() : retained.current, value ? [value] : [], [...records, ...(selectedRecord ? [selectedRecord] : [])]);
  // Keep current menu records available to the onChange callback, without a directory cache.
  const display = (item: RecordValue) => recordLabel(item, kind === "appointments");
  const options = records.filter(item => item.status !== "inactive").map(item => ({ value: item.id, label: display(item), disabled: false }));
   if (value && !options.some(option => option.value === value) && !selected.error) {
     const record = retained.current.get(value);
     if (record) options.unshift({ value, label: display(record), disabled: true });
   }
  const plural=label==="Your appointment"?"your appointments":`${label.toLowerCase()}s`;
   return <><SearchableSelect retainSelectionLabel={false} labelScope={labelScope} label={label} value={value} options={options} onChange={id => {
     const record = records.find(item=>item.id===id);
     if (record && publicAccess && kind in publicLoaders && !query.isError) {
       retainPublicSelectedCare(client, actor, kind, params, record, query.dataUpdatedAt);
     }
     onChange(id, record || retained.current.get(id));
   }} onSearchChange={setSearch} placeholder={`Search ${plural}…`} loading={query.isFetching || selected.isFetching} error={selected.error ? "Unable to load selected name. Your selection has been retained." : query.error ? `Unable to load ${plural}. Please try again.` : undefined} onRetry={()=>{if(!disabled)void query.refetch();if(value)void selected.refetch();}} disabled={disabled} hasMore={query.hasNextPage} onLoadMore={()=>{void query.fetchNextPage();}} /></>;
}