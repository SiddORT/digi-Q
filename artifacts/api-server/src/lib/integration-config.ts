import { HttpError } from "./http";

type KeyStatus = { key: string; status: "configured" | "missing" | "invalid" | "default" };
/** Canonical vault/form names are stable; only the server environment is prefixed. */
export const smtpFields = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM", "SMTP_SECURE", "SMTP_REQUIRE_TLS", "SMTP_FROM_NAME", "SMTP_NOTIFICATIONS_ENABLED"] as const;
export function smtpEnvironment(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return Object.fromEntries(smtpFields.map(name => [name, env[`DIGI_${name}`]]));
}
export const emailAddressPattern = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
export function validEmailAddress(value: string) {
  return value.length <= 254 && emailAddressPattern.test(value);
}
function key(env: NodeJS.ProcessEnv, name: string, valid: (value: string) => boolean = () => true, optional = false): KeyStatus {
  const value = env[name];
  return { key: name, status: !value?.trim() ? optional ? "default" : "missing" : valid(value) ? "configured" : "invalid" };
}
function smtpKeys(env: NodeJS.ProcessEnv) {
  const secure = env.SMTP_SECURE ? env.SMTP_SECURE === "true" : Number(env.SMTP_PORT) === 465;
  return [
    key(env, "SMTP_HOST", value => /^[a-z0-9.-]+$/i.test(value)),
    key(env, "SMTP_PORT", value => /^\d+$/.test(value) && Number(value) > 0 && Number(value) <= 65535),
    key(env, "SMTP_USER", value => !/[\r\n]/.test(value)),
    key(env, "SMTP_PASSWORD"),
    key(env, "SMTP_FROM", value => {
      const address = value.match(/^[^<>\r\n]+<([^<>]+)>$/)?.[1] ?? value;
      return validEmailAddress(address);
    }),
    key(env, "SMTP_SECURE", value => /^(true|false)$/.test(value), true),
    key(env, "SMTP_REQUIRE_TLS", value => value === "true" || (value === "false" && secure), true),
    key(env, "SMTP_FROM_NAME", value => value.length <= 150 && !/[\x00-\x1f\x7f<>]/.test(value), true),
    key(env, "SMTP_NOTIFICATIONS_ENABLED", value => /^(true|false)$/.test(value), true),
  ];
}
/** This optional notification flag must never gate account-security mail. */
export function emailNotificationsEnabled(env: NodeJS.ProcessEnv = smtpEnvironment()) {
  const value = env.SMTP_NOTIFICATIONS_ENABLED?.trim();
  return !value || value === "true";
}
function smtpSender(env: NodeJS.ProcessEnv) {
  const original = env.SMTP_FROM || "";
  const match = original.match(/^([^<>\r\n]+)<([^<>]+)>$/);
  const address = match?.[2] ?? original;
  let inherited = match?.[1].trim() ?? "";
  if (inherited.startsWith('"') && inherited.endsWith('"')) {
    try { inherited = JSON.parse(inherited); } catch { /* Retain the literal display name. */ }
  }
  const name = env.SMTP_FROM_NAME !== undefined ? env.SMTP_FROM_NAME.trim() : inherited;
  return { address, name, from: env.SMTP_FROM_NAME === undefined ? original : name ? `${JSON.stringify(name)} <${address}>` : address };
}
const ready = (keys: KeyStatus[]) => keys.every(item => item.status === "configured" || item.status === "default");
/** Authorized provider form metadata and syntax readiness, never credentials or delivery verification. */
export function integrationReadiness(env: NodeJS.ProcessEnv = { ...process.env, ...smtpEnvironment() }) {
  const smtp = smtpKeys(env);
  const sms = [
    key(env, "OTP_PROVIDER", value => value === "twilio" || (value === "development" && env.NODE_ENV === "development")),
    key(env, "TWILIO_ACCOUNT_SID", value => /^AC[a-f0-9]{32}$/i.test(value)),
    key(env, "TWILIO_MESSAGING_SERVICE_SID", value => /^MG[a-f0-9]{32}$/i.test(value)),
    key(env, "TWILIO_AUTH_TOKEN", value => /^[a-f0-9]{32}$/i.test(value)),
  ];
  const sender = smtpSender(env);
  const secure = env.SMTP_SECURE ? env.SMTP_SECURE === "true" : Number(env.SMTP_PORT) === 465;
  return {
    smtp: {
      ready: ready(smtp), keys: smtp, notificationsEnabled: emailNotificationsEnabled(env),
      smtpHost: smtp.find(k => k.key === "SMTP_HOST")?.status === "configured" ? env.SMTP_HOST! : "",
      smtpPort: smtp.find(k => k.key === "SMTP_PORT")?.status === "configured" ? Number(env.SMTP_PORT) : 587,
      fromEmail: smtp.find(k => k.key === "SMTP_FROM")?.status === "configured" ? sender.address : "",
      fromName: smtp.find(k => k.key === "SMTP_FROM")?.status === "configured" && smtp.find(k => k.key === "SMTP_FROM_NAME")?.status !== "invalid" ? sender.name : "",
      useSsl: secure, useTls: !secure && env.SMTP_REQUIRE_TLS !== "false",
    },
    sms: { ready: ready(sms), keys: sms },
  };
}
export function smtpConfig(env: NodeJS.ProcessEnv = smtpEnvironment()) {
  if (!ready(smtpKeys(env).filter(item => item.key !== "SMTP_NOTIFICATIONS_ENABLED"))) throw new HttpError(503, "Email delivery is not configured", "EMAIL_UNCONFIGURED");
  const port = Number(env.SMTP_PORT);
  return {
    host: env.SMTP_HOST!, port, user: env.SMTP_USER!, password: env.SMTP_PASSWORD!, from: smtpSender(env).from,
    secure: env.SMTP_SECURE ? env.SMTP_SECURE === "true" : port === 465,
    requireTLS: env.SMTP_REQUIRE_TLS !== "false",
  };
}
/** Shared secure options for delivery and read-only connection verification. */
export function smtpTransportOptions(cfg: ReturnType<typeof smtpConfig>) {
  return {
    host: cfg.host, port: cfg.port, secure: cfg.secure,
    requireTLS: !cfg.secure && cfg.requireTLS,
    auth: { user: cfg.user, pass: cfg.password },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
    logger: false as const, debug: false,
    disableFileAccess: true, disableUrlAccess: true,
  };
}