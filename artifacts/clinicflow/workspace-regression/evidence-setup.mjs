import { captureFingerprint } from "../../../scripts/ui-evidence-freshness.mjs";

// Metadata survives JSON reporter selection via --reporter=json. Capture before
// workers start, not when a later ledger command happens to consume the report.
export default function evidenceSetup(config) {
  config.metadata.uiEvidence = { start: captureFingerprint() };
  return () => {
    config.metadata.uiEvidence.end = captureFingerprint();
  };
}
