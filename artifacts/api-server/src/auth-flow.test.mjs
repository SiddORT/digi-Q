// Focused auth regressions that inspect the compiled contract without starting
// an HTTP listener, contacting Clerk, sending email, or changing any account.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname);
const [route, auth, identity, schema, migration, logger] = await Promise.all([
  readFile(resolve(root, "routes/auth.ts"), "utf8"),
  readFile(resolve(root, "lib/auth.ts"), "utf8"),
  readFile(resolve(root, "routes/identity.ts"), "utf8"),
  readFile(resolve(root, "../../../lib/db/src/schema/core.ts"), "utf8"),
  readFile(resolve(root, "../../../lib/db/drizzle/0007_staff_session_proofs.sql"), "utf8"),
  readFile(resolve(root, "lib/logger.ts"), "utf8"),
]);

test("staff OTP and direct-session bypasses require server proof", () => {
  assert.match(route, /STAFF_LOGIN_REQUIRED/);
  assert.match(auth, /if \(isStaffRole\(user\.role\)\) await requireStaffSessionProof\(req\)/);
  assert.match(identity, /isStaffRole\(user\?\.role\).*requireStaffSessionProof/);
  assert.doesNotMatch(auth, /localStorage|authMethod|loginMethod/);
});

test("proof is bound to signed Clerk session and expiry, not a client flag", () => {
  assert.match(auth, /sessionId: staffSessionProofs\.sessionId/);
  assert.match(auth, /eq\(staffSessionProofs\.clerkUserId, clerkUserId\)/);
  assert.match(auth, /gt\(staffSessionProofs\.expiresAt, new Date\(\)\)/);
  assert.match(schema, /staff_session_proofs/);
  assert.match(migration, /"session_id" text PRIMARY KEY/);
  assert.match(auth, /clerkClient\.sessions\.getSession\(sessionId\)/);
  assert.match(auth, /session\.userId !== clerkUserId/);
  assert.match(auth, /session\.status !== "active"/);
  assert.doesNotMatch(route, /sessionClaims[\s\S]*?\.exp/);
});

test("entry and password limits resist account and session churn", () => {
  assert.match(route, /createHash\("sha256"\)\.update\(email\)/);
  assert.match(route, /emailEntryLimit\(10, true\)/);
  assert.match(route, /emailEntryLimit\(100, false\)/);
  assert.match(route, /return `\$\{auth\.clerkId\}:\$\{ipKeyGenerator/);
  assert.match(route, /skipSuccessfulRequests: true/);
  assert.doesNotMatch(route, /auth\.sessionId.*ipKeyGenerator/);
});

test("password is verified only by Clerk and never logged or persisted", () => {
  assert.match(route, /clerkClient\.users\.verifyPassword\(\{ userId: clerkId, password \}\)/);
  assert.match(route, /INVALID_STAFF_PASSWORD/);
  assert.doesNotMatch(schema, /password_hash|passwordHash/);
  assert.match(logger, /req\.body\.password/);
  assert.doesNotMatch(route, /req\.log\.\w+\(\{[^}]*\bpassword\b/);
});

test("inactive and patient roles cannot obtain staff access", () => {
  assert.match(route, /!user \|\| !isStaffRole\(user\.role\)/);
  assert.match(route, /user\.status !== "active"/);
  assert.match(route, /STAFF_ACCOUNT_REQUIRED/);
  assert.match(route, /STAFF_ACCOUNT_INACTIVE/);
});

test("patient entry rejects staff and inactive records before Clerk", () => {
  const lookup = route.indexOf("const local = await localUserByEmail(email)");
  const staffReject = route.indexOf("if (local && isStaffRole(local.role))");
  const inactiveReject = route.indexOf('local.status !== "active"');
  const provider = route.indexOf("let identity = await clerkUserForEmail(email)");
  assert.ok(lookup >= 0 && lookup < staffReject && staffReject < provider);
  assert.ok(inactiveReject > staffReject && inactiveReject < provider);
});

test("unknown patient provisioning is race-safe and reserved unverified", () => {
  assert.match(route, /emailAddressIdentificationStatus: \["reserved"\]/);
  assert.match(route, /skipPasswordRequirement: true/);
  assert.match(route, /catch \(error\)[\s\S]*identity = await clerkUserForEmail\(email\)/);
  assert.doesNotMatch(route, /verification.*verified|emailAddressIdentificationStatus: \["verified"\]/);
  assert.doesNotMatch(route, /db\.insert\(users\)|db\.insert\(patients\)/);
});

test("clinic registration keeps Clerk password authority and rejects existing profile elevation", async () => {
  const registration = await readFile(resolve(root, "routes/clinic-expansion.ts"), "utf8");
  assert.match(registration, /requireSessionIdentity\(req\)/);
  assert.match(registration, /verification\?\.status === "verified"/);
  assert.match(registration, /clerkClient\.users\.verifyPassword/);
  assert.match(registration, /authoritativeStaffSessionExpiry\(sessionId, clerkId\)/);
  assert.match(registration, /where clerk_id=\$\{clerkId\} or lower\(email\)=\$\{email\}/);
  assert.match(registration, /assert\(!existing\.length, 409/);
  assert.match(registration, /createOwnedClinic\(admin, admin, body, tx\)/);
  assert.doesNotMatch(registration, /data:\s*\{\s*\.\.\.body/);
  assert.doesNotMatch(registration, /req\.log\.\w+\([^)]*password/);
});