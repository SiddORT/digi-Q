import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import nodemailer from "nodemailer";
import { SendSmtpTestEmailBody, GetIntegrationSettingsResponse } from "@workspace/api-zod";
import { requireUser, roles } from "../lib/auth";
import { HttpError } from "../lib/http";
import { integrationReadiness, smtpConfig, validEmailAddress } from "../lib/integration-config";

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
const limitOptions = {
  windowMs: 15 * 60 * 1000, standardHeaders: "draft-8" as const, legacyHeaders: false,
  message: { error: "Test email limit reached. Try again later.", code: "SMTP_TEST_RATE_LIMIT" },
};
const ipLimit = rateLimit({ ...limitOptions, limit: 10 });
const userLimit = rateLimit({ ...limitOptions, limit: 3, keyGenerator: (_req, res) => res.locals.integrationActor });
integrationsRouter.get(path, (_req, res) => {
  res.json(GetIntegrationSettingsResponse.parse(integrationReadiness()));
});
integrationsRouter.post(`${path}/smtp/test-email`, ipLimit, userLimit, async (req, res) => {
  const parsed = SendSmtpTestEmailBody.strict().safeParse(req.body);
  if (!parsed.success || !validEmailAddress(parsed.data.recipient))
    throw new HttpError(400, "Enter one valid recipient email address", "INVALID_RECIPIENT");
  const cfg = smtpConfig();
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