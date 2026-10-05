// Pure, dependency-free link builders for global search (unit tested without React).
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const GROUPS = ["date", "clinic", "doctor"] as const;
export type ReportGroup = (typeof GROUPS)[number];

/** Explicit report search window: the 30 days ending `today` (inclusive). Shown in the result heading. */
export function reportSearchRange(today: string) {
  const end = new Date(`${today}T00:00:00Z`);
  const start = new Date(end.getTime() - 29 * 86400000);
  return { from: start.toISOString().slice(0, 10), to: today };
}

export function reportSearchHref(role: string, p: { groupBy: ReportGroup; from: string; to: string; search: string }) {
  const q = new URLSearchParams({ group: p.groupBy, from: p.from, to: p.to, search: p.search });
  return `/${role}/reports?${q}`;
}

/** Initial Reports state from the URL. Invalid or inverted values fall back to today / date grouping. */
export function parseReportParams(search: string, today: string) {
  const q = new URLSearchParams(search);
  let from = q.get("from") || "", to = q.get("to") || "";
  if (!ISO.test(from) || !ISO.test(to) || from > to) { from = today; to = today; }
  const g = q.get("group") || "";
  return { from, to, groupBy: (GROUPS as readonly string[]).includes(g) ? g as ReportGroup : "date" as ReportGroup, search: (q.get("search") || "").slice(0, 200) };
}

/** Today's visits open the exact queue session with the visit selected; other dates open the appointment record. */
export function queueRecordHref(role: string, r: { id: string; reference: string; today: boolean; clinicId: string; branchId: string; doctorId: string; date: string; startTime?: string | null; sessionId?: string | null }, canQueue: boolean) {
  if (r.today && canQueue) {
    const q = new URLSearchParams({ clinic: r.clinicId, branch: r.branchId, doctor: r.doctorId, date: r.date, appointment: r.id });
    if (r.sessionId) q.set("sessionId", r.sessionId);
    if (r.startTime) q.set("startTime", r.startTime);
    return `/${role}/queue?${q}`;
  }
  return `/${role}/appointments?view=all&search=${encodeURIComponent(r.reference || r.id)}`;
}
