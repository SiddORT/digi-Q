CREATE TABLE staff_deletion_receipts (
  id text PRIMARY KEY,
  account_fingerprint text NOT NULL UNIQUE,
  review_hash text NOT NULL,
  state text NOT NULL,
  encrypted_jobs text,
  file_count integer NOT NULL,
  verified_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT staff_receipt_fingerprints CHECK (
    account_fingerprint ~ '^[a-f0-9]{64}$' AND review_hash ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT staff_receipt_progress CHECK (
    file_count >= 0 AND verified_count >= 0 AND verified_count <= file_count
  ),
  CONSTRAINT staff_receipt_state CHECK (
    (state = 'complete' AND verified_count = file_count AND completed_at IS NOT NULL AND encrypted_jobs IS NULL)
    OR (state = 'cleanup_pending' AND verified_count < file_count AND completed_at IS NULL AND encrypted_jobs IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION clinicflow_receipt_requires_removed_account() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('removed-staff-identity:' || NEW.account_fingerprint));
  IF EXISTS (SELECT 1 FROM users WHERE encode(sha256(convert_to(id,'UTF8')),'hex') = NEW.account_fingerprint) THEN
    RAISE EXCEPTION 'A removal receipt cannot be committed for an existing account' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER staff_receipt_removed_account
  AFTER INSERT ON staff_deletion_receipts DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION clinicflow_receipt_requires_removed_account();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION clinicflow_immutable_removal_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Removal receipts are permanent' USING ERRCODE = '23514';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.account_fingerprint IS DISTINCT FROM OLD.account_fingerprint
    OR NEW.review_hash IS DISTINCT FROM OLD.review_hash OR NEW.file_count IS DISTINCT FROM OLD.file_count
    OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.verified_count < OLD.verified_count
    OR (OLD.state = 'complete' AND NEW IS DISTINCT FROM OLD) THEN
    RAISE EXCEPTION 'Removal receipt identity and verified progress are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER staff_receipt_immutable BEFORE UPDATE OR DELETE ON staff_deletion_receipts
  FOR EACH ROW EXECUTE FUNCTION clinicflow_immutable_removal_receipt();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION clinicflow_no_removed_account_recreation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE fingerprint text;
BEGIN
  fingerprint := encode(sha256(convert_to(NEW.id,'UTF8')),'hex');
  PERFORM pg_advisory_xact_lock(hashtext('removed-staff-identity:' || fingerprint));
  IF EXISTS (SELECT 1 FROM staff_deletion_receipts WHERE account_fingerprint=fingerprint) THEN
    RAISE EXCEPTION 'A removed staff identity cannot be recreated' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER users_removed_identity_guard BEFORE INSERT OR UPDATE OF id ON users
FOR EACH ROW EXECUTE FUNCTION clinicflow_no_removed_account_recreation();
