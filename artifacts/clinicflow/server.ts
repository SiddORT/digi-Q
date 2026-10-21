import { createPublicApp } from "@workspace/public-pages/server";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.PORT);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error("A valid PORT is required.");
createPublicApp(path.join(path.dirname(fileURLToPath(import.meta.url)), "public"))
  .listen(port, "0.0.0.0");
