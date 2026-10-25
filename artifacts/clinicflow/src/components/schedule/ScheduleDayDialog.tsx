import { useState } from "react";
import { AppDialog } from "../AppDialog";
import { WeeklyScheduleEditor } from "./WeeklyScheduleEditor";

/** Fixed server-validated row scope; never a picker that can retarget a dirty draft. */
export function ScheduleDayDialog({row,onClose}:{row:any;onClose:()=>void}) {
  const [dirty,setDirty]=useState(false);
  const [busy,setBusy]=useState(false);
  return <AppDialog open size="wide" title="Edit Schedule" onClose={onClose} dirty={dirty} busy={busy}>
    <WeeklyScheduleEditor doctorId={row.doctorId} branchId={row.branchId} initialDay={Number(row.dayOfWeek)} doctorName={row.doctorName} onDirtyChange={setDirty} onBusyChange={setBusy} contextual/>
  </AppDialog>;
}
