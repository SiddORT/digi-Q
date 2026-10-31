import base from "./friendly-messages.config";
import { resolve } from "node:path";
export default {
  ...base,
  testMatch: ["ticket-actions.spec.ts", "ticket-email.spec.ts"],
  outputDir: resolve("generated-artifacts/ticket-actions/results"),
};
