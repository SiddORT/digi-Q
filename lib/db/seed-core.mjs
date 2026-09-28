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
  const password = env.SUPERADMIN_PASSWORD;
  if (password !== undefined &&
      (typeof password !== "string" || password.length < 12 || Buffer.byteLength(password, "utf8") > 1024)) {
    throw new SeedError("SUPERADMIN_PASSWORD must be at least 12 characters and at most 1024 UTF-8 bytes.");
  }
  if (normalizedEmail.length > 254 ||
      !/^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(normalizedEmail) ||
      /[\u0000-\u001f\u007f]/.test(email)) {
    throw new SeedError("SUPERADMIN_EMAIL must be a valid email address.");
  }
  if (!normalizedName || normalizedName.length > 200 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new SeedError("SUPERADMIN_NAME must be a nonempty name (at most 200 characters).");
  }
  return { email: normalizedEmail, name: normalizedName, password };
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
    const admins = await client.query("SELECT id, email, status, password_hash FROM users WHERE role = 'superAdmin' LIMIT 1");
    if (admins.rows.length) {
      const inactive = admins.rows[0].status !== "active";
      // Only initialize a previously passwordless active administrator at the
      // explicitly configured email. Never rotate an existing credential.
      if (!inactive && !admins.rows[0].password_hash && config.password &&
          admins.rows[0].email.toLowerCase() === config.email) {
        const { default: argon2 } = await import("argon2");
        const hash = await argon2.hash(config.password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
        await client.query(
          "UPDATE users SET password_hash = $1, password_changed_at = now(), email_verified_at = now() WHERE id = $2 AND password_hash IS NULL AND status = 'active'",
          [hash, admins.rows[0].id],
        );
        await client.query("COMMIT");
        return { status: "initialized", reason: "Existing administrator's missing password was initialized once; existing identity preserved." };
      }
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
    if (!config.password) throw new SeedError("SUPERADMIN_PASSWORD is required to create an administrator who can sign in.");
    const { default: argon2 } = await import("argon2");
    const hash = await argon2.hash(config.password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
    await client.query(
      "INSERT INTO users (id, email, full_name, role, status, password_hash, password_changed_at, email_verified_at, invitation_status) VALUES ($1, $2, $3, 'superAdmin', 'active', $4, now(), now(), 'notRequired')",
      [randomUUID(), config.email, config.name, hash],
    );
    await client.query("COMMIT");
    return { status: "created", reason: "Super administrator created with locally hashed password." };
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