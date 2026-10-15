import { Router } from "express";
import * as z from "@workspace/api-zod";
import { requireUser } from "../lib/auth";
import { parse, query } from "../lib/http";
import { consumeRateLimit } from "../lib/native-auth";
import { personalNotificationSettings, savePersonalNotificationSettings } from "../lib/personal-notification-settings";
import { managedNotificationSettings, saveManagedNotificationSettings } from "../lib/managed-notification-settings";

export const notificationSettingsRouter = Router();
notificationSettingsRouter.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
notificationSettingsRouter.get("/me/notification-settings", async (req, res) => {
  res.json(z.GetMyNotificationSettingsResponse.parse(await personalNotificationSettings(await requireUser(req))));
});
notificationSettingsRouter.put("/me/notification-settings", async (req, res) => {
  const user = await requireUser(req);
  await consumeRateLimit(`notification-preferences:${user.id}`, 60, 900000);
  res.json(z.SaveMyNotificationSettingsResponse.parse(await savePersonalNotificationSettings(user, parse(z.SaveMyNotificationSettingsBody.strict(), req.body))));
});
notificationSettingsRouter.get("/management/notification-settings", async (req, res) => {
  const user = await requireUser(req), params = query(z.GetManagedNotificationSettingsQueryParams, req);
  res.json(z.GetManagedNotificationSettingsResponse.parse(await managedNotificationSettings(user, params.clinicId)));
});
notificationSettingsRouter.put("/management/notification-settings", async (req, res) => {
  const user = await requireUser(req);
  await consumeRateLimit(`notification-policy:${user.id}`, 30, 900000);
  res.json(z.SaveManagedNotificationSettingsResponse.parse(await saveManagedNotificationSettings(user, parse(z.SaveManagedNotificationSettingsBody.strict(), req.body))));
});
