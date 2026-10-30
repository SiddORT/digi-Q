import { runPostgresVersionMatrix } from "./postgres-version-matrix.mjs";

process.exitCode = runPostgresVersionMatrix({
  label: "Appointment detail compatibility",
  testFiles: ["artifacts/api-server/src/appointment-detail-loading.integration.test.mjs"],
});
