import { randomUUID } from "node:crypto";

export class SeedError extends Error {
  constructor(message) {
    super(message);
    this.name = "SeedError";
  }
}

export function seedConfig(env) {
  const emailSet = env.SUPERADMIN_EMAIL !== undefined;
  const nameSet = env.SUPERADMIN_NAME !== undefined;
  if (!emailSet && !nameSet) return null;
  if (!emailSet || !nameSet) {
    throw new SeedError("SUPERADMIN_EMAIL and SUPERADMIN_NAME must both be set, or both omitted.");
  }
  const email = env.SUPERADMIN_EMAIL;
  const name = env.SUPERADMIN_NAME;
  if (typeof email !== "string" || typeof name !== "string") {
    throw new SeedError("SUPERADMIN_EMAIL and SUPERADMIN_NAME must be strings.");
  }
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = name.trim();
  if (normalizedEmail.length > 254 ||
      !/^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(normalizedEmail) ||
      /[\u0000-\u001f\u007f]/.test(email)) {
    throw new SeedError("SUPERADMIN_EMAIL must be a valid email address.");
  }
  if (!normalizedName || normalizedName.length > 200 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new SeedError("SUPERADMIN_NAME must be a nonempty name (at most 200 characters).");
  }
  return { email: normalizedEmail, name: normalizedName };
}

// client is a single dedicated pg connection (or a compatible injectable test client).
export async function seedSuperAdmin(client, env) {
  const config = seedConfig(env);
  if (!config) return { status: "skipped", reason: "SUPERADMIN_EMAIL and SUPERADMIN_NAME are both omitted." };

  await client.query("BEGIN");
  try {
    // Share the bootstrap CLI's lock, then serialize against ordinary INSERTs to users.
    await client.query("select pg_advisory_xact_lock(hashtext('bootstrap-admin'))");
    await client.query("LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE");
    const admins = await client.query("SELECT status FROM users WHERE role = 'superAdmin' LIMIT 1");
    if (admins.rows.length) {
      const inactive = admins.rows[0].status !== "active";
      await client.query("COMMIT");
      return {
        status: "skipped",
        reason: inactive
          ? "An existing super administrator is inactive; it was preserved and not reactivated."
          : "A super administrator already exists; existing account was preserved.",
      };
    }

    const collision = await client.query("SELECT role FROM users WHERE lower(email) = $1 LIMIT 1", [config.email]);
    if (collision.rows.length) {
      throw new SeedError("SUPERADMIN_EMAIL belongs to an existing non-super-admin account; refusing to promote it.");
    }
    await client.query(
      "INSERT INTO users (id, email, full_name, role, status, clerk_id, invitation_status) VALUES ($1, $2, $3, 'superAdmin', 'active', NULL, 'notRequired')",
      [randomUUID(), config.email, config.name],
    );
    await client.query("COMMIT");
    return { status: "created", reason: "Super administrator record created; sign up with the matching verified Clerk email to link it." };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original failure; the caller releases the connection.
    }
    throw error;
  }
}

export async function seedWithPool(pool, env) {
  // Validate before connecting (and never connect on a no-op).
  const config = seedConfig(env);
  if (!config) return { status: "skipped", reason: "SUPERADMIN_EMAIL and SUPERADMIN_NAME are both omitted." };
  const client = await pool.connect();
  try {
    return await seedSuperAdmin(client, env);
  } finally {
    client.release();
  }
}