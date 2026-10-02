import type { Appointment, AppointmentList, ListAppointmentsParams } from "@workspace/api-client-react";
import { formatDate, formatTime } from "../../lib/date-time";

/** Read only the actor's authorized list; never broaden the filters for export. */
export async function collectFilteredAppointments(
  params: ListAppointmentsParams,
  load: (params: ListAppointmentsParams, signal: AbortSignal) => Promise<AppointmentList>,
  signal: AbortSignal,
  progress: (loaded: number, total: number) => void = () => {},
): Promise<Appointment[]> {
  const records: Appointment[] = [];
  const ids = new Set<string>();
  let expected: number | undefined;
  for (let page = 1; ; page++) {
    signal.throwIfAborted();
    const batch = await load({ ...params, page, pageSize: 100 }, signal);
    signal.throwIfAborted();
    if (!Number.isInteger(batch.total) || batch.total < 0) throw new Error("Export could not verify the total. Refresh and try again.");
    if (expected !== undefined && batch.total !== expected) throw new Error("Appointments changed while exporting. Refresh and try again.");
    expected = batch.total;
    if (!batch.items.length && records.length < expected) throw new Error("Appointments changed while exporting. Refresh and try again.");
    for (const record of batch.items) {
      if (ids.has(record.id)) throw new Error("Appointments changed while exporting. Refresh and try again.");
      ids.add(record.id);
      records.push(record);
    }
    if (records.length > expected) throw new Error("Appointments changed while exporting. Refresh and try again.");
    progress(records.length, expected);
    if (records.length === expected) return records;
  }
}

export function filteredAppointmentsCsv(records: Appointment[]): string {
  const cell = (value: unknown) => `"${String(value ?? "").replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""')}"`;
  const rows = [
    ["Reference", "Patient", "Clinic Group", "Clinic", "Doctor", "Date", "Session start", "Session end", "Token", "Status"],
    ...records.map(a => [a.reference, a.patientName, a.clinicName, a.branchName, a.doctorName, formatDate(a.date, a), a.startTime ? formatTime(a.startTime, a) : "", a.endTime ? formatTime(a.endTime, a) : "", a.token, a.status]),
  ];
  return rows.map(row => row.map(cell).join(",")).join("\r\n");
}