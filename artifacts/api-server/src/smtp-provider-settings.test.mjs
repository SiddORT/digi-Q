import { test, after } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const bundle = resolve(import.meta.dirname, `.smtp-provider-${process.pid}.mjs`);
await build({ entryPoints: [resolve(import.meta.dirname, "lib/integration-config.ts")], outfile: bundle, bundle: true, platform: "node", format: "esm", packages: "external" });
const api = await import(bundle);
after(() => rm(bundle, { force: true }));
const env = { SMTP_HOST: "smtp.example.invalid", SMTP_PORT: "587", SMTP_USER: "private-fixture-user", SMTP_PASSWORD: "private-fixture-password", SMTP_FROM: "DigiQ Doctors <sender@example.invalid>" };

test("public SMTP form fields load without returning username or password", () => {
  const r = api.integrationReadiness(env).smtp;
  assert.equal(r.smtpHost, env.SMTP_HOST); assert.equal(r.smtpPort, 587);
  assert.equal(r.fromEmail, "sender@example.invalid"); assert.equal(r.fromName, "DigiQ Doctors");
  assert.equal(r.useTls, true); assert.equal(r.useSsl, false); assert.equal(r.notificationsEnabled, true);
  for (const value of [env.SMTP_USER, env.SMTP_PASSWORD]) assert.equal(JSON.stringify(r).includes(value), false);
  assert.equal(api.smtpConfig(env).from, env.SMTP_FROM);
});
test("new From Name reaches the transport, safely quotes punctuation, and can be cleared", () => {
  const cfg = api.smtpConfig({ ...env, SMTP_FROM_NAME: 'DigiQ, "Doctors"' });
  assert.equal(cfg.from, '"DigiQ, \\"Doctors\\"" <sender@example.invalid>');
  assert.equal(api.smtpConfig({ ...env, SMTP_FROM_NAME: "" }).from, "sender@example.invalid");
  for (const name of ["Bad\r\nBcc: attacker@example.invalid", "<bad>", "a".repeat(151)])
    assert.throws(() => api.smtpConfig({ ...env, SMTP_FROM_NAME: name }), { code: "EMAIL_UNCONFIGURED" });
});
test("STARTTLS and implicit SSL work; neither selected never enables plaintext SMTP", () => {
  assert.equal(api.smtpConfig({ ...env, SMTP_SECURE: "false", SMTP_REQUIRE_TLS: "true" }).requireTLS, true);
  const ssl = api.smtpConfig({ ...env, SMTP_PORT: "465", SMTP_SECURE: "true", SMTP_REQUIRE_TLS: "false" });
  assert.equal(ssl.secure, true); assert.equal(ssl.requireTLS, false);
  assert.throws(() => api.smtpConfig({ ...env, SMTP_SECURE: "false", SMTP_REQUIRE_TLS: "false" }), { code: "EMAIL_UNCONFIGURED" });
  assert.equal(api.integrationReadiness({ ...env, SMTP_SECURE: "true", SMTP_REQUIRE_TLS: "false" }).smtp.useTls, false);
});
test("optional email switch never disables the account-security SMTP transport", () => {
  for (const flag of ["false", "invalid"]) {
    assert.equal(api.emailNotificationsEnabled({ ...env, SMTP_NOTIFICATIONS_ENABLED: flag }), false);
    assert.equal(api.smtpConfig({ ...env, SMTP_NOTIFICATIONS_ENABLED: flag }).from, env.SMTP_FROM);
  }
  assert.equal(api.emailNotificationsEnabled(env), true);
});
