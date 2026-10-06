import app from "./app";
import { logger } from "./lib/logger";
import { startNotificationWorker } from "./lib/notification-outbox";
import { initializeMedia } from "./lib/local-media";
import { pincodeAssetStatus } from "./lib/pincode";

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
