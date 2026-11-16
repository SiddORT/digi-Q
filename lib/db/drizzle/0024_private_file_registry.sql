-- Additive registry on existing document metadata. No locator rewrite or byte movement.
ALTER TABLE patient_documents ALTER COLUMN patient_id DROP NOT NULL;
ALTER TABLE patient_documents
  ADD COLUMN doctor_id text REFERENCES doctors(id),
  ADD COLUMN purpose text NOT NULL DEFAULT 'documents',
  ADD COLUMN digest text,
  ADD COLUMN registry_version integer NOT NULL DEFAULT 0,
  ADD COLUMN scan_state text NOT NULL DEFAULT 'legacy',
  ADD COLUMN scan_reviewed_at timestamptz,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN deleted_from text;
CREATE INDEX private_file_doctor_idx ON patient_documents(doctor_id,clinic_id);
CREATE UNIQUE INDEX private_file_locator_unique ON patient_documents(provider,storage_key) WHERE registry_version=1;
ALTER TABLE patient_documents ADD CONSTRAINT private_file_entity CHECK (
  (patient_id IS NOT NULL AND doctor_id IS NULL AND purpose IN ('profile','documents','medical'))
  OR (patient_id IS NULL AND doctor_id IS NOT NULL AND purpose IN ('profile','credentials')));
ALTER TABLE patient_documents ADD CONSTRAINT private_file_registry CHECK (
  registry_version=0 OR (registry_version=1 AND provider IN ('local','object')
    AND size>0 AND size<=10485760 AND digest IS NOT NULL AND digest ~ '^[a-f0-9]{64}$'
    AND content_type IN ('application/pdf','image/png','image/jpeg','image/webp','text/plain')
    AND status IN ('staging','quarantined','active','deleted','failed')
    AND scan_state IN ('pending','approved') AND (status<>'active' OR scan_state='approved')));
ALTER TABLE patient_documents ADD CONSTRAINT private_file_review CHECK (
  registry_version=0 OR (scan_state='pending' AND scan_reviewed_at IS NULL)
  OR (scan_state='approved' AND scan_reviewed_at IS NOT NULL));
--> statement-breakpoint
CREATE FUNCTION clinicflow_private_file_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.registry_version=1 AND (
    NEW.registry_version<>1 OR NEW.id IS DISTINCT FROM OLD.id
    OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id
    OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
    OR NEW.doctor_id IS DISTINCT FROM OLD.doctor_id
    OR NEW.purpose IS DISTINCT FROM OLD.purpose
    OR NEW.provider IS DISTINCT FROM OLD.provider
    OR NEW.storage_key IS DISTINCT FROM OLD.storage_key
    OR NEW.size IS DISTINCT FROM OLD.size
    OR NEW.content_type IS DISTINCT FROM OLD.content_type
    OR NEW.digest IS DISTINCT FROM OLD.digest
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Private file identity and byte evidence are immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER private_file_identity_guard BEFORE UPDATE ON patient_documents
FOR EACH ROW EXECUTE FUNCTION clinicflow_private_file_immutable();
-- Existing erasure triggers remain attached to this table, including new columns.
