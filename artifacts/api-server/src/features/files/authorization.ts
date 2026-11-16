import { db, doctors, assignments } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { assert } from "../../lib/http";
import { enforcePermissionPolicy } from "../../lib/permission-policy";
import { readablePatient, documentClinics, visibleClinic } from "../../lib/patient-document-access";

export type FileSubject = { clinicId: string; patientId?: string | null; doctorId?: string | null };
/** Patient identity is global; each file belongs to exactly one clinic. Merely
 * seeing a registered profile never grants the doctor's clinical-file access. */
export async function authorizeFile(user: any, subject: FileSubject, action: "read" | "create" | "delete" | "update") {
  assert(Boolean(subject.patientId) !== Boolean(subject.doctorId), 400, "Choose one file owner");
  const module = subject.patientId ? "patients" : "doctors";
  // Pass only server-resolved scope. A synthetic record ID would make the
  // custom-role resolver look up a nonexistent record (or the wrong clinic).
  await enforcePermissionPolicy(user, { method: action === "read" ? "GET" : action === "delete" ? "DELETE" : action === "create" ? "POST" : "PATCH",
    path: `/${module}`, body: { clinicId: subject.clinicId } });
  if (subject.patientId) {
    const patient = await readablePatient(user, subject.patientId);
    const clinics = await documentClinics(user, patient);
    assert(visibleClinic(user, subject.clinicId, clinics), 404, "File not found");
    if (action === "create") assert(clinics.includes(subject.clinicId), 403, "You cannot upload files in this clinic");
    if (action !== "read") assert(user.role !== "patient", 403, "Patients cannot change files");
    return;
  }
  const [doctor] = await db.select().from(doctors).where(eq(doctors.id, subject.doctorId!));
  assert(doctor && doctor.status !== "retired" && doctor.userId, 404, "File not found");
  const mapped = await db.select().from(assignments).where(and(eq(assignments.userId, doctor!.userId!), eq(assignments.clinicId, subject.clinicId)));
  assert(mapped.length > 0, 404, "File not found");
  assert(user.role === "superAdmin" ||
    user.role === "clinicAdmin" && user.clinicIds.includes(subject.clinicId) && doctor!.ownerAdminId === user.id ||
    user.doctorId === doctor!.id && user.clinicIds.includes(subject.clinicId), 404, "File not found");
}
