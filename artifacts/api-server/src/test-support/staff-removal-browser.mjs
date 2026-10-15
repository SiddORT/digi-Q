// Explicit development-only opt-in. Never connects to DATABASE_URL, real
// delivery providers, App Storage, or the normal application database.
import { createServer, request } from "node:http";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes, createHash } from "node:crypto";
import argon2 from "argon2";
import { createFeatureHarness } from "./feature-harness.mjs";
import { seedFeatureFixtures } from "./feature-fixtures.mjs";

if (process.env.NODE_ENV !== "development") throw new Error("Disposable browser fixture is development-only");
const root = await mkdtemp(join(tmpdir(), "staff-removal-browser-"));
process.env.SESSION_SECRET = "isolated-native-browser-fixture-signing-secret-not-for-use-elsewhere";
process.env.INTEGRATIONS_ENCRYPTION_KEY = "be".repeat(32);
process.env.AUTH_SESSION_MODE = "native";
process.env.MEDIA_STORAGE = "local";
process.env.MEDIA_ROOT = root;
const realFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === "string" ? input : input.url ?? input.toString());
  if (!["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("External network disabled in disposable browser fixture");
  return realFetch(input, options);
};
const h = await createFeatureHarness({ postgres: true, deletion: true, administration: true,
  bookingLookups: true, simulatedMail: true, fakeBookingMail: true, notificationSettings: true });
await seedFeatureFixtures(h.pg);
const password = "Fixture-Only!DigiQ-2026";
await h.pg.query("update users set password_hash=$1,email_verified_at=now()", [await argon2.hash(password)]);
// An authenticated patient session permits authorization checks without
// changing or bypassing the application's unchanged OTP login implementation.
const patientSessionToken = randomBytes(32).toString("base64url");
await h.pg.query("insert into auth_sessions(token_hash,user_id,expires_at) values($1,'patu',now()+interval '1 hour')",
  [createHash("sha256").update(patientSessionToken).digest("hex")]);
const source = new URL(h.base);
const proxy = createServer((req, res) => {
  const upstream = request({ hostname: source.hostname, port: source.port, path: req.url,
    method: req.method, headers: req.headers }, response => {
    res.writeHead(response.statusCode, response.headers); response.pipe(res);
  });
  upstream.on("error", () => { res.statusCode = 502; res.end("Disposable fixture unavailable"); });
  req.pipe(upstream);
});
const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port < 1) throw new Error("A routed development PORT is required");
proxy.listen(port, "0.0.0.0", () => console.log("Disposable staff-removal browser API ready; no normal database or live delivery"));
await mkdir("../../.local", { recursive: true });
await writeFile("../../.local/staff-removal-browser-info.json", JSON.stringify({
  password, patientSessionToken, accounts: ["sa", "adm", "docu", "rec", "rec2", "patu"].map(id => ({ email: id + "@test.invalid", id })),
}));
let closing = false;
async function close() {
  if (closing) return; closing = true;
  proxy.close(); await h.close(); await rm(root, { recursive: true, force: true });
  await rm("../../.local/staff-removal-browser-info.json", { force: true });
  process.exit(0);
}
process.on("SIGTERM", close); process.on("SIGINT", close);
