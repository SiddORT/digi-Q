/** The report API exposes three terminal outcomes; all remaining visits stay visible. */
export function reportOtherVisits(row: { appointments: number; completed: number; cancelled: number; noShow: number }) {
  return row.appointments - row.completed - row.cancelled - row.noShow;
}

export function reportOutcomeSummary(row: { appointments: number; completed: number; cancelled: number; noShow: number }) {
  const other = reportOtherVisits(row);
  return other < 0
    ? "Status totals are inconsistent. Refresh this report."
    : `${other} other (booked, waiting, called, in consultation or other statuses)`;
}