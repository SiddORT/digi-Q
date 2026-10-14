CREATE TABLE appointment_transitions (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  operation_id text NOT NULL,
  appointment_id text NOT NULL REFERENCES appointments(id),
  patient_id text NOT NULL REFERENCES patients(id),
  clinic_id text NOT NULL REFERENCES clinics(id),
  actor_id text REFERENCES users(id),
  deleted_actor boolean NOT NULL DEFAULT false,
  from_doctor_id text NOT NULL REFERENCES doctors(id),
  to_doctor_id text NOT NULL REFERENCES doctors(id),
  from_branch_id text NOT NULL REFERENCES branches(id),
  to_branch_id text NOT NULL REFERENCES branches(id),
  before_coordinates jsonb NOT NULL,
  after_coordinates jsonb NOT NULL,
  reference_fingerprint text NOT NULL,
  from_revision integer NOT NULL,
  to_revision integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transition_operation_visit UNIQUE(operation_id, appointment_id),
  CONSTRAINT transition_visit_revision UNIQUE(appointment_id, to_revision),
  CONSTRAINT transition_anonymous_actor CHECK (
    (actor_id IS NOT NULL AND NOT deleted_actor) OR (actor_id IS NULL AND deleted_actor)),
  CONSTRAINT transition_reference_fingerprint CHECK(reference_fingerprint ~ '^[a-f0-9]{64}$'),
  CONSTRAINT transition_revision CHECK(from_revision >= 0 AND to_revision = from_revision + 1),
  CONSTRAINT transition_doctor_change CHECK(from_doctor_id <> to_doctor_id),
  CONSTRAINT transition_coordinates CHECK (
    jsonb_typeof(before_coordinates) = 'object' AND jsonb_typeof(after_coordinates) = 'object'
    AND before_coordinates - ARRAY['date','sessionId','startTime','endTime','timezone','token','tokenNumber','expectedDurationMinutes']::text[] = '{}'::jsonb
    AND after_coordinates - ARRAY['date','sessionId','startTime','endTime','timezone','token','tokenNumber','expectedDurationMinutes']::text[] = '{}'::jsonb)
);
--> statement-breakpoint
CREATE INDEX transition_visit_idx ON appointment_transitions(appointment_id);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION clinicflow_immutable_visit_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Historical visit transitions cannot be deleted' USING ERRCODE='23514';
  END IF;
  IF to_jsonb(NEW) = to_jsonb(OLD) THEN RETURN NEW; END IF;
  IF OLD.actor_id IS NOT NULL AND NOT OLD.deleted_actor AND NEW.actor_id IS NULL AND NEW.deleted_actor
    AND to_jsonb(NEW) - ARRAY['actor_id','deleted_actor']::text[] =
        to_jsonb(OLD) - ARRAY['actor_id','deleted_actor']::text[] THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Historical visit transitions are immutable except actor erasure' USING ERRCODE='23514';
END $$;
--> statement-breakpoint
CREATE TRIGGER transition_immutable BEFORE UPDATE OR DELETE ON appointment_transitions
FOR EACH ROW EXECUTE FUNCTION clinicflow_immutable_visit_transition();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION clinicflow_validate_visit_transition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE visit appointments%ROWTYPE;
DECLARE actual_coordinates jsonb;
BEGIN
  SELECT * INTO visit FROM appointments WHERE id=NEW.appointment_id FOR SHARE;
  IF NOT FOUND OR visit.patient_id<>NEW.patient_id OR visit.clinic_id<>NEW.clinic_id
    OR visit.doctor_id<>NEW.to_doctor_id OR visit.branch_id<>NEW.to_branch_id
    OR coalesce((visit.data->>'revision')::integer,0)<>NEW.to_revision
    OR visit.status NOT IN ('booked','waiting') OR visit.data->>'checkedInAt' IS NOT NULL
    OR visit.data->>'reference' IS NULL
    OR encode(sha256(convert_to(visit.data->>'reference','UTF8')),'hex')<>NEW.reference_fingerprint THEN
    RAISE EXCEPTION 'Visit transition does not match committed care coordinates' USING ERRCODE='23514';
  END IF;
  IF NEW.actor_id IS NULL OR NEW.deleted_actor OR NOT EXISTS (
    SELECT 1 FROM users WHERE id=NEW.actor_id AND role='superAdmin' AND status='active'
      AND NOT coalesce((data->>'demo')::boolean,false) AND NOT coalesce((data->>'demoFixture')::boolean,false)) THEN
    RAISE EXCEPTION 'Visit transition requires an active Superadmin actor' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM branches WHERE id=NEW.from_branch_id AND clinic_id=NEW.clinic_id)
    OR NOT EXISTS (SELECT 1 FROM branches WHERE id=NEW.to_branch_id AND clinic_id=NEW.clinic_id) THEN
    RAISE EXCEPTION 'Visit transition must preserve its clinic' USING ERRCODE='23514';
  END IF;
  actual_coordinates := jsonb_build_object('date',visit.date,'sessionId',visit.data->'sessionId',
    'startTime',visit.data->'startTime','endTime',visit.data->'endTime','timezone',visit.data->'timezone',
    'token',visit.data->'token','tokenNumber',visit.token_number,'expectedDurationMinutes',visit.data->'expectedDurationMinutes');
  IF actual_coordinates IS DISTINCT FROM NEW.after_coordinates THEN
    RAISE EXCEPTION 'Visit transition destination snapshot does not match care' USING ERRCODE='23514';
  END IF;
  IF NOT NEW.before_coordinates ?& ARRAY['date','sessionId','startTime','endTime','timezone','token','tokenNumber','expectedDurationMinutes']
    OR NEW.before_coordinates->>'date' IS NULL OR NEW.before_coordinates->>'startTime' IS NULL
    OR NEW.before_coordinates->>'timezone' IS NULL
    OR jsonb_typeof(NEW.before_coordinates->'tokenNumber') IS DISTINCT FROM 'number'
    OR (NEW.before_coordinates->>'tokenNumber')::numeric<=0
    OR jsonb_typeof(NEW.before_coordinates->'expectedDurationMinutes') IS DISTINCT FROM 'number'
    OR (NEW.before_coordinates->>'expectedDurationMinutes')::numeric<=0 THEN
    RAISE EXCEPTION 'Original visit coordinates must be complete' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER transition_validate BEFORE INSERT ON appointment_transitions
FOR EACH ROW EXECUTE FUNCTION clinicflow_validate_visit_transition();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION clinicflow_preserve_transition_visit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM appointment_transitions WHERE appointment_id=OLD.id)
    AND (NEW.patient_id IS DISTINCT FROM OLD.patient_id OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id
      OR NEW.data->>'reference' IS DISTINCT FROM OLD.data->>'reference') THEN
    RAISE EXCEPTION 'Historical handoff patient, clinic and private ticket reference must be preserved' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER transition_preserve_visit BEFORE UPDATE ON appointments
FOR EACH ROW EXECUTE FUNCTION clinicflow_preserve_transition_visit();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION clinicflow_immutable_handoff_marker() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' AND OLD.id LIKE 'staff-handoff:%' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Completed handoff receipts cannot be deleted' USING ERRCODE='23514';
    END IF;
    IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
      RAISE EXCEPTION 'Completed handoff receipts are immutable' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP <> 'DELETE' AND NEW.id LIKE 'staff-handoff:%' THEN
    IF NEW.data - ARRAY['kind','sourceFingerprint','destinationFingerprint','proposalHash','result']::text[] <> '{}'::jsonb
      OR NEW.data->>'kind' IS DISTINCT FROM 'staff_responsibility_handoff'
      OR NOT coalesce(NEW.data->>'sourceFingerprint' ~ '^[a-f0-9]{64}$',false)
      OR NOT coalesce(NEW.data->>'destinationFingerprint' ~ '^[a-f0-9]{64}$',false)
      OR NOT coalesce(NEW.data->>'proposalHash' ~ '^[a-f0-9]{64}$',false)
      OR jsonb_typeof(NEW.data->'result') IS DISTINCT FROM 'object'
      OR NOT (NEW.data->'result') ?& ARRAY['operationId','clinicCount','staffCount','doctorCount','accountRemoved']
      OR (NEW.data->'result') - ARRAY['operationId','clinicCount','staffCount','doctorCount','accountRemoved']::text[] <> '{}'::jsonb
      OR NEW.data->'result'->>'operationId' IS DISTINCT FROM substring(NEW.id from 15)
      OR NEW.data->'result'->'accountRemoved' IS DISTINCT FROM 'false'::jsonb THEN
      RAISE EXCEPTION 'Handoff receipt must contain only minimal verified progress' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER handoff_marker_immutable BEFORE INSERT OR UPDATE OR DELETE ON settings
FOR EACH ROW EXECUTE FUNCTION clinicflow_immutable_handoff_marker();
