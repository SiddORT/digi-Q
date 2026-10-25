import { hashPassword } from "./native-auth";
import { assert } from "./http";
import { eligibleStaffMobile } from "./security-notifications";
import { createHash } from "node:crypto";
import { settings, users, doctors } from "@workspace/db";
import { eq } from "drizzle-orm";
import { one } from "./store";
import { enrich } from "./entities";
import { canRead } from "./auth";

function canonical(value: any): any {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort()
    .filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])]));
  return value;
}
export const staffReceiptKey = (actorId: string, requestId: string) => `staff-create-receipt:${actorId}:${requestId}`;
export function staffRequestDigest(body: any) {
  const { password: _password, confirmPassword: _confirm, requestId: _request, ...safe } = body;
  return createHash("sha256").update(JSON.stringify(canonical(safe))).digest("hex");
}
export async function staffCreationReplay(conn: any, actor: any, kind: string, requestId: string | undefined, digest: string) {
  if (!requestId) return undefined;
  const [receipt] = await conn.select().from(settings).where(eq(settings.id, staffReceiptKey(actor.id, requestId)));
  if (!receipt) return undefined;
  assert(receipt.data.kind === kind && receipt.data.digest === digest, 409, "This request already saved different details. Open the saved staff account.");
  const row = await enrich(kind, await one(kind === "doctors" ? doctors : users, receipt.data.entityId, conn), conn);
  assert(await canRead(actor, kind, row, conn), 403, "The saved account is no longer in your scope.");
  return row;
}

/** Consume secrets before any generic JSON projection, receipt or audit. */
export async function takeStaffCredentials(input: any, editing = false) {
  const { password, confirmPassword, ...body } = input;
  if (password === undefined && confirmPassword === undefined) return { body, credentials: undefined };
  assert(!editing, 400, "Use password recovery to change an existing password.");
  assert(typeof password === "string" && password === confirmPassword, 400, "Passwords must match.");
  const mobile = eligibleStaffMobile(body.mobile);
  assert(mobile && String(body.mobile).startsWith("+"), 400, "Enter a valid mobile number with country code.");
  body.mobile = mobile;
  return { body, credentials: {
    passwordHash: await hashPassword(password), passwordChangedAt: new Date(),
    emailVerifiedAt: null, invitationStatus: "notRequired",
  } };
}
