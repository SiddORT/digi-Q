import { randomUUID } from "node:crypto";
import { db, settings, users } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { assert } from "./http";
import { lockCredentials } from "./native-auth";

/**
 * A durable sending claim spans the provider call, not a long-lived SQL
 * transaction. Account removal must hold the credential locks and reject every
 * linked sending/unknown claim. A crashed or uncertain send is never timed out
 * into "safe to delete".
 *
 * `work` must include all snapshot/history completion writes. Only after it
 * returns is deletion allowed to erase this barrier. A caller must not use a
 * detached callback or do private-data writes after this function returns.
 */
export async function withStaffDispatch<T>(
  userIds: string[], source: "invitation" | "recovery" | "notification" | "test" | "booking" | "media",
  work: () => Promise<T>, conn: any = db, isUncertain: (value: T) => boolean = () => false,
): Promise<T> {
  const ids = [...new Set(userIds.filter(Boolean))].sort();
  if (!ids.length) return work();
  const id = `staff-dispatch:${randomUUID()}`, claimId = randomUUID(), createdAt = Date.now();
  await conn.transaction(async (tx: any) => {
    // Canonical order also matters when a notification refers to multiple staff.
    for (const userId of ids) await lockCredentials(tx, userId);
    for (const userId of ids) {
      const [user] = await tx.select({ id: users.id, status: users.status, role: users.role }).from(users).where(eq(users.id, userId)).for("share");
      // Recipient activation is the caller's existing policy. A doctor whose
      // login is inactive can still be the subject of a patient cancellation.
      assert(user && ["superAdmin", "clinicAdmin", "doctor", "receptionist"].includes(user.role),
        409, "Staff account is no longer available for this dispatch");
    }
    await tx.insert(settings).values({ id, data: { claimId, userIds: ids, source, state: "sending", createdAt } });
  });
  const finish = async (state: "completed" | "delivery_unknown") => {
    // Never recreate an erased marker from a stale in-memory snapshot.
    await conn.execute(sql`update settings set data=data || ${JSON.stringify({ state, finishedAt: Date.now() })}::jsonb
      where id=${id} and data->>'claimId'=${claimId} and data->>'state'='sending'`);
  };
  try {
    const value = await work();
    await finish(isUncertain(value) ? "delivery_unknown" : "completed");
    return value;
  } catch (error: any) {
    const knownNoUncertainSend = ["EMAIL_UNCONFIGURED", "EMAIL_PRE_DISPATCH_FAILED", "EMAIL_REJECTED"].includes(error?.code);
    // If persistence fails, the original sending marker remains and blocks
    // removal. Never replace the original provider error with a retry hint.
    try { await finish(knownNoUncertainSend ? "completed" : "delivery_unknown"); } catch { /* fail closed */ }
    throw error;
  }
}
