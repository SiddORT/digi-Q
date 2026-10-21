import { useMemo, useState, type KeyboardEvent } from "react";
import { readableLabel } from "@/lib/selection-label";

/** Opt-in local paging: search the entire catalog but mount only one page. */
export function useLocalOptionPages<T extends { value: string; label: string }>(
  options: T[], search: string, remote: boolean, pageSize?: number,
) {
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => remote ? options : options.filter(option =>
    readableLabel(option.label, option.value).toLowerCase().includes(search.toLowerCase())
  ), [options, search, remote]);
  const size = !remote && pageSize && pageSize > 0 ? Math.floor(pageSize) : undefined;
  const lastPage = size ? Math.max(0, Math.ceil(filtered.length / size) - 1) : 0;
  const currentPage = Math.min(page, lastPage);
  const keepButtonKeys = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") event.stopPropagation();
  };
  return {
    pageKey: size ? currentPage : 0,
    options: size ? filtered.slice(currentPage * size, (currentPage + 1) * size) : filtered,
    reset: () => setPage(0),
    navigation: size && filtered.length > size ? <div className="flex shrink-0 items-center justify-between gap-2 border-t p-2" aria-label="Option pages">
      <button type="button" className="button secondary small" disabled={currentPage === 0}
        onKeyDown={keepButtonKeys} onClick={() => setPage(currentPage - 1)}>Previous options</button>
      <span role="status" className="text-xs" aria-live="polite">{currentPage * size + 1}–{Math.min((currentPage + 1) * size, filtered.length)} of {filtered.length}</span>
      <button type="button" className="button secondary small" disabled={currentPage === lastPage}
        onKeyDown={keepButtonKeys} onClick={() => setPage(currentPage + 1)}>Next options</button>
    </div> : null,
  };
}
