import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { directoryDetail, directoryPage, DIRECTORY_FRESH_MS } from "../lib/directory-cache";
import { useDirectoryActor } from "../lib/use-directory";
import { SearchableSelect } from "./SearchableSelect";

/** The document endpoint owns upload eligibility. Resolve only those exact IDs,
 * twenty at a time; a general clinic directory must not broaden this choice. */
export function DocumentClinicLookup({ ids, value, onChange }: { ids: string[]; value: string; onChange: (id: string) => void }) {
  const actor = useDirectoryActor(), client = useQueryClient();
  const scope = JSON.stringify([actor, ids]);
  const query = useInfiniteQuery({
    queryKey: ["document-upload-clinics", actor, ids],
    initialPageParam: 0, retry: false, staleTime: DIRECTORY_FRESH_MS,
    queryFn: async ({ pageParam }) => {
      const batch = ids.slice(pageParam, pageParam + 20);
      const page = await directoryPage(client, actor, "clinics", { selectedIds: batch.join(","), page: 1, pageSize: 20 },
        (params, signal) => api.listClinics(params, { signal }));
      return { items: page.items.filter(row => batch.includes(row.id)), next: pageParam + 20 };
    },
    getNextPageParam: last => last.next < ids.length ? last.next : undefined,
  });
  const rows = query.data?.pages.flatMap(page => page.items) || [];
  const selected = useQuery({
    queryKey: ["document-upload-clinic-name", actor, value],
    enabled: !!value && ids.includes(value) && !rows.some(row => row.id === value),
    retry: false, staleTime: DIRECTORY_FRESH_MS,
    queryFn: () => directoryDetail(client, actor, "clinics", value, signal => api.getClinic(value, { signal })),
  });
  const options = [...new Map([...rows, ...(selected.data && ids.includes(selected.data.id) ? [selected.data] : [])]
    .map(row => [row.id, { value: row.id, label: row.name || "Clinic name unavailable" }])).values()];
  return <SearchableSelect label="Clinic" testId="select-document-clinic" labelScope={scope} retainSelectionLabel={false}
    value={value} onChange={id => { if (ids.includes(id)) onChange(id); }} options={options}
    loading={query.isFetching || selected.isFetching} error={query.error || selected.error ? "Clinic names could not be loaded. Your selection is retained." : undefined}
    onRetry={() => { void query.refetch(); if (value) void selected.refetch(); }}
    hasMore={query.hasNextPage} onLoadMore={() => void query.fetchNextPage()}/>;
}
