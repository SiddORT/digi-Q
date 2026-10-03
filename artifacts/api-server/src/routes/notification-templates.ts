import { Router } from "express";
import { requireUser } from "../lib/auth";
import { assert } from "../lib/http";
import { consumeRateLimit } from "../lib/native-auth";
import { saveTemplate, templateCatalog } from "../lib/notification-template-store";
import { templateRecipients, type TemplateRecipient } from "../lib/notification-templates";
export const notificationTemplatesRouter = Router();
notificationTemplatesRouter.get("/management/templates", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const user = await requireUser(req);
  assert(req.query.clinicId === undefined || typeof req.query.clinicId === "string", 400, "Invalid clinic");
  assert(req.query.recipient === undefined || (templateRecipients as readonly unknown[]).includes(req.query.recipient), 400, "Invalid recipient group");
  res.json(await templateCatalog(user, req.query.clinicId as string | undefined, req.query.recipient as TemplateRecipient | undefined));
});
notificationTemplatesRouter.put("/management/templates", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const user = await requireUser(req);
  await consumeRateLimit(`template-edit:${user.id}`, 30, 900_000);
  res.json(await saveTemplate(user, req.body));
});