import { assert } from "./http";

/** Additive optimistic precondition over authoring fields; labels are not schedule state. */
export const SCHEDULE_SNAPSHOT_KEYS = ["doctorId","clinicId","branchId","dayOfWeek","isOpen","startTime","endTime","breakStart","breakEnd","timezone","tokenPrefix","maxTokens","consultationMinutes","bufferMinutes","queueMode","queueOpenTime","queueCloseTime","status","linkedBranchId","linkedIntervalKey"].sort();
export function scheduleSnapshot(row: Record<string, unknown>) {
  return JSON.stringify(Object.fromEntries(SCHEDULE_SNAPSHOT_KEYS.map(k=>[k,row[k]??null])));
}
/** Call only after acquiring the same doctor locks used by every schedule writer. */
export function assertScheduleSnapshot(row: Record<string, unknown>, expected?: unknown) {
  if(expected===undefined)return; // older clients remain compatible
  assert(typeof expected==="string" && expected.length<=20000,400,"Invalid schedule snapshot. Reload the schedule before retrying.");
  assert(scheduleSnapshot(row)===expected,409,"This session was changed by another administrator. Reload the schedule and review your draft before retrying.");
}
