type ActivationRow = {
  channel: "email" | "sms"; event: string; recipient: string; enabled: boolean;
  required?: boolean; canActivate?: boolean; revision: number; source: string;
};

/** Always pass the full saved catalog, never the filtered display rows. */
export function notificationGroup<T extends ActivationRow>(items: T[], event: string) {
  const optional = items.filter(row => row.event === event && row.canActivate !== false);
  const status = !optional.length ? "Unavailable" : optional.every(row => row.enabled)
    ? "Enabled" : optional.every(row => !row.enabled) ? "Disabled" : "Custom";
  return { optional, status, checked: status === "Enabled", next: status !== "Enabled" };
}

export function sameActivationRows(before: ActivationRow[], after: ActivationRow[]) {
  const snapshot = (rows: ActivationRow[]) => rows.map(row => JSON.stringify([
    row.channel, row.event, row.recipient, !!row.required, row.canActivate, row.revision, row.enabled, row.source,
  ])).sort();
  return JSON.stringify(snapshot(before)) === JSON.stringify(snapshot(after));
}

export function groupActivationChanges<T extends ActivationRow>(rows: T[], enabled: boolean) {
  return rows.filter(row => row.canActivate !== false && row.enabled !== enabled).map(({ channel, event, recipient, revision }) =>
    ({ channel, event, recipient, revision, enabled }));
}
