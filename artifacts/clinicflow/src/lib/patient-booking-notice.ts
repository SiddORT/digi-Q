/** A persisted reservation is a booking confirmation, not a delivery or read receipt. */
export function isPatientBookingConfirmation(record: { status: string; checkedInAt?: string | null; consultationStartedAt?: string | null }) {
  return ["booked", "waiting"].includes(record.status) && !record.checkedInAt && !record.consultationStartedAt;
}