ALTER TABLE "doctors" ADD COLUMN "created_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "managing_admin_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "invitation_status" text DEFAULT 'failed' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_managing_admin_id_users_id_fk" FOREIGN KEY ("managing_admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_managing_admin_idx" ON "users" USING btree ("managing_admin_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_managing_admin_role" CHECK ("users"."managing_admin_id" is null or "users"."role" = 'receptionist');--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_invitation_status" CHECK ("users"."invitation_status" in ('sent','failed','notRequired'));
--> statement-breakpoint
UPDATE "users" SET "invitation_status" = 'notRequired' WHERE "clerk_id" IS NOT NULL;
--> statement-breakpoint
UPDATE "users" receptionist
SET "managing_admin_id" = candidate.admin_id
FROM (
  SELECT a.user_id, min(c.admin_id) AS admin_id
  FROM assignments a
  JOIN clinics c ON c.id = a.clinic_id
  JOIN users owner ON owner.id = c.admin_id AND owner.role = 'clinicAdmin' AND owner.status = 'active'
  JOIN users target ON target.id = a.user_id AND target.role = 'receptionist'
  GROUP BY a.user_id
  HAVING count(DISTINCT c.admin_id) = 1
     AND count(*) = count(c.id)
) candidate
WHERE receptionist.id = candidate.user_id
  AND receptionist.managing_admin_id IS NULL;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION clinicflow_assert_staff_owner(target_user_id text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  target_role text;
  manager_id text;
BEGIN
  SELECT role, managing_admin_id INTO target_role, manager_id FROM users WHERE id = target_user_id;
  IF target_role = 'doctor' THEN
    SELECT owner_admin_id INTO manager_id FROM doctors WHERE user_id = target_user_id;
  END IF;
  IF target_role NOT IN ('doctor', 'receptionist') THEN
    RETURN;
  END IF;
  IF manager_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM users manager WHERE manager.id = manager_id AND manager.role = 'clinicAdmin' AND manager.status = 'active'
  ) THEN
    RAISE EXCEPTION 'staff managing administrator is missing or invalid' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM assignments a
    JOIN clinics c ON c.id = a.clinic_id
    WHERE a.user_id = target_user_id AND c.admin_id <> manager_id
  ) THEN
    RAISE EXCEPTION 'staff assignment is outside managing administrator ownership' USING ERRCODE = '23514';
  END IF;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION clinicflow_assignment_owner_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM clinicflow_assert_staff_owner(NEW.user_id);
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER assignment_owner_guard
AFTER INSERT OR UPDATE ON assignments
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION clinicflow_assignment_owner_guard();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION clinicflow_staff_manager_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM clinicflow_assert_staff_owner(CASE WHEN TG_TABLE_NAME = 'doctors' THEN NEW.user_id ELSE NEW.id END);
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER receptionist_manager_guard
AFTER INSERT OR UPDATE OF managing_admin_id, role ON users
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION clinicflow_staff_manager_guard();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER doctor_manager_guard
AFTER INSERT OR UPDATE OF owner_admin_id, user_id ON doctors
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION clinicflow_staff_manager_guard();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION clinicflow_clinic_owner_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_user_id text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users owner WHERE owner.id = NEW.admin_id AND owner.role = 'clinicAdmin' AND owner.status = 'active'
  ) THEN
    RAISE EXCEPTION 'clinic owner is missing or is not an active Clinic Admin' USING ERRCODE = '23514';
  END IF;
  FOR target_user_id IN SELECT DISTINCT user_id FROM assignments WHERE clinic_id = NEW.id LOOP
    PERFORM clinicflow_assert_staff_owner(target_user_id);
  END LOOP;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER clinic_owner_guard
AFTER INSERT OR UPDATE OF admin_id ON clinics
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION clinicflow_clinic_owner_guard();