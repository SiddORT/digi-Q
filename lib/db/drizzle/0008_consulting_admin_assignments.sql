-- Preserve clinic ownership and permit only the owner's own clinical capability
-- to receive a branch assignment. Existing trigger attachments remain enabled.
CREATE OR REPLACE FUNCTION enforce_clinicflow_assignment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE user_role text; user_status text; expected_admin text;
BEGIN
  SELECT role, status INTO user_role, user_status FROM users WHERE id = NEW.user_id;
  IF user_role = 'clinicAdmin' THEN
    SELECT admin_id INTO expected_admin FROM clinics WHERE id = NEW.clinic_id FOR SHARE;
    IF expected_admin IS DISTINCT FROM NEW.user_id OR user_status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'Clinic Admin assignment must match the active clinic administrator';
    END IF;
    IF NEW.branch_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM branches b JOIN clinics c ON c.id = b.clinic_id
      JOIN doctors d ON d.user_id = NEW.user_id AND d.owner_admin_id = NEW.user_id
      WHERE b.id = NEW.branch_id AND b.clinic_id = NEW.clinic_id
        AND c.admin_id = NEW.user_id AND c.status = 'active'
        AND b.status = 'active' AND d.status = 'active'
    ) THEN
      RAISE EXCEPTION 'Clinic Admin branch assignment requires an active own doctor profile in an owned active branch';
    END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION clinicflow_assert_staff_owner(target_user_id text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE target_role text; manager_id text;
BEGIN
  SELECT role, managing_admin_id INTO target_role, manager_id FROM users WHERE id = target_user_id;
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
CREATE OR REPLACE FUNCTION protect_clinicflow_admin_account() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role = 'clinicAdmin' AND (
    EXISTS (
      SELECT 1 FROM assignments a LEFT JOIN clinics c ON c.id = a.clinic_id
      WHERE a.user_id = NEW.id AND (
        c.admin_id IS DISTINCT FROM NEW.id OR
        (a.branch_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM branches b JOIN doctors d ON d.user_id = NEW.id AND d.owner_admin_id = NEW.id
          WHERE b.id = a.branch_id AND b.clinic_id = a.clinic_id
        ))
      )
    ) OR EXISTS (SELECT 1 FROM doctors WHERE user_id = NEW.id AND owner_admin_id IS DISTINCT FROM NEW.id)
  ) THEN
    RAISE EXCEPTION 'Existing assignments are incompatible with the Clinic Admin role';
  END IF;
  IF OLD.role = 'clinicAdmin' AND (NEW.role IS DISTINCT FROM 'clinicAdmin' OR NEW.status IS DISTINCT FROM 'active')
     AND (EXISTS (SELECT 1 FROM clinics WHERE admin_id = OLD.id) OR EXISTS (SELECT 1 FROM doctors WHERE owner_admin_id = OLD.id)) THEN
    RAISE EXCEPTION 'Transfer clinic and doctor ownership before changing this administrator';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_clinicflow_doctor_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.owner_admin_id AND role = 'clinicAdmin' AND status = 'active') THEN
    RAISE EXCEPTION 'Doctor owner must be an active Clinic Admin';
  END IF;
  IF EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id AND role = 'clinicAdmin')
     AND NEW.owner_admin_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'A consulting Clinic Admin must own their own doctor profile';
  END IF;
  RETURN NEW;
END $$;