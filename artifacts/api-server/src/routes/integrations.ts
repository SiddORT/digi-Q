import { Router } from "express";
import { ipKeyGenerator } from "express-rate-limit";
import nodemailer from "nodemailer";
import { SendSmtpTestEmailBody, GetIntegrationSettingsResponse, UpdateIntegrationSettingsBody } from "@workspace/api-zod";
import { db, users } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireUser, roles } from "../lib/auth";
import { HttpError } from "../lib/http";
import { smtpConfig, validEmailAddress } from "../lib/integration-config";
import { consumeRateLimit, verifyPassword } from "../lib/native-auth";
import { integrationSettings, resolvedIntegration, saveIntegration, integrationFields } from "../lib/integration-vault";

export const integrationsRouter = Router();
const path = "/settings/integrations";
// Scoped to these endpoints only; never changes authentication middleware globally.
integrationsRouter.use(path, async (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  const user = await requireUser(req);
  roles(user, ["superAdmin"]);
  res.locals.integrationActor = user.id;
  next();
});
integrationsRouter.get(path, async (_req, res) => {
  res.json(GetIntegrationSettingsResponse.parse(await integrationSettings()));
});
integrationsRouter.put(path, async (req, res) => {
  await consumeRateLimit(`integration-edit:ip:${ipKeyGenerator(req.ip || "unknown")}`, 20, 900_000);
  await consumeRateLimit(`integration-edit:actor:${res.locals.integrationActor}`, 5, 900_000);
  const parsed = UpdateIntegrationSettingsBody.strict().safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "Invalid configuration request", "INTEGRATION_INVALID");
  const body = parsed.data;
  const allowed: readonly string[] = integrationFields[body.provider];
  if (Object.keys(body.values).some(key => !allowed.includes(key)) ||
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
  const cfg = smtpConfig((await resolvedIntegration("smtp")).env);
  try {
    const transport = nodemailer.createTransport({
      host: cfg.host, port: cfg.port, secure: cfg.secure, requireTLS: !cfg.secure && cfg.requireTLS,
      auth: { user: cfg.user, pass: cfg.password },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
    });
    const result = await transport.sendMail({
      from: cfg.from, to: parsed.data.recipient,
      subject: "DigiQ Doctors — SMTP configuration test",
      text: "This is a test email requested by a DigiQ Doctors Super Admin to check SMTP configuration. No patient or account information is included.",
      disableFileAccess: true, disableUrlAccess: true,
    });
    if (!result.accepted?.length || result.rejected?.length)
      throw new Error("Not accepted");
  } catch {
    throw new HttpError(503, "Email delivery unavailable", "EMAIL_DELIVERY_FAILED");
  }
  res.json({ status: "provider_accepted", message: "The SMTP provider accepted the test message. Inbox delivery is not confirmed." });
});