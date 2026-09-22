ALTER TABLE "clinics" ADD COLUMN "admin_id" text;--> statement-breakpoint
ALTER TABLE "doctors" ADD COLUMN "owner_admin_id" text;--> statement-breakpoint
UPDATE "clinics" SET "admin_id" = 'ce7bb2fa-a30b-4016-83f4-cbb0ed271a79'
WHERE "id" IN ('3017b34d-709a-43dc-a60c-cab13dbc26d4','b2b51bb2-c74a-45fc-bf2d-1cb635169fb1','b362f6b2-ab5f-43ba-a9d8-51874ac031d7','f7912911-cf2d-48c1-934c-e10d8e0f13b4');--> statement-breakpoint
UPDATE "doctors" SET "owner_admin_id" = 'ce7bb2fa-a30b-4016-83f4-cbb0ed271a79'
WHERE "id" IN ('2405dea7-8726-4377-acaf-b13f8f4c3fc0','6c45be41-84b5-466b-8b0b-9c19d50e5940');--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM clinics WHERE admin_id IS NULL) OR EXISTS (SELECT 1 FROM doctors WHERE owner_admin_id IS NULL) THEN
    RAISE EXCEPTION 'Ownership backfill is incomplete; migration stopped safely';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "clinics" ALTER COLUMN "admin_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "doctors" ALTER COLUMN "owner_admin_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "clinics" ADD CONSTRAINT "clinics_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_owner_admin_id_users_id_fk" FOREIGN KEY ("owner_admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assignment_user_clinic_only_unique" ON "assignments" USING btree ("user_id","clinic_id") WHERE "assignments"."branch_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "assignment_user_branch_unique" ON "assignments" USING btree ("user_id","branch_id") WHERE "assignments"."branch_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "branch_id_clinic_unique" ON "branches" USING btree ("id","clinic_id");--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignment_branch_clinic_fk" FOREIGN KEY ("branch_id","clinic_id") REFERENCES "public"."branches"("id","clinic_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "branch_name_clinic_unique" ON "branches" USING btree ("clinic_id",lower("data"->>'name'));--> statement-breakpoint
CREATE INDEX "clinic_admin_idx" ON "clinics" USING btree ("admin_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clinic_name_unique" ON "clinics" USING btree (lower("data"->>'name'));--> statement-breakpoint
CREATE INDEX "doctor_owner_admin_idx" ON "doctors" USING btree ("owner_admin_id");--> statement-breakpoint
INSERT INTO assignments (id, user_id, clinic_id, branch_id)
SELECT gen_random_uuid()::text, 'ce7bb2fa-a30b-4016-83f4-cbb0ed271a79', c.id, NULL
FROM clinics c
WHERE c.admin_id = 'ce7bb2fa-a30b-4016-83f4-cbb0ed271a79'
  AND NOT EXISTS (SELECT 1 FROM assignments a WHERE a.user_id = c.admin_id AND a.clinic_id = c.id AND a.branch_id IS NULL);--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_clinicflow_admin_ownership() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE admin_role text; admin_status text;
BEGIN
  SELECT role, status INTO admin_role, admin_status FROM users WHERE id = NEW.admin_id;
  IF admin_role IS DISTINCT FROM 'clinicAdmin' OR admin_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Clinic owner administrator must be an active Clinic Admin';
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER clinics_admin_guard BEFORE INSERT OR UPDATE OF admin_id ON clinics
FOR EACH ROW EXECUTE FUNCTION enforce_clinicflow_admin_ownership();--> statement-breakpoint
CREATE OR REPLACE FUNCTION sync_clinicflow_admin_assignment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.admin_id IS DISTINCT FROM NEW.admin_id THEN
    DELETE FROM assignments WHERE user_id = OLD.admin_id AND clinic_id = NEW.id;
  END IF;
  INSERT INTO assignments (id, user_id, clinic_id, branch_id)
  VALUES (gen_random_uuid()::text, NEW.admin_id, NEW.id, NULL)
  ON CONFLICT (user_id, clinic_id) WHERE branch_id IS NULL DO NOTHING;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER clinics_admin_assignment AFTER INSERT OR UPDATE OF admin_id ON clinics
FOR EACH ROW EXECUTE FUNCTION sync_clinicflow_admin_assignment();--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_clinicflow_assignment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE user_role text; expected_admin text;
BEGIN
  SELECT role INTO user_role FROM users WHERE id = NEW.user_id;
  IF user_role = 'clinicAdmin' THEN
    SELECT admin_id INTO expected_admin FROM clinics WHERE id = NEW.clinic_id;
    IF expected_admin IS DISTINCT FROM NEW.user_id OR NEW.branch_id IS NOT NULL THEN
      RAISE EXCEPTION 'Clinic Admin assignment must match the clinic administrator';
    END IF;
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER assignments_admin_guard BEFORE INSERT OR UPDATE ON assignments
FOR EACH ROW EXECUTE FUNCTION enforce_clinicflow_assignment();--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_clinicflow_admin_assignment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.branch_id IS NULL AND EXISTS (SELECT 1 FROM clinics WHERE id = OLD.clinic_id AND admin_id = OLD.user_id) THEN
    RAISE EXCEPTION 'The clinic administrator assignment cannot be removed';
  END IF;
  RETURN OLD;
END $$;--> statement-breakpoint
CREATE TRIGGER assignments_admin_delete_guard BEFORE DELETE ON assignments
FOR EACH ROW EXECUTE FUNCTION protect_clinicflow_admin_assignment();--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_clinicflow_doctor_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.owner_admin_id AND role = 'clinicAdmin' AND status = 'active') THEN
    RAISE EXCEPTION 'Doctor owner must be an active Clinic Admin';
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER doctors_owner_guard BEFORE INSERT OR UPDATE OF owner_admin_id ON doctors
FOR EACH ROW EXECUTE FUNCTION enforce_clinicflow_doctor_owner();--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_clinicflow_admin_account() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role = 'clinicAdmin' AND EXISTS (
    SELECT 1 FROM assignments a
    LEFT JOIN clinics c ON c.id = a.clinic_id
    WHERE a.user_id = NEW.id AND (a.branch_id IS NOT NULL OR c.admin_id IS DISTINCT FROM NEW.id)
  ) THEN
    RAISE EXCEPTION 'Existing assignments are incompatible with the Clinic Admin role';
  END IF;
  IF OLD.role = 'clinicAdmin' AND (NEW.role IS DISTINCT FROM 'clinicAdmin' OR NEW.status IS DISTINCT FROM 'active')
     AND (EXISTS (SELECT 1 FROM clinics WHERE admin_id = OLD.id) OR EXISTS (SELECT 1 FROM doctors WHERE owner_admin_id = OLD.id)) THEN
    RAISE EXCEPTION 'Transfer clinic and doctor ownership before changing this administrator';
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER users_admin_account_guard BEFORE UPDATE OF role, status ON users
FOR EACH ROW EXECUTE FUNCTION protect_clinicflow_admin_account();