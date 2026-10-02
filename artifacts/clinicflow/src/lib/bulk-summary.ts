/** One consolidated outcome for bulk actions (spec §7.7, finding 79). */
export interface BulkOutcome { label: string; ok: boolean; message?: string }
export interface BulkSummary { tone: "success" | "warning" | "critical"; title: string; failures: string[] }

export function summarizeBulk(outcomes: BulkOutcome[], verb = "updated"): BulkSummary {
  const total = outcomes.length;
  const done = outcomes.filter((o) => o.ok).length;
  const failures = outcomes.filter((o) => !o.ok).map((o) => (o.message ? `${o.label}: ${o.message}` : o.label));
  const title = `${done} of ${total} ${verb}`;
  return { tone: done === total ? "success" : done === 0 ? "critical" : "warning", title, failures };
}
