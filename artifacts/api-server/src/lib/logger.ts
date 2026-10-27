import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "req.body.password",
    "req.body.confirmPassword",
    "req.body.admin.password",
    "req.body.admin.confirmPassword",
    "req.body.currentPassword",
    "req.body.receiptSecret",
    "req.body.capability",
    "res.body.url",
    "capability",
    "liveTicketUrl",
    "req.body.values",
    "currentPassword",
    "encrypted",
    "password",
    "res.headers['set-cookie']",
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
