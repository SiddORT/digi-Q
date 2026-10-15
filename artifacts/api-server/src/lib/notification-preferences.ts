import { db, settings, patients, clinics } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requiredEvent } from "./security-template-definitions";

export type PersonalPreferences = {
  revision: number;
  choices: Record<string, boolean>;
  epochs: Record<string, number>;
};
const preferenceId = (userId: string) => `notification-preferences:${userId}`;
export const preferenceKey = (channel: string, event: string) => `${channel}:${event}`;

/** Serialize opt-out with capture and the durable dispatch claim, NOT network I/O.
 * Queue writers already hold their queue lock: never acquire a queue lock after this barrier.
 * A single advisory key also covers legacy pending rows without linked-account metadata.
 */
export async function lockNotificationPreferences(conn: any) {
  await conn.execute(sql`select pg_advisory_xact_lock(hashtext('notification-preference-barrier'))`);
}
export async function personalPreferences(userId: string, conn: any = db): Promise<PersonalPreferences> {
  const [row] = await conn.select().from(settings).where(eq(settings.id, preferenceId(userId)));
  return { revision: 0, choices: {}, epochs: {}, ...row?.data };
}
export async function recipientPreference(conn: any, userId: string | null | undefined, channel: string, event: string, capturedEpoch?: number) {
  if (!userId || requiredEvent(event)) return { enabled: true, epoch: 0 };
  const preferences = await personalPreferences(userId, conn);
  const key = preferenceKey(channel, event), epoch = preferences.epochs[key] || 0;
  return { enabled: preferences.choices[key] !== false && (capturedEpoch === undefined || capturedEpoch === epoch), epoch };
}
/** Resolve accounts from authoritative relations, not matching contact strings. Guests inherit. */
export async function notificationRecipientUser(conn: any, data: any): Promise<string | null> {
  if (data.recipientUserId) return data.recipientUserId;
  const patientId = data.recipientPatientId || (data.recipientGroup === "patient" ? data.snapshot?.patientId : null);
  if (patientId) {
    const [patient] = await conn.select({ userId: patients.userId }).from(patients).where(eq(patients.id, patientId));
    return patient?.userId || null;
  }
  if (data.event === "onboarding" && data.recipientGroup !== "superAdmin") {
    const [clinic] = await conn.select({ adminId: clinics.adminId }).from(clinics).where(eq(clinics.id, data.clinicId));
    return clinic?.adminId || null;
  }
  return null;
}
export async function pendingPreferenceAllowed(conn: any, data: any, channel: "email" | "sms") {
  const userId = await notificationRecipientUser(conn, data);
  // A later account link must not turn a guest occurrence into an opted-in account occurrence.
  if (data.preferenceUserId !== undefined && (data.preferenceUserId || null) !== userId) return false;
  return (await recipientPreference(conn, userId, channel, data.event, data.preferenceEpoch ?? 0)).enabled;
}
export async function writePersonalPreferences(conn: any, userId: string, value: PersonalPreferences) {
  await conn.insert(settings).values({ id: preferenceId(userId), data: value })
    .onConflictDoUpdate({ target: settings.id, set: { data: value } });
}
