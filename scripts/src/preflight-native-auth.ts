import { pool } from "@workspace/db";

// Read-only counts. Never print emails, password hashes, identity IDs or tokens.
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for the read-only preflight.");
  const duplicates = await pool.query(`
    SELECT count(*)::integer AS groups, coalesce(sum(accounts), 0)::integer AS affected
    FROM (
      SELECT lower(btrim(email)) AS normalized_email, count(*)::integer AS accounts
      FROM users
      GROUP BY lower(btrim(email))
      HAVING count(*) > 1
    ) collisions
  `);
  const normalization = await pool.query(`
    SELECT count(*)::integer AS needing_normalization
    FROM users WHERE email <> lower(btrim(email))
  `);
  const accounts = await pool.query(`
    SELECT role, status, count(*)::integer AS accounts,
      count(*) FILTER (WHERE nullif(to_jsonb(users)->>'password_hash', '') IS NULL)::integer AS needing_password_setup
    FROM users GROUP BY role, status ORDER BY role, status
  `);
  process.stdout.write(JSON.stringify({
    normalizedEmailCollisionGroups: duplicates.rows[0].groups,
    accountsAffectedByEmailCollisions: duplicates.rows[0].affected,
    emailsNeedingNormalization: normalization.rows[0].needing_normalization,
    byRoleAndStatus: accounts.rows,
  }, null, 2) + "\n");
  if (duplicates.rows[0].groups > 0) {
    process.exitCode = 1;
    process.stderr.write("Resolve case-insensitive email collisions before enabling native authentication.\n");
  }
}

main().catch(() => {
  process.stderr.write("Native-auth preflight failed; verify the database is reachable and migrations are applied.\n");
  process.exitCode = 1;
}).finally(() => pool.end());