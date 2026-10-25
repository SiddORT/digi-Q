import { useState } from "react";
import { AppDialog } from "../AppDialog";
import { WeeklyScheduleEditor } from "./WeeklyScheduleEditor";

/** Fixed server-validated row scope; never a picker that can retarget a dirty draft. */
export function ScheduleDayDialog({row,onClose}:{row:any;onClose:()=>void}) {
  const [dirty,setDirty]=useState(false);
  const [busy,setBusy]=useState(false);
  return <AppDialog open size="wide" title="Edit Schedule" onClose={onClose} dirty={dirty} busy={busy}>
    <p className="doctor-context-value">{row.doctorName || "Doctor"} · {row.branchName || "Location"}</p>
    <p className="muted">{row.timezone||"Location timezone"} · {row.timeFormat==="24h"?"24-hour":"12-hour (AM/PM)"} · Display settings are inherited from the clinic.</p>
    <WeeklyScheduleEditor doctorId={row.doctorId} branchId={row.branchId} initialDay={Number(row.dayOfWeek)} doctorName={row.doctorName} onEdit={()=>{}} onDirtyChange={setDirty} onBusyChange={setBusy} contextual/>
  </AppDialog>;
}
