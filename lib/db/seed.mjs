import pg from "pg";
import { SeedError, seedConfig, seedWithPool } from "./seed-core.mjs";

async function main() {
  // Avoid creating a pool for skipped or malformed configuration.
  const config = seedConfig(process.env);
  if (!config) {
    process.stdout.write("Super administrator seed skipped: SUPERADMIN_EMAIL and SUPERADMIN_NAME are both omitted.\n");
    return;
  }
  if (!process.env.DATABASE_URL) throw new SeedError("DATABASE_URL must be set to seed the super administrator.");

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await seedWithPool(pool, process.env);
    process.stdout.write(`Super administrator seed ${result.status}: ${result.reason}\n`);
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  // Never print driver errors, SQL, connection strings, or env values.
  process.stderr.write(`${error instanceof SeedError ? error.message : "Super administrator seed failed; check database availability and migrations."}\n`);
  process.exitCode = 1;
});