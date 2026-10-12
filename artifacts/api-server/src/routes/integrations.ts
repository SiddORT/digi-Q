import { Router } from "express";
import { ipKeyGenerator } from "express-rate-limit";
import { SendSmtpTestEmailBody, GetIntegrationSettingsResponse, UpdateIntegrationSettingsBody } from "@workspace/api-zod";
import { db, users } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireUser, roles } from "../lib/auth";
import { HttpError } from "../lib/http";
import { smtpConfig, validEmailAddress } from "../lib/integration-config";
import { consumeRateLimit, verifyPassword } from "../lib/native-auth";
import { integrationSettings, resolvedIntegration, saveIntegration, integrationFields } from "../lib/integration-vault";
import { checkIntegration } from "../lib/integration-checks";
import { mediaConfig } from "../lib/local-media";
import { sendAuthEmail } from "../lib/auth-email";
import { DEMO_FIXTURE } from "../lib/demo-policy";

export const integrationsRouter = Router();
const path = "/settings/integrations";
// Scoped to these endpoints only; never changes authentication middleware globally.
integrationsRouter.use(path, async (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  const user = await requireUser(req);
  roles(user, ["superAdmin"]);
  if (user.demo || user.demoFixture === DEMO_FIXTURE) throw new HttpError(403, "Demo accounts cannot access integration credentials");
  res.locals.integrationActor = user.id;
  next();
});
integrationsRouter.get(path, async (_req, res) => {
  res.json(GetIntegrationSettingsResponse.parse(await integrationSettings()));
});
integrationsRouter.get(`${path}/storage`, async (_req, res) => {
  const config = mediaConfig();
  res.json({ provider: config.driver, source: "environment", publicPath: config.url, configured: config.driver === "object" ? !!process.env.PRIVATE_OBJECT_DIR : !!config.root });
});
integrationsRouter.post(`${path}/:provider/check`, async (req, res) => {
  const provider = String(req.params.provider);
  if (!["smtp", "sms", "storage"].includes(provider)) throw new HttpError(400, "Unsupported provider");
  await consumeRateLimit(`integration-check:${res.locals.integrationActor}`, 10, 900000);
  res.json(await checkIntegration(provider as "smtp" | "sms" | "storage"));
});
integrationsRouter.put(path, async (req, res) => {
  await consumeRateLimit(`integration-edit:ip:${ipKeyGenerator(req.ip || "unknown")}`, 20, 900_000);
  await consumeRateLimit(`integration-edit:actor:${res.locals.integrationActor}`, 5, 900_000);
  const parsed = UpdateIntegrationSettingsBody.strict().safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "Invalid configuration request", "INTEGRATION_INVALID");
  const body = parsed.data;
  const allowed: readonly string[] = integrationFields[body.provider];
  if (Object.keys(body.values).some(key => !allowed.includes(key)) ||
      Object.entries(body.values).some(([key,value])=>value.length>(key==="NOTIFICATION_SMS_MAPPING"?8192:2048)) ||
      (body.mode === "environment" && Object.keys(body.values).length))
    throw new HttpError(400, "Unsupported configuration fields", "INTEGRATION_INVALID");
  const [actor] = await db.select().from(users).where(eq(users.id, res.locals.integrationActor));
  if (!await verifyPassword(actor?.passwordHash, body.currentPassword))
    throw new HttpError(403, "Password confirmation failed", "PASSWORD_CONFIRMATION_FAILED");
  await saveIntegration(body.provider, body.values, body.revision, body.mode, res.locals.integrationActor);
  res.json(GetIntegrationSettingsResponse.parse(await integrationSettings()));
});
integrationsRouter.post(`${path}/smtp/test-email`, async (req, res) => {
  try {
    await consumeRateLimit(`smtp-test:ip:${ipKeyGenerator(req.ip || "unknown")}`, 10, 900_000);
    await consumeRateLimit(`smtp-test:actor:${res.locals.integrationActor}`, 3, 900_000);
  } catch (error) {
    if (error instanceof HttpError && error.code === "RATE_LIMITED")
      throw new HttpError(429, "Test email limit reached. Try again later.", "SMTP_TEST_RATE_LIMIT");
    throw error;
  }
  const parsed = SendSmtpTestEmailBody.strict().safeParse(req.body);
  if (!parsed.success || !validEmailAddress(parsed.data.recipient))
    throw new HttpError(400, "Enter one valid recipient email address", "INVALID_RECIPIENT");
  smtpConfig((await resolvedIntegration("smtp")).env);
  try {
    await sendAuthEmail(parsed.data.recipient,"DigiQ Doctors — SMTP configuration test",
      "This is a test email requested by a DigiQ Doctors Super Admin to check SMTP configuration. No patient or account information is included.");
  } catch {
    throw new HttpError(503, "Email delivery unavailable", "EMAIL_DELIVERY_FAILED");
  }
  res.json({ status: "provider_accepted", message: "The SMTP provider accepted the test message. Inbox delivery is not confirmed." });
});