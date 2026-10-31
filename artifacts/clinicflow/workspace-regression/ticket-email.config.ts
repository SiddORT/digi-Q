import base from "./friendly-messages.config";
import { resolve } from "node:path";
export default {
  ...base,
  testMatch: ["ticket-email.spec.ts", "friendly-messages.spec.ts"],
  grep: /ticket|Ticket/,
  outputDir: resolve("generated-artifacts/ticket-email/results"),
};
