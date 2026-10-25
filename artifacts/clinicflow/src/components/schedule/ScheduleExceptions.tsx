import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { AppDialog } from "../AppDialog";
import { Editor, ErrorNotice, resources } from "../../resources";
import { formatDate } from "../../lib/date-time";
import { DateTimePreferencesProvider } from "../DateTimePreferences";

/** The existing scoped exception journey, available from every weekly editor. */
export function ScheduleExceptions({ doctorId, branchId, doctorName, branchName, preferences, disabled, draftDirty, onDirtyChange, onBusyChange }: {
  doctorId: string; branchId: string; doctorName?: string; branchName?: string; preferences: any;
  disabled: boolean; draftDirty: boolean; onDirtyChange: (dirty: boolean) => void; onBusyChange: (busy: boolean) => void;
}) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [dirty, setDirty] = useState(false);
  const query = useQuery({
    queryKey: ["doctor-editor-exceptions", doctorId, branchId], enabled: open, retry: false,
    queryFn: async () => {
      const items: api.AvailabilityException[] = [];
      for (let page = 1; ; page++) {
        const response = await api.listAvailabilityExceptions({ doctorId, branchId, page, pageSize: 100 });
        items.push(...response.items);
        if (items.length >= response.total || !response.items.length) return items;
      }
    },
  });
  const save = useMutation({
    mutationFn: (data: any) => {
      const body = { ...data, doctorId, branchId };
      return editing.id ? api.updateAvailabilityException(editing.id, body) : api.createAvailabilityException(body);
    },
    onSuccess: async () => { setEditing(null); setDirty(false); await client.invalidateQueries(); },
  });
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => { onBusyChange(save.isPending); }, [save.isPending, onBusyChange]);
  const edit = (row: any) => { save.reset(); setDirty(false); setEditing(row); };
  return <DateTimePreferencesProvider value={preferences}>
    <button type="button" className="button secondary small" data-testid="link-week-exceptions" disabled={disabled || draftDirty} title={draftDirty ? "Save or discard the schedule draft first" : undefined} onClick={() => setOpen(true)}>Date Exceptions</button>
    {open && <AppDialog open size="medium" title="Date Exceptions" onClose={() => setOpen(false)}>
      <p className="doctor-context-value">{doctorName || "Doctor"} · {branchName || "Location"}</p>
      <button type="button" className="button secondary small" onClick={() => edit({ isClosed: true, isExtra: false })}>Add Date Exception</button>
      {query.isLoading ? <p role="status">Loading date exceptions…</p> : query.error ? <><ErrorNotice error={query.error}/><button type="button" onClick={() => void query.refetch()}>Retry Date Exceptions</button></> :
        query.data?.length ? query.data.map(row => <div className="notice" key={row.id}><strong>{formatDate(row.date, preferences)}</strong> · {row.reason} <button type="button" onClick={() => edit(row)}>Edit Date Exception</button></div>) : <p className="muted">No date exceptions saved at this location.</p>}
    </AppDialog>}
    {editing && <AppDialog open size="medium" title={editing.id ? "Edit Date Exception" : "Add Date Exception"} dirty={dirty} busy={save.isPending} onClose={() => { setEditing(null); setDirty(false); }}>
      <p className="doctor-context-value">{doctorName || "Doctor"} · {branchName || "Location"}</p>
      <ErrorNotice error={save.error}/>
      <Editor resourceName="exceptions" fields={resources.exceptions.fields.filter(f => !["doctorId", "branchId", "clinicId"].includes(f.key))} initial={{ ...editing, doctorId, branchId }} busy={save.isPending} onDirtyChange={setDirty} onSave={data => save.mutate(data)} submitLabel="Save Date Exception"/>
    </AppDialog>}
  </DateTimePreferencesProvider>;
}
