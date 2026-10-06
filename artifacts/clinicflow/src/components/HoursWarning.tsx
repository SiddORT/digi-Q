/** Section F: one shared downstream warning when a bookable session extends beyond ordinary location hours. */
export function HoursWarning({ warning }: { warning?: string | null }) {
  if (!warning) return null;
  return <p className="notice" role="note" data-testid="availability-hours-warning">Extended doctor hours: this session runs outside the location's usual opening hours. It is bookable; check entry arrangements with the clinic.</p>;
}
