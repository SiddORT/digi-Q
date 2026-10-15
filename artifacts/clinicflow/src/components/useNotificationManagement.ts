import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { eventControlError } from "../lib/communication-routes";
import { refreshNotificationManagement } from "../lib/notification-management";
import { useConfirm } from "./ConfirmDialog";
import { groupActivationChanges, notificationGroup, sameActivationRows } from "../lib/notification-groups";
import { titleCase } from "../lib/title-case";

/** Mounted for one actor/scope only. Confirmations and requests hold that target. */
export function useNotificationManagement(clinicId: string, enabled: boolean, superAdmin: boolean, lock: MutableRefObject<boolean>, blocked: () => boolean) {
  const qc = useQueryClient();
  const params = clinicId ? { clinicId } : {};
  const query = api.useGetManagedNotificationSettings(params, { query: {
    queryKey: api.getGetManagedNotificationSettingsQueryKey(params), enabled, staleTime: 15000,
  } });
  const gateSave = api.useSaveManagedNotificationSettings();
  const confirm = useConfirm();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const alive = useRef(true);
  const latest = useRef(query); latest.current = query;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  async function change(row?: api.EventControlRow, event?: string) {
    const baseline = latest.current.data;
    const group = baseline && event ? notificationGroup(baseline.items, event) : undefined;
    if (lock.current || blocked() || !baseline || !baseline.canActivate || latest.current.isError || latest.current.isFetching ||
        ((row || event) && (!baseline.canActivate || row?.canActivate === false || row?.required)) || (group && !group.optional.length)) return;
    lock.current = true; setPending(true); setError(""); setNotice("");
    const next = group ? group.next : !(row ? row.enabled : baseline.notificationsEnabled);
    try {
      const ok = await confirm.ask({
        title: titleCase(`${next ? "Enable" : "Disable"} ${group ? `${event!.replaceAll("_", " ")} — all ${group.optional.length} optional options` : row ? `${row.event.replaceAll("_", " ")} ${row.channel} to ${row.recipient}` : "overall optional delivery"}?`),
        description: `Scope: ${baseline.scopeName} (${clinicId ? "clinic override" : "platform defaults"}). ${group ? `All ${group.optional.length} optional channel/recipient options for this event are included, even those hidden by filters. Required rows are excluded. Existing inheritance is retained for unchanged options; changed options are saved in this scope. Wording and unpublished drafts are kept. The overall gate stays ${baseline.notificationsEnabled ? "on" : "off"}; activation does not confirm provider readiness.` : row ? "Only this event, channel and recipient will change. Wording and unpublished drafts are kept." : "This gate is separate from template activation. Required security messages remain protected."} Only future eligible events are affected; past events are never replayed. Pending unclaimed messages may be cancelled when disabled.`,
        confirmLabel: next ? "Enable" : "Disable", tone: next ? "default" : "danger",
      });
      if (!ok || !alive.current) return;
      // Reauthorize and reread inherited values before acting on a confirmation.
      const current = await latest.current.refetch();
      if (!alive.current) return;
      const freshRow = row && current.data?.items.find(r => r.channel === row.channel && r.event === row.event && r.recipient === row.recipient);
      if (current.isError || !current.data?.canActivate || current.data?.revision !== baseline.revision || current.data?.notificationsEnabled !== baseline.notificationsEnabled || current.data?.inherited !== baseline.inherited ||
          (row && (!current.data?.canActivate || !freshRow || freshRow.canActivate === false || freshRow.required || freshRow.revision !== row.revision || freshRow.enabled !== row.enabled || freshRow.source !== row.source)) ||
          (group && (!current.data?.canActivate || !sameActivationRows(baseline.items.filter(r => r.event === event), current.data.items.filter(r => r.event === event))))) {
        setError("Settings or permissions changed during confirmation. Nothing was saved. Review the latest values and try again.");
        return;
      }
      {
        const result = await gateSave.mutateAsync({ data: {
          ...(clinicId ? { clinicId } : {}), revision: baseline.revision,
          ...(group ? { changes: groupActivationChanges(group.optional, next) } : row ? {
            changes: [{ channel: row.channel, event: row.event, recipient: row.recipient, revision: row.revision, enabled: next }],
          } : { notificationsEnabled: next, changes: [] }),
          confirmed: true,
        } });
        qc.setQueryData(api.getGetManagedNotificationSettingsQueryKey(params), result);
      }
      // Acknowledge only after this target's persisted view is read back.
      await refreshNotificationManagement(qc);
      const saved = await latest.current.refetch();
      const savedRow = row && saved.data?.items.find(r => r.channel === row.channel && r.event === row.event && r.recipient === row.recipient);
      if (!alive.current) return;
      const savedGroup = event && saved.data ? notificationGroup(saved.data.items, event) : undefined;
      if (saved.isError || (group ? !savedGroup || savedGroup.optional.length !== group.optional.length ||
          !group.optional.every(before => savedGroup.optional.some(after => after.channel === before.channel && after.recipient === before.recipient && after.enabled === next)) ||
          saved.data?.notificationsEnabled !== baseline.notificationsEnabled
        : row ? savedRow?.enabled !== next : saved.data?.notificationsEnabled !== next)) {
        setError("The request finished, but its saved state could not be confirmed. Reload before trying again.");
      } else setNotice(`${group ? `All ${group.optional.length} optional options for ${event!.replaceAll("_", " ")}` : row ? "Template activation" : "Overall delivery gate"} saved for ${baseline.scopeName}. Only future eligible events are affected.`);
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
  return { query, change, changeGroup: (event: string) => change(undefined, event), pending, error, notice, dialog: confirm.dialog, locked: () => lock.current };
}
