import { sql } from "drizzle-orm";
import { assert } from "./http";

/** Protect encrypted writes before they hide locators from database guards.
 * Missing additive schema is tolerated only for ordinary legacy operation;
 * deletion readiness separately requires the table and all write guards. */
export async function assertNoErasedAssetReference(conn: any, value: unknown) {
  const exists = await conn.execute(sql`select to_regclass('public.staff_erased_assets') is not null as present`);
  if (!exists.rows[0]?.present) return;
  const result = await conn.execute(sql`select 1 from staff_erased_assets f
    join clinicflow_asset_alias_fingerprints(${JSON.stringify(value) ?? ""}) a on a=f.asset_fingerprint limit 1`);
  assert(!result.rows.length, 409, "An erased asset cannot be referenced or recreated");
  const identities = await conn.execute(sql`select to_regclass('public.staff_erased_identities') is not null as present`);
  if (identities.rows[0]?.present) {
    const erased = await conn.execute(sql`select 1 from staff_erased_identities f
      join clinicflow_json_identity_tokens(${JSON.stringify(value) ?? "null"}::jsonb) token
      on f.identity_fingerprint=encode(sha256(convert_to(token,'UTF8')),'hex') limit 1`);
    assert(!erased.rows.length, 409, "A removed staff identity cannot be restored");
  }
}
