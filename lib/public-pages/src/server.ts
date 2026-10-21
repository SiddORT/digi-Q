import express, { type Express } from "express";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { publicHtmlMiddleware } from "./index";

/** Production HTML is dynamic; only actual files may use the static host. */
export function createPublicApp(frontend: string): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(publicHtmlMiddleware(() => readFile(path.join(frontend, "index.html"), "utf8")));
  app.use(express.static(frontend, { index: false, dotfiles: "deny" }));
  app.use((_req, res) => { res.status(404).set("X-Robots-Tag", "noindex, nofollow").end(); });
  app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(503).set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Retry-After": "60" })
      .type("text").send("Website temporarily unavailable.");
  });
  return app;
}
