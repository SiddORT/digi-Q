-- The only permissible doctor without a login is a retired historical identity.
-- Existing active ownership and exactly-one-clinic-admin constraints stay intact.
ALTER TABLE doctors ALTER COLUMN user_id DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE doctors ALTER COLUMN owner_admin_id DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE doctors ADD COLUMN retired_at timestamp with time zone;
--> statement-breakpoint
ALTER TABLE doctors ADD CONSTRAINT doctor_retired_identity CHECK (
  (status = 'retired' AND user_id IS NULL AND owner_admin_id IS NULL AND retired_at IS NOT NULL)
  OR (status <> 'retired' AND user_id IS NOT NULL AND owner_admin_id IS NOT NULL AND retired_at IS NULL)
);
--> statement-breakpoint
ALTER TABLE appointments ALTER COLUMN actor_id DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE appointments ADD COLUMN deleted_actor boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE appointments ADD CONSTRAINT appointment_anonymous_actor CHECK (
  (actor_id IS NOT NULL AND NOT deleted_actor) OR (actor_id IS NULL AND deleted_actor)
);
--> statement-breakpoint
ALTER TABLE appointment_history ALTER COLUMN actor_id DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE appointment_history ADD COLUMN deleted_actor boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE appointment_history ADD CONSTRAINT history_anonymous_actor CHECK (
  (actor_id IS NOT NULL AND NOT deleted_actor) OR (actor_id IS NULL AND deleted_actor)
);
--> statement-breakpoint
ALTER TABLE guest_requests ADD COLUMN deleted_decider boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE guest_requests ADD CONSTRAINT guest_anonymous_decider CHECK (NOT deleted_decider OR decided_by IS NULL);
--> statement-breakpoint
ALTER TABLE audit_logs ADD COLUMN deleted_actor boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE audit_logs ADD CONSTRAINT audit_anonymous_actor CHECK (NOT deleted_actor OR actor_id IS NULL);
--> statement-breakpoint
ALTER TABLE patient_documents ALTER COLUMN uploaded_by DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE patient_documents ADD COLUMN deleted_uploader boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE patient_documents ADD CONSTRAINT document_anonymous_uploader CHECK (
  (uploaded_by IS NOT NULL AND NOT deleted_uploader) OR (uploaded_by IS NULL AND deleted_uploader)
);
--> statement-breakpoint
ALTER TABLE saved_views ALTER COLUMN user_id DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE saved_views ADD COLUMN deleted_owner boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE saved_views ADD CONSTRAINT saved_views_retired_owner CHECK (user_id IS NOT NULL OR (shared_role IS NOT NULL AND deleted_owner));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_clinicflow_doctor_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'retired' AND
     (NEW.status IS DISTINCT FROM 'retired' OR NEW.user_id IS NOT NULL OR NEW.owner_admin_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Historical retired identities cannot be reactivated or reassigned' USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'retired' THEN
    IF NEW.user_id IS NOT NULL OR NEW.owner_admin_id IS NOT NULL OR NEW.retired_at IS NULL THEN
      RAISE EXCEPTION 'Retired doctor must have anonymous identity' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.user_id IS NULL OR NEW.owner_admin_id IS NULL OR NEW.retired_at IS NOT NULL OR
     NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.owner_admin_id AND role = 'clinicAdmin' AND status = 'active') THEN
    RAISE EXCEPTION 'Doctor owner must be an active Clinic Admin' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id AND role = 'clinicAdmin')
     AND NEW.owner_admin_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'A consulting Clinic Admin must own their own doctor profile' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER doctors_owner_guard ON doctors;
--> statement-breakpoint
CREATE TRIGGER doctors_owner_guard BEFORE INSERT OR UPDATE OF owner_admin_id,user_id,status,retired_at ON doctors
FOR EACH ROW EXECUTE FUNCTION enforce_clinicflow_doctor_owner();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION clinicflow_assert_staff_owner(target_user_id text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE target_role text; manager_id text;
BEGIN
  SELECT role, managing_admin_id INTO target_role, manager_id FROM users WHERE id = target_user_id;
  -- Deferred assignment guards can run after the target login has been removed.
  -- An absent target is not live staff; all remaining FKs still forbid orphans.
  IF NOT FOUND THEN RETURN; END IF;
  IF target_role = 'clinicAdmin' THEN
    IF EXISTS (SELECT 1 FROM doctors WHERE user_id = target_user_id AND owner_admin_id IS DISTINCT FROM target_user_id)
       OR EXISTS (SELECT 1 FROM assignments a JOIN clinics c ON c.id = a.clinic_id WHERE a.user_id = target_user_id AND c.admin_id IS DISTINCT FROM target_user_id) THEN
      RAISE EXCEPTION 'Consulting Clinic Admin ownership must remain self-owned' USING ERRCODE = '23514';
    END IF;
    RETURN;
  END IF;
  IF target_role = 'doctor' THEN
    SELECT owner_admin_id INTO manager_id FROM doctors WHERE user_id = target_user_id;
  END IF;
  IF target_role NOT IN ('doctor', 'receptionist') THEN RETURN; END IF;
  IF manager_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM users manager WHERE manager.id = manager_id AND manager.role = 'clinicAdmin' AND manager.status = 'active'
  ) THEN
    RAISE EXCEPTION 'staff managing administrator is missing or invalid' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM assignments a JOIN clinics c ON c.id = a.clinic_id
    WHERE a.user_id = target_user_id AND c.admin_id <> manager_id
  ) THEN
    RAISE EXCEPTION 'staff assignment is outside managing administrator ownership' USING ERRCODE = '23514';
  END IF;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION clinicflow_retired_doctor_work_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'retired' AND OLD.status IS DISTINCT FROM 'retired' AND (
    EXISTS (SELECT 1 FROM appointments WHERE doctor_id = NEW.id AND status NOT IN ('completed','noShow','cancelled'))
    OR EXISTS (SELECT 1 FROM guest_requests WHERE doctor_id = NEW.id AND status = 'pending')
    OR EXISTS (SELECT 1 FROM schedules WHERE doctor_id = NEW.id AND status = 'active')
    OR EXISTS (SELECT 1 FROM qrs WHERE doctor_id = NEW.id AND status = 'active')
    OR EXISTS (SELECT 1 FROM branches WHERE data->'linkedSchedule'->>'doctorId' = NEW.id AND data->'linkedSchedule'->>'enabled' = 'true')
  ) THEN
    RAISE EXCEPTION 'Resolve open doctor work before retiring the clinical identity' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER doctors_retirement_work_guard BEFORE UPDATE OF status ON doctors
FOR EACH ROW EXECUTE FUNCTION clinicflow_retired_doctor_work_guard();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION clinicflow_no_retired_doctor_work() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE doctor_status text;
BEGIN
  IF (TG_TABLE_NAME = 'appointments' AND NEW.status NOT IN ('completed','noShow','cancelled'))
     OR (TG_TABLE_NAME = 'guest_requests' AND NEW.status = 'pending')
     OR (TG_TABLE_NAME = 'schedules' AND NEW.status = 'active')
     OR (TG_TABLE_NAME = 'qrs' AND NEW.status = 'active') THEN
    -- A key-share FK lock is insufficient: retirement updates the doctor's status,
    -- not its key. This row lock serializes new work with the retirement check.
    SELECT status INTO doctor_status FROM doctors WHERE id = NEW.doctor_id FOR SHARE;
    IF doctor_status = 'retired' THEN
      RAISE EXCEPTION 'Retired doctor cannot accept operational work' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER appointments_retired_doctor_guard BEFORE INSERT OR UPDATE OF doctor_id,status ON appointments
FOR EACH ROW EXECUTE FUNCTION clinicflow_no_retired_doctor_work();
--> statement-breakpoint
CREATE TRIGGER guest_requests_retired_doctor_guard BEFORE INSERT OR UPDATE OF doctor_id,status ON guest_requests
FOR EACH ROW EXECUTE FUNCTION clinicflow_no_retired_doctor_work();
--> statement-breakpoint
CREATE TRIGGER schedules_retired_doctor_guard BEFORE INSERT OR UPDATE OF doctor_id,status ON schedules
FOR EACH ROW EXECUTE FUNCTION clinicflow_no_retired_doctor_work();
--> statement-breakpoint
CREATE TRIGGER qrs_retired_doctor_guard BEFORE INSERT OR UPDATE OF doctor_id,status ON qrs
FOR EACH ROW EXECUTE FUNCTION clinicflow_no_retired_doctor_work();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION clinicflow_no_retired_linked_hours() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE linked_doctor text;
DECLARE linked_status text;
BEGIN
  IF NEW.data->'linkedSchedule'->>'enabled' = 'true' THEN
    linked_doctor := NEW.data->'linkedSchedule'->>'doctorId';
    SELECT status INTO linked_status FROM doctors WHERE id=linked_doctor FOR SHARE;
    IF linked_status IS NULL OR linked_status='retired' THEN
      RAISE EXCEPTION 'Linked doctor is unavailable for operational hours' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER branches_retired_linked_hours_guard BEFORE INSERT OR UPDATE OF data ON branches
FOR EACH ROW EXECUTE FUNCTION clinicflow_no_retired_linked_hours();
