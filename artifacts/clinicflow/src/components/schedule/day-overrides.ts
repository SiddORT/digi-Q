import { planWeek, type DraftDay, type ScheduleRow } from "./week-plan";
import type { ScheduleInput } from "@workspace/api-client-react";

/** Reuse normal input normalization for every interval, including unchanged inherited intervals. */
export function dayOverrideSlots(rows: ScheduleRow[], day: DraftDay, template: Record<string, unknown> | undefined) {
  if (!day.isOpen) return [];
  const editable = rows.filter(r=>r.dayOfWeek===day.dayOfWeek).map(r=>({...r,linkedBranchId:null}));
  const draft = {...day,sessions:day.sessions.map(s=>({...s,locked:false}))};
  const plan = planWeek(editable, [draft], template, ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]);
  return day.sessions.map(s => {
    const update = plan.updates.find(w=>w.key===s.key);
    const write = update || plan.creates.find(w=>w.key===s.key);
    const original = editable.find(r=>r.id===s.id);
    const adopted = plan.adopt.find(a=>a.key===s.key);
    const row = original || editable.find(r=>r.id===(update?.id || adopted?.id));
    return { key: s.key, id: row?.id, session: (write?.body || row!) as unknown as ScheduleInput };
  });
}
