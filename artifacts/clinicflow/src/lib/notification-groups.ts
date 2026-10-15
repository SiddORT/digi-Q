type ActivationRow = {
  channel: "email" | "sms"; event: string; recipient: string; enabled: boolean;
  required?: boolean; revision: number; source: string;
};

/** Always pass the full saved catalog, never the filtered display rows. */
export function notificationGroup<T extends ActivationRow>(items: T[], event: string) {
  const optional = items.filter(row => row.event === event && !row.required);
  const status = !optional.length ? "Required" : optional.every(row => row.enabled)
    ? "Enabled" : optional.every(row => !row.enabled) ? "Disabled" : "Custom";
  return { optional, status, checked: status === "Enabled", next: status !== "Enabled" };
}

export function sameActivationRows(before: ActivationRow[], after: ActivationRow[]) {
  const snapshot = (rows: ActivationRow[]) => rows.map(row => JSON.stringify([
    row.channel, row.event, row.recipient, !!row.required, row.revision, row.enabled, row.source,
  ])).sort();
  return JSON.stringify(snapshot(before)) === JSON.stringify(snapshot(after));
}

export function groupActivationChanges<T extends ActivationRow>(rows: T[], enabled: boolean) {
  return rows.filter(row => !row.required && row.enabled !== enabled).map(({ channel, event, recipient, revision }) =>
    ({ channel, event, recipient, revision, enabled }));
}
