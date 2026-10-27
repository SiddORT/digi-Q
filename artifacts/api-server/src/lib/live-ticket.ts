import { randomBytes, createHash } from "node:crypto";
import { db, appointments, settings, branches, clinics } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { assert } from "./http";
import { one } from "./store";
import { publicUrl } from "./public-website";
import { estimateContext } from "./appointment-estimates";
import { arrivalEstimate } from "./arrival-estimate";
import { appointmentViewWithBranch, lockQueue } from "./appointments";
import { clinicDisplayPreferences } from "./display-preferences";
export const liveHash = (secret: string) => createHash("sha256").update(secret).digest("hex");
const generationKey = (id: string) => `live-ticket-generation:${id}`;
async function generation(id: string, conn: any) {
  const [row] = await conn.select().from(settings).where(eq(settings.id, generationKey(id)));
  return Number(row?.data?.generation || 0);
}
/** Random, independently revocable read-only capabilities. No plaintext secret is persisted. */
export async function issueLiveLink(row: any, conn: any = db) {
  // Refuse issuance before persisting anything if canonical links are unconfigured.
  const secret = randomBytes(32).toString("hex");
  const url = publicUrl(`/live-ticket#${secret}`);
  return conn.transaction(async (tx: any) => {
    await lockQueue(tx, row.doctorId, row.branchId, row.date);
    const current = await one(appointments, row.id, tx);
    const expiresAt = new Date(Date.parse(current.date + "T00:00:00Z") + 3 * 86400000).toISOString();
    assert(Date.parse(expiresAt) > Date.now(), 409, "This visit is too old for a live link");
    // Remove expired hashes opportunistically. Never store the share URL.
    await tx.delete(settings).where(sql`${settings.id} like 'live-ticket:%' and (${settings.data}->>'expiresAt') < ${new Date().toISOString()}`);
    await tx.insert(settings).values({ id: `live-ticket:${liveHash(secret)}`, data: { appointmentId: row.id, expiresAt, generation: await generation(row.id, tx) } });
    return { url, expiresAt };
  });
}
export async function revokeLiveLinks(row: any, conn: any = db) {
  return conn.transaction(async (tx: any) => {
    await lockQueue(tx, row.doctorId, row.branchId, row.date);
    const next = await generation(row.id, tx) + 1;
    await tx.insert(settings).values({ id: generationKey(row.id), data: { generation: next } }).onConflictDoUpdate({ target: settings.id, set: { data: { generation: next } } });
  });
}
export async function readLiveStatus(capability: string, user: any = null, conn: any = db) {
  const [stored] = await conn.select().from(settings).where(eq(settings.id, `live-ticket:${liveHash(capability)}`));
  const access = stored?.data;
  assert(access && Date.parse(access.expiresAt) > Date.now(), 404, "Live ticket link is invalid, expired or revoked");
  const row = await one(appointments, access.appointmentId, conn);
  assert(access.generation === await generation(row.id, conn), 404, "Live ticket link is invalid, expired or revoked");
  const context = await estimateContext(row, conn);
  const branch = await one(branches, row.branchId, conn);
  const clinic = await one(clinics, row.clinicId, conn);
  const estimate = arrivalEstimate(row, context.rows, context.duration, context.presence.status);
  // Whitelist, never spread a saved booking, receipt, history or presence object.
  const minimal = { ...clinicDisplayPreferences(clinic), clinicName: row.clinicName, doctorName: row.doctorName, branchName: row.branchName,
    branchAddress: row.branchAddress ?? branch.address ?? null, date: row.date, startTime: row.startTime ?? null, endTime: row.endTime ?? null,
    timezone: row.timezone ?? null, status: row.status, token: row.token, presence: context.presence.status, estimate, updatedAt: estimate.asOf };
  const owner = user?.role === "patient" && user.patientId && user.patientId === row.patientId;
  return { ...minimal, ...(owner ? { appointment: await appointmentViewWithBranch(row, user, conn) } : {}) };
}
