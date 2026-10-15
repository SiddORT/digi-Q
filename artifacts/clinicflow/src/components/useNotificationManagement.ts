import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { eventControlBody, eventControlError } from "../lib/communication-routes";
import { refreshNotificationManagement } from "../lib/notification-management";
import { useConfirm } from "./ConfirmDialog";

/** Mounted for one actor/scope only. Confirmations and requests hold that target. */
export function useNotificationManagement(clinicId: string, enabled: boolean, superAdmin: boolean) {
  const qc = useQueryClient();
  const params = clinicId ? { clinicId } : {};
  const query = api.useGetManagedNotificationSettings(params, { query: {
    queryKey: api.getGetManagedNotificationSettingsQueryKey(params), enabled, staleTime: 15000,
  } });
  const gateSave = api.useSaveManagedNotificationSettings();
  const rowSave = api.useUpdateEventControl();
  const confirm = useConfirm();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const alive = useRef(true);
  const latest = useRef(query); latest.current = query;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  async function change(row?: api.EventControlRow) {
    const baseline = latest.current.data;
    if (lock.current || !baseline || latest.current.isError || latest.current.isFetching || (row && (!superAdmin || !baseline.canActivate || row.required))) return;
    lock.current = true; setPending(true); setError(""); setNotice("");
    const next = !(row ? row.enabled : baseline.notificationsEnabled);
    try {
      const ok = await confirm.ask({
        title: `${next ? "Enable" : "Disable"} ${row ? `${row.event.replaceAll("_", " ")} ${row.channel} to ${row.recipient}` : "overall optional delivery"}?`,
        description: `Scope: ${baseline.scopeName}. ${row ? "Only this event, channel and recipient will change. Wording and unpublished drafts are kept." : "This gate is separate from template activation. Required security messages remain protected."} Only future eligible events are affected; past events are never replayed. Pending unclaimed messages may be cancelled when disabled.`,
        confirmLabel: next ? "Enable" : "Disable", tone: next ? "default" : "danger",
      });
      if (!ok || !alive.current) return;
      // Reauthorize and reread inherited values before acting on a confirmation.
      const current = await latest.current.refetch();
      if (!alive.current) return;
      const freshRow = row && current.data?.items.find(r => r.channel === row.channel && r.event === row.event && r.recipient === row.recipient);
      if (current.isError || current.data?.revision !== baseline.revision || current.data?.notificationsEnabled !== baseline.notificationsEnabled || current.data?.inherited !== baseline.inherited ||
          (row && (!current.data?.canActivate || !freshRow || freshRow.required || freshRow.revision !== row.revision || freshRow.enabled !== row.enabled || freshRow.source !== row.source))) {
        setError("Settings or permissions changed during confirmation. Nothing was saved. Review the latest values and try again.");
        return;
      }
      if (row) {
        await rowSave.mutateAsync({ data: eventControlBody(row, next, clinicId) as api.EventControlInput });
      } else {
        const result = await gateSave.mutateAsync({ data: {
          ...(clinicId ? { clinicId } : {}), revision: baseline.revision,
          notificationsEnabled: next, confirmed: true, changes: [],
        } });
        qc.setQueryData(api.getGetManagedNotificationSettingsQueryKey(params), result);
      }
      // Acknowledge only after this target's persisted view is read back.
      await refreshNotificationManagement(qc);
      const saved = await latest.current.refetch();
      const savedRow = row && saved.data?.items.find(r => r.channel === row.channel && r.event === row.event && r.recipient === row.recipient);
      if (!alive.current) return;
      if (saved.isError || (row ? savedRow?.enabled !== next : saved.data?.notificationsEnabled !== next)) {
        setError("The request finished, but its saved state could not be confirmed. Reload before trying again.");
      } else setNotice(`${row ? "Template activation" : "Overall delivery gate"} saved for ${baseline.scopeName}. Only future eligible events are affected.`);
    } catch (e) {
      if (alive.current) {
        setError(eventControlError(e));
        await refreshNotificationManagement(qc);
      }
    } finally {
      lock.current = false;
      if (alive.current) setPending(false);
    }
  }
  return { query, change, pending, error, notice, dialog: confirm.dialog, locked: () => lock.current };
}
