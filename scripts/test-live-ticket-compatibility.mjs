import { runPostgresVersionMatrix } from "./postgres-version-matrix.mjs";

process.exitCode = runPostgresVersionMatrix({
  label: "Public live-ticket/receipt compatibility",
  testFiles: ["artifacts/api-server/src/live-ticket.integration.test.mjs"],
});
