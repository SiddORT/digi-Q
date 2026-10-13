import { Router } from "express";
import { requireUser } from "../lib/auth";
import { listNotificationLogs, getNotificationLog } from "../lib/notification-history";
import { ListNotificationLogsResponse, GetNotificationLogResponse } from "@workspace/api-zod";
export const notificationHistoryRouter = Router();
notificationHistoryRouter.get("/management/notification-logs", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(ListNotificationLogsResponse.parse(await listNotificationLogs(await requireUser(req), req.query)));
});
notificationHistoryRouter.get("/management/notification-logs/:id", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(GetNotificationLogResponse.parse(await getNotificationLog(await requireUser(req), String(req.params.id))));
});
