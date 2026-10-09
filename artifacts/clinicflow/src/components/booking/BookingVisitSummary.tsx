import type { ReactNode } from "react";
import { BookingSummary } from "./StagedBooking";
import { bookingFields } from "./booking-fields";
import { formatDate, type DateTimePreferences } from "../../lib/date-time";
import { formatSessionHours } from "../queue/SessionSelector";

export function BookingVisitSummary({ clinicName, branchName, doctorName, date, session, patientName, notes, contacts = [], preferences = {} }: {
  clinicName?: string; branchName?: string; doctorName?: string; date: string;
  session?: { startTime?: string | null; endTime?: string | null; timezone?: string | null };
  patientName?: string; notes?: string; contacts?: [string, ReactNode][]; preferences?: Partial<DateTimePreferences>;
}) {
  return <BookingSummary rows={[
    [bookingFields.clinic.label, clinicName], [bookingFields.location.label, branchName],
    [bookingFields.doctor.label, doctorName], [bookingFields.date.label, formatDate(date, preferences)],
    [bookingFields.session.label, session ? `${formatSessionHours({ ...session, ...preferences })} · ${session.timezone || "Timezone unavailable"}` : ""],
    [bookingFields.patient.label, patientName], ...contacts, [bookingFields.notes.label, notes?.trim()],
  ]}/>;
}
