import { appointments } from "@workspace/db";
import { z } from "zod";
import { canRead, roles } from "./auth";
import { assert } from "./http";
import { one, change, audit } from "./store";
import { lockQueue } from "./appointments";
import { bookingMobile } from "./booking-contact";
import { permissionPolicy } from "./permission-policy";
import { getCustomRoles } from "./custom-roles";

export const bookingDetailsUpdate = z.object({
  expectedRevision: z.number().int().min(0),
  expectedBookingDetailsRevision: z.number().int().min(0),
  bookingMobile: z.string().max(16),
  notes: z.string().max(1000),
}).strict();

export function canEditBooking(user: any, row: any) {
  return ["superAdmin", "clinicAdmin", "doctor", "receptionist"].includes(user.role) &&
    !["completed", "cancelled"].includes(row.status);
}

/** One permission snapshot per response, not one directory/config read per visit. */
export async function bookingEditPermission(user: any, conn: any) {
  if (user.role === "superAdmin") return (_row: any) => true;
  const policy = await permissionPolicy(conn);
  const custom = await getCustomRoles(conn);
  const denied = policy.denied.includes(`${user.role}:appointments:update`);
  const bindings = custom.bindings.filter(b => b.userId === user.id && custom.roles.some(r =>
    r.id === b.roleId && r.baseRole === user.role && r.denied.includes("appointments:update")));
  return (row: any) => !denied && !bindings.some(b => !b.clinicId || b.clinicId === row.clinicId);
}

/** Queue lock + revision check serialize with scheduling and lifecycle writers.
 * Never update the patient, contact proofs, notification authority or event outbox. */
export async function updateBookingDetails(user: any, id: string, input: unknown, tx: any) {
  roles(user, ["superAdmin", "clinicAdmin", "doctor", "receptionist"]);
  const body = bookingDetailsUpdate.parse(input);
  const initial = await one(appointments, id, tx);
  assert(await canRead(user, "appointments", initial, tx), 403, "Appointment outside your scope");
  await lockQueue(tx, initial.doctorId, initial.branchId, initial.date);
  const row = await one(appointments, id, tx);
  assert(await canRead(user, "appointments", row, tx), 403, "Appointment outside your scope");
  assert(canEditBooking(user, row), 409, "This visit can no longer be edited.");
  assert((await bookingEditPermission(user, tx))(row), 403, "Your administrator has disabled booking edits.");
  assert(row.doctorId === initial.doctorId && row.branchId === initial.branchId && row.date === initial.date &&
    (row.revision || 0) === body.expectedRevision &&
    (row.bookingDetailsRevision || 0) === body.expectedBookingDetailsRevision, 409, "Appointment changed. Your draft has not been saved; review the latest booking before trying again.");
  const mobile = bookingMobile(body.bookingMobile);
  const notes = body.notes.trim();
  if (mobile === row.bookingMobile && notes === (row.notes || "")) return row;
  // The lifecycle revision owns automatic notification eligibility. Contact/notes
  // have their own revision so editing them cannot obsolete or recapture a message.
  const data = { ...row, bookingMobile: mobile, notes, bookingDetailsRevision: (row.bookingDetailsRevision || 0) + 1,
    history: [...(row.history || []), { status: row.status, action: "booking_details_updated",
      occurredAt: new Date().toISOString(), actorId: user.id, actorKind: user.role,
      reason: "Visit contact or notes updated. Patient profile and notification recipients unchanged." }] };
  const saved = await change(appointments, id, { data }, tx);
  await audit(user, "booking_details_updated", "appointments", row, tx);
  return saved;
}
