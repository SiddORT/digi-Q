/** Completed consultations retain history, but no longer need an admission ticket. */
export function canShowAppointmentTicket(appointment: { status: string }) {
  return appointment.status !== "completed";
}