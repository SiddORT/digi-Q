import { useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { SearchableSelect } from "./SearchableSelect";
import { useDebouncedValue } from "./ListingControls";
import { ResourceLookup } from "./ResourceLookup";

type RecordValue = { id: string; name?: string; fullName?: string; reference?: string; doctorName?: string; token?: number | string; branchName?: string; [key: string]: unknown };
type Kind = "clinics" | "branches" | "doctors" | "patients" | "appointments";
const loaders = { clinics: api.listClinics, branches: api.listBranches, doctors: api.listDoctors, patients: api.listPatients, appointments: api.listAppointments };
const publicLoaders = { clinics: api.listPublicClinics, branches: api.listPublicBranches, doctors: api.listPublicDoctors };
export function useSelectedCare(kind: "clinics" | "branches" | "doctors" | "patients", id: string, isPublic = false, params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: ["selected-care", kind, id, isPublic, params],
    enabled: !!id,
    queryFn: async () => {
      // Public endpoints are also scoped and accept selectedIds for retained values.
      if (isPublic && kind !== "patients") {
        const response = await (publicLoaders[kind] as Function)({ ...params, selectedIds: id, page: 1, pageSize: 20 });
        const selected = response.items.find((item: RecordValue) => item.id === id) as RecordValue | undefined;
        if (!selected) throw new Error(`The selected ${kind.replace(/s$/, "")} is no longer available in this scope. Choose another record.`);
        return selected;
      }
      const get = { clinics: api.getClinic, branches: api.getBranch, doctors: api.getDoctor, patients: api.getPatient }[kind];
      return await (get as Function)(id) as RecordValue;
    }
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
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search);
  const retained = useRef(new Map<string, RecordValue>());
  const query = useInfiniteQuery({
    queryKey: ["care-options", kind, publicAccess, params, debounced],
    enabled: !disabled,
    initialPageParam: 1,
    queryFn: ({pageParam}) => {
      const load = publicAccess && kind in publicLoaders ? publicLoaders[kind as keyof typeof publicLoaders] : loaders[kind];
      return (load as Function)({ ...params, ...(kind !== "appointments" ? { status: "active" } : {}), search: debounced, page: pageParam, pageSize: 20 }) as Promise<{ items: RecordValue[]; total: number }>;
    },
    getNextPageParam: (last,pages) => pages.reduce((count,page)=>count+page.items.length,0)<last.total?pages.length+1:undefined
  });
  const records=query.data?.pages.flatMap(page=>page.items)||[];
  records.forEach(item=>retained.current.set(item.id,item));
  const display = (item: RecordValue) => item.name || item.fullName || [item.token, item.doctorName, item.branchName, item.reference].filter(Boolean).join(" · ") || item.id;
  const options = records.filter(item => item.status !== "inactive").map(item => ({ value: item.id, label: display(item), disabled: false }));
  if (value && !options.some(option => option.value === value)) options.unshift({ value, label: selectedLabel || (retained.current.has(value) ? display(retained.current.get(value)!) : "Selected record"), disabled: true });
  const plural=label==="Your appointment"?"your appointments":`${label.toLowerCase()}s`;
  return <><SearchableSelect label={label} value={value} options={options} onChange={id => onChange(id, retained.current.get(id))} onSearchChange={setSearch} placeholder={`Search ${plural}…`} loading={query.isFetching} error={query.error ? `Unable to load ${plural}. Please try again.` : undefined} onRetry={()=>void query.refetch()} disabled={disabled} hasMore={query.hasNextPage} onLoadMore={()=>{void query.fetchNextPage();}} /></>;
}