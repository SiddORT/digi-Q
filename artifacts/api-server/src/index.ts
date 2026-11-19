import app from "./app";
import { logger } from "./lib/logger";
import { startNotificationWorker } from "./lib/notification-outbox";
import { initializeMedia } from "./lib/local-media";
import { pincodeAssetStatus } from "./lib/pincode";
import { db, provisionHealthcareVocabulary } from "@workspace/db";
import { registrationSmsDiagnostics } from "./lib/registration-sms-diagnostics";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

await initializeMedia();
await db.transaction(tx => provisionHealthcareVocabulary(tx));
// Preview-only diagnosis, never installation or delivery. Production startup stays unchanged.
if (process.env.NODE_ENV === "development") {
  try {
    logger.info(await registrationSmsDiagnostics(db, "workspace", process.env.DATABASE_URL!),
      "Preview registration SMS readiness (no messages sent)");
  } catch {
    logger.warn("Preview registration SMS readiness check failed; no configuration was changed");
  }
}
const pinAsset = pincodeAssetStatus();
if (pinAsset.available) logger.info(pinAsset, "PIN directory loaded");
else logger.warn("PIN directory missing: PIN assistance disabled, manual address entry continues");
app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startNotificationWorker();
});
