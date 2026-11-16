-- Extend the provider allowlist only. Preserve every locator, lifecycle,
-- immutable identity fence and erased-staff/asset trigger.
ALTER TABLE patient_documents DROP CONSTRAINT private_file_registry;
ALTER TABLE patient_documents ADD CONSTRAINT private_file_registry CHECK (
  registry_version=0 OR (registry_version=1 AND provider IN ('local','object','s3')
    AND size>0 AND size<=10485760 AND digest IS NOT NULL AND digest ~ '^[a-f0-9]{64}$'
    AND content_type IN ('application/pdf','image/png','image/jpeg','image/webp','text/plain')
    AND status IN ('staging','quarantined','active','deleted','failed')
    AND scan_state IN ('pending','approved') AND (status<>'active' OR scan_state='approved')));
