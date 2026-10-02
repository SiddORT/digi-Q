import { csvCell } from "./admin-listing-data.ts";

export type PatientRow = { id: string; code?: string; fullName?: string; mobile?: string | null; email?: string | null; dateOfBirth?: string; age?: number; gender?: string; address?: string; emergencyContactName?: string; emergencyContactPhone?: string; status?: string; createdAt?: string };
type PatientPage = { items: PatientRow[]; total: number };

/** Loads every page of the current filtered, sorted patient list. Any failure or change mid-export aborts with no rows. */
export async function collectFilteredPatients(params: Record<string, unknown>, load: (params: Record<string, unknown>, signal: AbortSignal) => Promise<PatientPage>, signal: AbortSignal, progress: (loaded: number, total: number) => void = () => {}): Promise<PatientRow[]> {
  const { page: _page, pageSize: _size, ...filters } = params;
  const records: PatientRow[] = []; const ids = new Set<string>(); let expected: number | undefined;
  for (let page = 1; ; page++) {
    signal.throwIfAborted();
    const batch = await load({ ...filters, page, pageSize: 100 }, signal);
    signal.throwIfAborted();
    if (!Number.isInteger(batch.total) || batch.total < 0) throw new Error("Export could not verify the total.");
    if (expected !== undefined && batch.total !== expected) throw new Error("Patients changed while exporting.");
    expected = batch.total;
    if (!batch.items.length && records.length < expected) throw new Error("Patients changed while exporting.");
    for (const record of batch.items) { if (ids.has(record.id)) throw new Error("Patients changed while exporting."); ids.add(record.id); records.push(record); }
    progress(records.length, expected);
    if (records.length >= expected) break;
  }
  if (records.length !== expected) throw new Error("Patients changed while exporting.");
  return records;
}

const HEADERS = ["Patient code", "Full name", "Mobile", "Email", "Date of birth", "Age", "Gender", "Address", "Emergency contact name", "Emergency contact phone", "Status", "Registered"];
const label = (value?: string) => value ? value.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase()) : "";

/** Only patient-facing profile fields; internal ids, linked user ids and verification metadata are excluded. */
export function filteredPatientsCsv(rows: PatientRow[], formatDate: (value: string) => string, formatTimestamp: (value: string) => string) {
  return "\uFEFF" + [HEADERS, ...rows.map(p => [p.code, p.fullName, p.mobile, p.email, p.dateOfBirth ? formatDate(p.dateOfBirth) : "", p.age, label(p.gender), p.address, p.emergencyContactName, p.emergencyContactPhone, label(p.status), p.createdAt ? formatTimestamp(p.createdAt) : ""])].map(row => row.map(csvCell).join(",")).join("\r\n");
}
