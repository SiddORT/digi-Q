import { db, pool, masters, settings } from "@workspace/db";
import { randomUUID } from "node:crypto";
// System vocabulary only. This command never inserts people, clinics or bookings.
const values: Record<string, string[]> = {
  userRole: ["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"],
  userStatus: ["active", "inactive"], clinicStatus: ["active", "inactive"],
  appointmentStatus: ["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"],
  queueStatus: ["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"],
  bookingSource: ["online", "walkIn", "phone", "qr"], queueType: ["mixed", "appointmentsOnly", "walkInsOnly"],
  appointmentType: ["newVisit", "followUp"], consultationType: ["inPerson"],
  clinicType: ["clinic", "hospital"], clinicCategory: ["general", "specialist"],
  queuePriority: ["standard"], tokenPrefix: ["A"],
  cancellationReason: ["patientRequest", "doctorUnavailable"],
  specialization: ["generalMedicine"], qualification: ["MBBS"], department: ["outpatient"],
};
async function main() {
  await db.transaction(async tx => {
    for (const [category, codes] of Object.entries(values)) {
      for (const [sortOrder, code] of codes.entries()) {
        const name = code.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
        await tx.insert(masters).values({ id: randomUUID(), category, code, data: { name, sortOrder } }).onConflictDoNothing();
      }
    }
    await tx.insert(settings).values({ id: "platform", data: { platformName: "ClinicFlow", timezone: "Asia/Kolkata", bookingHorizonDays: 60, cancellationCutoffMinutes: 0, requireMobileVerification: false, otpExpirySeconds: 300, otpMaxAttempts: 5, sessionTimeoutMinutes: 60, notificationsEnabled: false } }).onConflictDoNothing();
  });
  process.stdout.write("System master vocabulary and settings seeded; no demo records created.\n");
}
main().catch(e => { process.stderr.write(`${e.message}\n`); process.exitCode = 1; }).finally(() => pool.end());