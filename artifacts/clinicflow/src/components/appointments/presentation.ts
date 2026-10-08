/** Completed consultations retain history, but no longer need an admission ticket. */
export function canShowAppointmentTicket(appointment: { status: string }) {
  return appointment.status !== "completed";
}

/** A failed private-resource check must not fall back to a cached patient record.
 * Network/server refresh failures may retain the view; client/access failures may not. */
export function isPrivateAppointmentUnavailable(error: unknown) {
  const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
  return typeof status === "number" && status >= 400 && status < 500;
}