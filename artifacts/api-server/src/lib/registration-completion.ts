import { createHash } from "node:crypto";
import { clinics, doctors, users } from "@workspace/db";
import { sql } from "drizzle-orm";
import { assert } from "./http";
import { one, change } from "./store";
import { clinicSettingsResult } from "./clinic-expansion";
import { enrich } from "./entities";

function canonical(value: any): any {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])]));
  return value;
}
export function registrationDigest(body: any) {
  const { password: _password, requestId: _request, ...fields } = body;
  return createHash("sha256").update(JSON.stringify(canonical(fields))).digest("hex");
}
export async function registrationCompletion(actorId: string, requestId: string, mode: string, conn: any, body?: any) {
  const [row] = (await conn.execute(sql`select id, admin_id, data from clinics where data->'registrationReceipt'->>'actorId'=${actorId} and data->'registrationReceipt'->>'requestId'=${requestId} and data->'registrationReceipt'->>'mode'=${mode} limit 1`)).rows;
  if (!row) return null;
  assert(mode !== "self" || row.admin_id === actorId, 403, "The completed clinic is no longer in your ownership.");
  const receipt = row.data.registrationReceipt;
  assert(!body || receipt.digest === registrationDigest(body), 409, "This registration already completed with different details. Open the saved clinic; do not register again.");
  const admin = await one(users, row.admin_id, conn);
  const [doctor] = (await conn.execute(sql`select id from doctors where user_id=${admin.id} limit 1`)).rows;
  const result = { ...await clinicSettingsResult(row.id, conn), doctorId: doctor?.id || null };
  return mode === "admin" ? { ...result, admin: await enrich("users", admin, conn) } : result;
}
export async function saveRegistrationReceipt(actorId: string, mode: string, body: any, clinicId: string, conn: any) {
  if (!body.requestId) return; // Existing API clients remain compatible.
  const clinic = await one(clinics, clinicId, conn);
  await change(clinics, clinicId, { data: { ...clinic, registrationReceipt: { actorId, mode, requestId: body.requestId, digest: registrationDigest(body) } } }, conn);
}
