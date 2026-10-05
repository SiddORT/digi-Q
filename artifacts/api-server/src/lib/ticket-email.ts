import { db, appointments, patients, users, settings, clinics } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { canRead, roles } from "./auth";
import { assert } from "./http";
import { one, getSettings, audit } from "./store";
import { appointmentViewWithBranch } from "./appointments";
import { confirmationText } from "./appointment-confirmation";
import { getAppointmentQr } from "./appointment-qr";
import { validEmailAddress, smtpConfig } from "./integration-config";
import { resolvedIntegration } from "./integration-vault";
import { sendAuthEmail } from "./auth-email";
import { consumeRateLimit } from "./native-auth";
import { logger } from "./logger";

export async function ticketEmailPreview(user: any, id: string) {
  roles(user, ["superAdmin", "clinicAdmin", "doctor", "receptionist"]);
  const row = await one(appointments, id);
  assert(await canRead(user, "appointments", row), 403, "Appointment outside your scope");
  const patient = await one(patients, row.patientId);
  const account = patient.userId ? await one(users, patient.userId) : null;
  const recipient = String(account?.email || patient.email || "").trim();
  let reason = "";
  if (process.env.NODE_ENV !== "production") reason = "Email delivery is disabled in development.";
  else if (!(await getSettings(db, row.clinicId)).notificationsEnabled) reason = "Email notifications are disabled for this clinic.";
  else if (!validEmailAddress(recipient)) reason = "No valid email address is recorded. Update the patient record first.";
  else {
    try { smtpConfig((await resolvedIntegration("smtp")).env); }
    catch { reason = "Email delivery is not configured."; }
  }
  return { recipient, eligible: !reason, reason };
}

async function ticketAttachment(user: any, id: string) {
  const row = await one(appointments, id);
  const view = await appointmentViewWithBranch(row, user);
  const clinic = await one(clinics, row.clinicId);
  const qr = await getAppointmentQr(user, id);
  const origin = process.env.CLINICFLOW_PUBLIC_ORIGIN;
  assert(origin && /^https:\/\/[^/]+$/.test(origin), 503, "Public ticket links are not configured");
  const pdf = new jsPDF();
  const root = process.cwd().endsWith("api-server") ? process.cwd() : resolve(process.cwd(), "artifacts/api-server");
  const font = await readFile(resolve(root, "assets/ticket-font.ttf"));
  pdf.addFileToVFS("ticket.ttf", font.toString("base64"));
  pdf.addFont("ticket.ttf", "Ticket", "normal"); pdf.setFont("Ticket");
  const logo = await readFile(resolve(root, "../clinicflow/public/digiq-doctors-logo.png"));
  pdf.addImage(logo.toString("base64"), "PNG", 15, 10, 40, 20);
  pdf.setFontSize(18); pdf.text("Visit Ticket", 65, 23);
  pdf.setFontSize(11);
  const text = `${view.patientName}\nWaiting number: ${view.token}\nCurrent status: ${view.status}\n${view.branchAddress ? `Address: ${view.branchAddress}\n` : ""}\n${confirmationText(view, clinic).replace("Your appointment is confirmed.", "Visit details.")}\nKeep your QR private. Staff must confirm consultation check-in.`;
  const lines = pdf.splitTextToSize(text, 175);
  let y = 40;
  for (const line of lines) {
    if (y > 270) { pdf.addPage(); y = 15; }
    pdf.text(line, 15, y); y += 6;
  }
  if (y > 205) { pdf.addPage(); y = 15; }
  pdf.addImage(await QRCode.toDataURL(new URL(qr.checkInUrl, origin).href, { width: 500, margin: 2 }), "PNG", 15, y + 5, 60, 60);
  return Buffer.from(pdf.output("arraybuffer"));
}

export async function emailTicket(user: any, id: string, requestId: string, recipient: string) {
  const preview = await ticketEmailPreview(user, id);
  assert(preview.eligible, 409, preview.reason);
  assert(preview.recipient === recipient, 409, "Recipient changed. Review and confirm again.");
  const attachment = await ticketAttachment(user, id); // failures before claim are safe to retry
  const key = `ticket-email:${createHash("sha256").update(`${user.id}:${id}:${requestId}`).digest("hex")}`;
  const claim = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
    const [existing] = await tx.select().from(settings).where(eq(settings.id, key));
    if (existing) return false;
    await tx.insert(settings).values({ id: key, data: { state: "dispatching", appointmentId: id, at: Date.now() } });
    return true;
  });
  if (!claim) {
    const [existing] = await db.select().from(settings).where(eq(settings.id, key));
    return { state: (existing.data as any).state === "provider_accepted" ? "provider_accepted" : "unknown" };
  }
  try {
    await consumeRateLimit(`ticket-email:${user.id}`, 100);
    await consumeRateLimit(`ticket-email-appointment:${id}`, 3);
    const current = await ticketEmailPreview(user, id);
    assert(current.eligible && current.recipient === recipient, 409, "Recipient or delivery settings changed. Review again.");
    await sendAuthEmail(preview.recipient, "Your visit ticket", "Your private visit ticket is attached. The session is a time range, not an exact consultation time.", undefined, undefined,
      [{ filename: "visit-ticket.pdf", content: attachment, contentType: "application/pdf" }]);
    await db.update(settings).set({ data: { state: "provider_accepted", appointmentId: id, at: Date.now() } }).where(eq(settings.id, key));
    await audit(user, "email-ticket", "appointments", { id }).catch(() => { logger.error("Ticket email audit could not be recorded"); });
    return { state: "provider_accepted" };
  } catch {
    await db.update(settings).set({ data: { state: "unknown", appointmentId: id, at: Date.now() } }).where(eq(settings.id, key));
    return { state: "unknown" }; // never automatically retry an uncertain SMTP dispatch
  }
}
