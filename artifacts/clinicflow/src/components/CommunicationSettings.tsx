import { useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useWorkspaceLeaveGuard } from "../lib/use-workspace-leave-guard";
import { EmailProviderPanel } from "./EmailProviderPanel";
import { NotificationSmsSettings } from "./NotificationSmsSettings";
import { WorkspaceTabs } from "../clinic";
import { communicationTab } from "../lib/communication-routes";
import { NotificationLogs } from "./NotificationLogs";
import { useConfirm } from "./ConfirmDialog";
import "./communication.css";

/** Provider credentials only. Event wording and activation live in Notification Templates. */
export function CommunicationSettings() {
  const search = useSearch(); const [location, navigate] = useLocation();
  const tab = communicationTab(new URLSearchParams(search).get("tab"));
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const any = Object.values(dirty).some(Boolean);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const anyBusy = Object.values(busy).some(Boolean);
  const [resetN, setResetN] = useState(0);
  const markBusy = (id: string) => (b: boolean) => setBusy(m => m[id] === b ? m : { ...m, [id]: b });
  const confirm = useConfirm();
  const askRef = useRef(confirm.ask); askRef.current = confirm.ask;
  const discardAll = () => { setResetN(n => n + 1); setDirty({}); setBusy({}); };
  useWorkspaceLeaveGuard("/admin/communication", any || anyBusy, (o: any) => askRef.current(o));
  useEffect(() => {
    if (!any) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [any]);
  const mark = (id: string) => (d: boolean) => setDirty(m => m[id] === d ? m : { ...m, [id]: d });
  const select = async (next: string) => {
    if (anyBusy) return;
    if (any) {
      if (!await askRef.current({ title: "Discard unsaved changes?", description: "Switching tabs discards your unsaved provider edits, including any new secret you typed.", confirmLabel: "Discard and Switch", tone: "danger" })) return;
      discardAll();
    }
    navigate(`${location}?tab=${next}`);
  };
  const tabs = [{ id: "sms", label: "SMS Settings" }, { id: "email", label: "Email Settings" }, { id: "logs", label: "Notification Logs" }];
  return <>{confirm.dialog}
    <WorkspaceTabs tabs={tabs} area={tab} onSelect={id => void select(id)} label="Communication settings" />
    <div hidden={tab !== "sms"} data-testid="panel-communication-sms">
      <NotificationSmsSettings key={`sms-${resetN}`} inline onDirtyChange={mark("sms")} onBusyChange={markBusy("sms")} />
    </div>
    <div hidden={tab !== "email"} data-testid="panel-communication-email"><EmailProviderPanel key={`smtp-${resetN}`} onDirtyChange={mark("smtp")} onBusyChange={markBusy("smtp")} /></div>
  <div hidden={tab !== "logs"} data-testid="panel-communication-logs">{tab === "logs" && <NotificationLogs />}</div>
  </>;
}
export default CommunicationSettings;
