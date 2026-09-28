import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { errors, HttpError } from "./lib/http";
import { checkCsrf, nativeSession } from "./lib/native-auth";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Trust only the explicitly configured number of proxy hops; never trust
// arbitrary X-Forwarded-For chains from direct clients.
const proxyHops = Number(process.env.TRUST_PROXY_HOPS ?? "0");
if (!Number.isSafeInteger(proxyHops) || proxyHops < 0 || proxyHops > 3)
  throw new Error("TRUST_PROXY_HOPS must be an integer from 0 to 3");
app.set("trust proxy", proxyHops);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ credentials: true, origin: false }));
app.use(express.json({ limit: "128kb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/api", nativeSession);

app.use("/api", rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many requests", code: "RATE_LIMITED" } }));
app.use("/api", (req, _res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    const fetchSite = req.get("sec-fetch-site");
    const host = req.get("x-forwarded-host")?.split(",")[0].trim() || req.get("host");
    let originHost;
    try { originHost = origin ? new URL(origin).host : undefined; } catch { return next(new HttpError(403, "Invalid request origin")); }
    if (fetchSite === "cross-site" || origin && originHost !== host) return next(new HttpError(403, "Cross-origin mutations are not allowed"));
    if (!origin && req.get("sec-fetch-site") !== "same-origin") return next(new HttpError(403, "A same-origin request is required"));
  }
  next();
});
app.use("/api", checkCsrf);
app.use("/api", router);
app.use("/api", (_req, res) => { res.status(404).json({ error: "API route not found" }); });
app.use(errors);

export default app;
