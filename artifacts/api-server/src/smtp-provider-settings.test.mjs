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
const prefixed = Object.fromEntries(Object.entries(env).map(([key, value]) => [`DIGI_${key}`, value]));

test("environment boundary uses only original SMTP keys, retaining canonical masked form keys", () => {
  const resolved = api.smtpEnvironment({ ...env, ...prefixed, DIGI_SMTP_HOST: "ignored.invalid", DIGI_SMTP_PASSWORD: "ignored-secret",
    DIGI_SMTP_SECURE: "true", DIGI_SMTP_REQUIRE_TLS: "false", DIGI_SMTP_FROM_NAME: "Ignored", DIGI_SMTP_NOTIFICATIONS_ENABLED: "false" });
  assert.equal(api.smtpConfig(resolved).host, env.SMTP_HOST);
  assert.equal(api.smtpConfig(resolved).password, env.SMTP_PASSWORD);
  const status = api.integrationReadiness(resolved).smtp;
  assert.equal(status.ready, true);
  assert.equal(status.useTls, true); assert.equal(status.useSsl, false);
  assert.equal(status.fromName, "DigiQ Doctors"); assert.equal(status.notificationsEnabled, true);
  assert(status.keys.every(item => item.key.startsWith("SMTP_")));
  assert(!JSON.stringify(status).includes(env.SMTP_PASSWORD));
  assert.equal(api.smtpConfig(api.smtpEnvironment(env)).host, env.SMTP_HOST);
  assert.throws(() => api.smtpConfig(api.smtpEnvironment(prefixed)), { code: "EMAIL_UNCONFIGURED" });
});
test("partial and malformed original configuration never borrows DIGI values", () => {
  for (const field of Object.keys(env)) {
    const input = { ...env, ...prefixed };
    delete input[field];
    assert.equal(api.integrationReadiness(api.smtpEnvironment(input)).smtp.ready, false);
    assert.throws(() => api.smtpConfig(api.smtpEnvironment(input)), { code: "EMAIL_UNCONFIGURED" });
  }
  for (const patch of [{ SMTP_PORT: "NaN" }, { SMTP_PORT: "65536" }, { SMTP_HOST: "bad\nhost" },
    { SMTP_FROM: "bad\nfrom@example.invalid" }, { SMTP_SECURE: "yes" }, { SMTP_REQUIRE_TLS: "false" }]) {
    assert.throws(() => api.smtpConfig(api.smtpEnvironment({ ...env, ...prefixed, ...patch })), { code: "EMAIL_UNCONFIGURED" });
  }
});
test("original optional settings reach transport and security mail ignores optional opt-out", () => {
  const resolved = api.smtpEnvironment({ ...prefixed, ...env, SMTP_PORT: "465", SMTP_REQUIRE_TLS: "false",
    SMTP_FROM_NAME: "New name", SMTP_NOTIFICATIONS_ENABLED: "false" });
  assert.equal(api.integrationReadiness(resolved).smtp.notificationsEnabled, false);
  const cfg = api.smtpConfig(resolved);
  assert.equal(cfg.from, '"New name" <sender@example.invalid>');
  const transport = api.smtpTransportOptions(cfg);
  assert.equal(transport.secure, true); assert.equal(transport.requireTLS, false);
  assert.equal(transport.logger, false); assert.equal(transport.debug, false);
  assert.equal(transport.tls?.rejectUnauthorized, undefined);
  const malformedFlag = { ...resolved, SMTP_NOTIFICATIONS_ENABLED: "invalid" };
  assert.equal(api.integrationReadiness(malformedFlag).smtp.ready, false);
  assert.equal(api.emailNotificationsEnabled(malformedFlag), false);
  assert.equal(api.smtpConfig(malformedFlag).host, env.SMTP_HOST);
});
test("default entry points resolve original names, ignoring conflicting DIGI process values", () => {
  const names = [...api.smtpFields, ...api.smtpFields.map(key => `DIGI_${key}`)];
  const original = Object.fromEntries(names.map(name => [name, process.env[name]]));
  try {
    for (const name of names) delete process.env[name];
    Object.assign(process.env, env, prefixed, { DIGI_SMTP_SECURE: "true", DIGI_SMTP_NOTIFICATIONS_ENABLED: "false" });
    assert.equal(api.smtpConfig().secure, false);
    assert.equal(api.integrationReadiness().smtp.ready, true);
    assert.equal(api.emailNotificationsEnabled(), true);
    delete process.env.SMTP_PASSWORD;
    assert.throws(() => api.smtpConfig(), { code: "EMAIL_UNCONFIGURED" });
    assert.equal(api.integrationReadiness().smtp.ready, false);
  } finally {
    for (const [name, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

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
