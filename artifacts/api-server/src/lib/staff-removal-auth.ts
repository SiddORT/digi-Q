import { sql } from "drizzle-orm";
import { assert } from "./http";
import { lockCredentials } from "./native-auth";

/** Same credential-lock namespace as native password/session issuance. */
export async function lockStaffCredentials(tx: any, identities: string[]) {
  for (const id of [...new Set(identities)].sort()) {
    await lockCredentials(tx, id);
  }
}

/** Never trust a role, active flag, or session identity supplied by the client. */
export async function assertLiveRemovalActor(tx: any, actorId: string, sessionHash: string | undefined) {
  assert(sessionHash, 401, "Sign in required");
  const result = await tx.execute(sql`select u.id,u.role,u.status,u.data from users u
    join auth_sessions s on s.user_id=u.id
    where u.id=${actorId} and s.token_hash=${sessionHash} and s.revoked_at is null
      and s.expires_at>now()
    for share of u,s`);
  const actor: any = result.rows[0];
  assert(actor, 401, "Your session ended. Sign in again");
  assert(actor.role === "superAdmin" && actor.status === "active" && !actor.data?.demo && !actor.data?.demoFixture,
    403, "Real active Superadmin access required");
  return actor;
}
