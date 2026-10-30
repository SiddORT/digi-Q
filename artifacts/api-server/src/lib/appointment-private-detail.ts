import { db, patients, users, assignments } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { canRead, scope } from "./auth";
import { flatten } from "./store";

const recordedRoles = new Set(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]);
const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value : null;

/** Read-only detail enrichment. Deliberately NOT used by list, ticket, QR or receipt serializers. */
export async function privateAppointmentDetail(row: any, user: any, conn: any = db, events: any[] = row.history || []) {
  const [storedPatient] = await conn.select().from(patients).where(eq(patients.id, row.patientId));
  const patient = flatten(storedPatient);
  const permitted = patient && await canRead(user, "patients", patient, conn);
  // Match the existing patient writer: visit-based read access is not registration write authority.
  const canEdit = !!permitted && (user.role === "superAdmin" ||
    ["clinicAdmin", "receptionist"].includes(user.role) && !!patient.clinicId && scope(user, patient.clinicId, patient.branchId) ||
    user.role === "patient" && patient.id === user.patientId);
  const privatePatient = permitted ? {
    fullName: text(patient.fullName), code: text(patient.code), gender: text(patient.gender),
    dateOfBirth: text(patient.dateOfBirth), mobile: text(patient.mobile), email: text(patient.email), canEdit,
    age: typeof patient.age === "number" ? patient.age : null, ageReferenceDate: text(patient.ageReferenceDate),
  } : null;

  // Fetch only actors actually referenced by this history, and only fields needed for permission/name projection.
  const ids: string[] = [...new Set<string>(events.filter((e: any) => !e.deletedActor && e.actorKind !== "system")
    .map((e: any) => e.actorId).filter((id: any) => typeof id === "string" && !!id))];
  const actors = ids.length ? await conn.select({ id: users.id, fullName: users.fullName, role: users.role,
    managingAdminId: users.managingAdminId }).from(users).where(inArray(users.id, ids)) : [];
  const actorAssignments = ids.length ? await conn.select({ userId: assignments.userId, clinicId: assignments.clinicId,
    branchId: assignments.branchId }).from(assignments).where(inArray(assignments.userId, ids)) : [];
  const names = new Map<string, string>();
  for (const actor of actors) {
    const ownAssignments = actorAssignments.filter((a: any) => a.userId === actor.id);
    const scopedActor = { ...actor, clinicIds: ownAssignments.map((a: any) => a.clinicId).filter(Boolean),
      branchIds: ownAssignments.map((a: any) => a.branchId).filter(Boolean) };
    if ((permitted && patient.userId === actor.id || await canRead(user, "users", scopedActor, conn)) &&
      text(actor.fullName)) names.set(actor.id, actor.fullName);
  }
  const history = row.history && events.map((event: any) => {
    // Explicitly recorded move labels only. Never fill historical gaps from today's directory.
    // A deletion marker wins even if an old cached label survived in malformed data.
    const snapshot = (value: any) => value ? {
      ...Object.fromEntries(["date", "startTime", "endTime", "timezone"]
        .filter(key => typeof value[key] === "string").map(key => [key, value[key]])),
      ...(value.deletedDoctor ? { deletedDoctor: true } : text(value.doctorName) ? { doctorName: value.doctorName } : {}),
      ...(text(value.branchName) ? { branchName: value.branchName } : {}),
    } : undefined;
    const actorState = event.deletedActor ? "deleted" : event.actorKind === "system" ? "system" :
      event.actorKind === "privateReceipt" ? "receipt" :
      !event.actorId ? "unknown" : names.has(event.actorId) ? "named" :
      !actors.some((actor: { id: string }) => actor.id === event.actorId) ? "deleted" : "unavailable";
    return {
      status: event.status, occurredAt: event.occurredAt,
      ...(text(event.action) ? { action: event.action } : {}),
      ...(text(event.reason) ? { reason: event.reason } : {}),
      ...(event.position != null ? { position: event.position } : {}),
      ...(event.callReleased ? { callReleased: true } : {}),
      ...(event.from ? { from: snapshot(event.from) } : {}),
      ...(event.to ? { to: snapshot(event.to) } : {}),
      actorState, actorDisplayName: actorState === "named" ? names.get(event.actorId) : null,
      actorRecordedRole: recordedRoles.has(event.actorKind) ? event.actorKind : null,
    };
  });
  return { privatePatient, ...(history ? { history } : {}) };
}
