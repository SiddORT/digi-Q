-- Existing guest-request storage was represented in the schema but absent from
-- the historical SQL chain. Preserve it for fresh migration-based environments.
CREATE TABLE IF NOT EXISTS "guest_requests" (
  "id" text PRIMARY KEY NOT NULL,
  "request_id" text NOT NULL,
  "receipt_hash" text NOT NULL,
  "input_hash" text NOT NULL,
  "clinic_id" text NOT NULL CONSTRAINT "guest_requests_clinic_id_clinics_id_fk" REFERENCES "clinics"("id"),
  "branch_id" text NOT NULL CONSTRAINT "guest_requests_branch_id_branches_id_fk" REFERENCES "branches"("id"),
  "doctor_id" text NOT NULL CONSTRAINT "guest_requests_doctor_id_doctors_id_fk" REFERENCES "doctors"("id"),
  "date" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "appointment_id" text CONSTRAINT "guest_requests_appointment_id_appointments_id_fk" REFERENCES "appointments"("id"),
  "decided_by" text CONSTRAINT "guest_requests_decided_by_users_id_fk" REFERENCES "users"("id"),
  "data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "guest_requests_request_id_unique" UNIQUE("request_id"),
  CONSTRAINT "guest_requests_receipt_hash_unique" UNIQUE("receipt_hash"),
  CONSTRAINT "guest_requests_appointment_id_unique" UNIQUE("appointment_id"),
  CONSTRAINT "guest_request_status" CHECK ("status" in ('pending','confirmed','rejected'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guest_request_scope_idx" ON "guest_requests" USING btree ("clinic_id","branch_id","status");