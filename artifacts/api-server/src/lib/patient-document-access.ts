import { db, patients, appointments } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { canRead, scope } from "./auth";
import { assert } from "./http";

const STAFF = ["superAdmin", "clinicAdmin", "doctor", "receptionist"];
export async function readablePatient(user: any, id: string) {
  const [row] = await db.select().from(patients).where(eq(patients.id, id));
  assert(row && await canRead(user, "patients", row), 404, "Patient not found");
  return row!;
}
export async function documentClinics(user: any, patient: any) {
  if (!STAFF.includes(user.role)) return [];
  const visits = await db.select({ clinicId: appointments.clinicId, branchId: appointments.branchId, doctorId: appointments.doctorId }).from(appointments).where(eq(appointments.patientId, patient.id));
  const ids = new Set<string>([...(patient.clinicId && user.role !== "doctor" ? [patient.clinicId] : []), ...visits.filter(v => user.role !== "doctor" || v.doctorId === user.doctorId && scope(user, v.clinicId, v.branchId)).map(v => v.clinicId)]);
  if (user.role === "doctor" && user.handoffHistoryInstalled) {
    const historical = await db.execute(sql`select distinct ht.clinic_id,ht.from_branch_id from appointment_transitions ht
      where ht.patient_id=${patient.id} and ht.from_doctor_id=${user.doctorId}`);
    for (const row of historical.rows as any[]) if (scope(user, row.clinic_id, row.from_branch_id)) ids.add(row.clinic_id);
  }
  return [...ids].filter(c => user.role === "superAdmin" || user.clinicIds.includes(c));
}
export const visibleClinic = (user: any, clinicId: string, doctorClinics: string[]) => user.role === "superAdmin" || user.role === "patient" || (user.role === "doctor" ? doctorClinics.includes(clinicId) : user.clinicIds.includes(clinicId));
