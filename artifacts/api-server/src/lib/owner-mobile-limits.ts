import { createHash } from "node:crypto";
import { db } from "@workspace/db";
import type { OwnerMobileRequestGuidance } from "@workspace/api-zod";
import { sql } from "drizzle-orm";
import { HttpError } from "./http";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");

/** Same persisted keys, fixed windows and IP → subject → phone consumption order.
 * Commit consumed allowances before preparation/delivery, including failed sends.
 * Lock every relevant row so overlapping exhausted windows have one safe wait.
 */
export async function consumeOwnerMobileRequests(subject: string, mobileHash: string, ip: string) {
  const limits = [
    { name: "sourceIp" as const, key: digest(`owner-mobile:ip:${ip}`), max: 60, ms: 600_000 },
    { name: "subjectMinute" as const, key: digest(`owner-mobile:subject:${subject}`), max: 5, ms: 60_000 },
    { name: "mobileHour" as const, key: digest(`owner-mobile:phone:${mobileHash}`), max: 10, ms: 3600_000 },
  ];
  const result = await db.transaction(async tx => {
    // Deterministic ordering also covers concurrent sessions sharing a phone/IP.
    for (const key of limits.map(limit => limit.key).sort())
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"owner-mobile-limit:" + key}))`);
    // Transaction now() predates lock waits. Start/reset windows at admission,
    // not when a contender first joined the queue for a connection or lock.
    const now = (await tx.execute(sql`select clock_timestamp() as current_time`)).rows[0]!.current_time as Date;
    let blocked = false;
    const guidance = { retryAfterSeconds: 0 } as OwnerMobileRequestGuidance;
    for (const limit of limits) {
      const row = (await tx.execute(sql`select attempts,
        greatest(0,ceil(extract(epoch from (expires_at-${now}::timestamptz))))::int as seconds
        from auth_rate_limits where key=${limit.key} for update`)).rows[0];
      const active = Number(row?.seconds) > 0;
      let attempts = active ? Number(row!.attempts) : 0;
      let seconds = active ? Number(row!.seconds) : 0;
      if (attempts >= limit.max) blocked = true;
      if (!blocked) {
        attempts++;
        if (!active) seconds = limit.ms / 1000;
        await tx.execute(sql`insert into auth_rate_limits (key,attempts,expires_at)
          values (${limit.key},${attempts},${now}::timestamptz+(${limit.ms} * interval '1 millisecond'))
          on conflict (key) do update set attempts=${attempts},
          expires_at=case when auth_rate_limits.expires_at<=${now}::timestamptz
            then ${now}::timestamptz+(${limit.ms} * interval '1 millisecond') else auth_rate_limits.expires_at end`);
      }
      const remaining = Math.max(0, limit.max - attempts);
      guidance[limit.name] = { remaining, resetAfterSeconds: seconds };
      if (remaining === 0) guidance.retryAfterSeconds = Math.max(guidance.retryAfterSeconds, seconds);
    }
    return { blocked, guidance };
  });
  // Throw outside the transaction: earlier counters must not be refunded.
  if (result.blocked) throw new HttpError(429, "Please wait before requesting another SMS code.",
    "OWNER_MOBILE_RATE_LIMITED", result.guidance);
  return result.guidance;
}
