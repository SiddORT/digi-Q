import { HttpError } from "./http";

type KeyStatus = { key: string; status: "configured" | "missing" | "invalid" | "default" };
export const emailAddressPattern = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
export function validEmailAddress(value: string) {
  return value.length <= 254 && emailAddressPattern.test(value);
}
function key(env: NodeJS.ProcessEnv, name: string, valid: (value: string) => boolean = () => true, optional = false): KeyStatus {
  const value = env[name];
  return { key: name, status: !value?.trim() ? optional ? "default" : "missing" : valid(value) ? "configured" : "invalid" };
}
function smtpKeys(env: NodeJS.ProcessEnv) {
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
    key(env, "SMTP_REQUIRE_TLS", value => value === "true", true),
  ];
}
const ready = (keys: KeyStatus[]) => keys.every(item => item.status === "configured" || item.status === "default");
/** A projection of syntax/presence only, never provider verification or secret values. */
export function integrationReadiness(env: NodeJS.ProcessEnv = process.env) {
  const smtp = smtpKeys(env);
  const sms = [
    key(env, "OTP_PROVIDER", value => value === "twilio" || (value === "development" && env.NODE_ENV === "development")),
    key(env, "TWILIO_ACCOUNT_SID", value => /^AC[a-f0-9]{32}$/i.test(value)),
    key(env, "TWILIO_MESSAGING_SERVICE_SID", value => /^MG[a-f0-9]{32}$/i.test(value)),
  ];
  return { smtp: { ready: ready(smtp), keys: smtp }, sms: { ready: ready(sms), keys: sms } };
}
export function smtpConfig(env: NodeJS.ProcessEnv = process.env) {
  if (!ready(smtpKeys(env))) throw new HttpError(503, "Email delivery is not configured", "EMAIL_UNCONFIGURED");
  const port = Number(env.SMTP_PORT);
  return {
    host: env.SMTP_HOST!, port, user: env.SMTP_USER!, password: env.SMTP_PASSWORD!, from: env.SMTP_FROM!,
    secure: env.SMTP_SECURE ? env.SMTP_SECURE === "true" : port === 465,
    requireTLS: true,
  };
}