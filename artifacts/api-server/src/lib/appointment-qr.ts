import { createHmac, timingSafeEqual } from "node:crypto";
import { db, appointments } from "@workspace/db";
import { all, one } from "./store";
import { assert } from "./http";
import { canRead, roles } from "./auth";
import { doctorContext, localNow } from "./availability";
import { appointmentViewWithBranch, lockQueue, transition } from "./appointments";
import { orderedReservations, pendingStatuses, sessionRows } from "./queue-order";

const VERSION = "v1";
const SIGNING_CONTEXT = "clinicflow:appointment-qr";
const ALREADY_CHECKED_IN = ["inConsultation"];
const TERMINAL_STATUSES = ["cancelled", "completed", "noShow"];

function secret(): string {
  const value = process.env.SESSION_SECRET;
  assert(value, 503, "Appointment QR service is unavailable");
  return value;
}

function signature(reference: string): Buffer {
  return createHmac("sha256", secret())
    .update(`${SIGNING_CONTEXT}:${VERSION}:${reference}`)
    .digest();
}

export function createAppointmentQrPayload(reference: string): string {
  assert(typeof reference === "string" && reference.length > 0, 400, "Appointment reference is required");
  const encodedReference = Buffer.from(reference, "utf8").toString("base64url");
  return `${VERSION}.${encodedReference}.${signature(reference).toString("base64url")}`;
}

export function readAppointmentQrPayload(payload: string): string {
  assert(typeof payload === "string" && payload.length <= 512, 400, "Invalid appointment QR");
  const parts = payload.split(".");
  assert(parts.length === 3 && parts[0] === VERSION, 400, "Invalid appointment QR");
  let reference: string;
  let suppliedSignature: Buffer;
  try {
    reference = Buffer.from(parts[1], "base64url").toString("utf8");
    suppliedSignature = Buffer.from(parts[2], "base64url");
  } catch {
    assert(false, 400, "Invalid appointment QR");
  }
  const expectedSignature = signature(reference);
  assert(
    reference.length > 0 &&
      parts[1] === Buffer.from(reference, "utf8").toString("base64url") &&
      parts[2] === suppliedSignature.toString("base64url") &&
      suppliedSignature.length === expectedSignature.length &&
      timingSafeEqual(suppliedSignature, expectedSignature),
    400,
    "Invalid appointment QR",
  );
  return reference;
}

async function appointmentFromPayload(payload: string, conn: any = db) {
  const reference = readAppointmentQrPayload(payload);
  const row = (await all(appointments, conn)).find(appointment => appointment.reference === reference);
  assert(row, 404, "Appointment QR not found");
  return row;
}

async function authorizeStaff(user: any, row: any) {
  roles(user, ["superAdmin", "clinicAdmin", "doctor", "receptionist"]);
  assert(await canRead(user, "appointments", row), 403, "Appointment outside your scope");
}

async function validateCheckInState(row: any, conn: any = db) {
  assert(!TERMINAL_STATUSES.includes(row.status), 409, `Cannot check in a ${row.status} appointment`);
  assert(
    ["booked", "checkedIn", "waiting", "called"].includes(row.status) || ALREADY_CHECKED_IN.includes(row.status),
    409,
    "Appointment is not eligible for check-in",
  );
  const { branch } = await doctorContext(row.doctorId, row.branchId, conn);
  const timezone = row.timezone || branch.timezone || "Asia/Kolkata";
  assert(row.date === localNow(timezone).date, 409, "Check-in is allowed only on the appointment date");
}

export async function getAppointmentQr(user: any, appointmentId: string, conn: any = db) {
  const row = await one(appointments, appointmentId, conn);
  assert(await canRead(user, "appointments", row), 403, "Appointment outside your scope");
  const payload = createAppointmentQrPayload(row.reference);
  return {
    appointmentId: row.id,
    payload,
    checkInUrl: `/check-in?payload=${encodeURIComponent(payload)}`,
  };
}

export async function resolveAppointmentQr(user: any, payload: string, conn: any = db) {
  const row = await appointmentFromPayload(payload, conn);
  await authorizeStaff(user, row);
  await validateCheckInState(row, conn);
  const alreadyCheckedIn = ALREADY_CHECKED_IN.includes(row.status);
  const rows = sessionRows(await all(appointments, conn), row);
  const blocked = rows.some(a => a.id !== row.id && ["called", "inConsultation"].includes(a.status))
    || row.status !== "called" && !alreadyCheckedIn && orderedReservations(rows.filter(a => pendingStatuses.includes(a.status)))[0]?.id !== row.id;
  return {
    appointment: await appointmentViewWithBranch(row, user, conn),
    eligible: !alreadyCheckedIn && !blocked,
    alreadyCheckedIn,
    message: alreadyCheckedIn ? "Consultation has already started." : blocked ? "Another reservation must be served or explicitly skipped first." : "Confirm check-in to start consultation.",
  };
}

export async function checkInAppointmentQr(user: any, payload: string) {
  return db.transaction(async tx => {
    let row = await appointmentFromPayload(payload, tx);
    await authorizeStaff(user, row);
    const original = row;
    await lockQueue(tx, row.doctorId, row.branchId, row.date);
    row = await one(appointments, row.id, tx);
    assert(row.doctorId === original.doctorId && row.branchId === original.branchId && row.date === original.date && row.startTime === original.startTime, 409, "Appointment was rescheduled; scan again");
    await authorizeStaff(user, row);
    await validateCheckInState(row, tx);
    if (ALREADY_CHECKED_IN.includes(row.status)) {
      return {
        appointment: await appointmentViewWithBranch(row, user, tx),
        alreadyCheckedIn: true,
        message: "Appointment is already checked in.",
      };
    }
    const appointment = await transition(
      user,
      row.id,
      { action: "checkIn", expectedStatus: row.status },
      tx,
      true,
    );
    return {
      appointment: await appointmentViewWithBranch(appointment, user, tx),
      alreadyCheckedIn: false,
      message: "Appointment checked in; consultation started.",
    };
  });
}