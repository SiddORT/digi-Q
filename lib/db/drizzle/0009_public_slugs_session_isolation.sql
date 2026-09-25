-- Persist the index-only development change in the migration chain.
-- Drizzle applies this migration transactionally; no records are rewritten.
CREATE UNIQUE INDEX IF NOT EXISTS "clinic_slug_unique" ON "clinics" USING btree (("data"->>'slug'));
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "branch_slug_clinic_unique" ON "branches" USING btree ("clinic_id",("data"->>'slug'));
--> statement-breakpoint
DROP INDEX IF EXISTS "schedule_active_location_day_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "schedule_active_location_day_unique" ON "schedules" USING btree ("doctor_id","branch_id","day_of_week",("data"->>'startTime')) WHERE "status" = 'active';
--> statement-breakpoint
DROP INDEX IF EXISTS "exception_date_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX "exception_date_idx" ON "availability_exceptions" USING btree ("doctor_id","branch_id","date",(coalesce("data"->>'sessionId','')));
--> statement-breakpoint
DROP INDEX IF EXISTS "appointment_token_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX "appointment_token_idx" ON "appointments" USING btree ("doctor_id","branch_id","date",(coalesce("data"->>'startTime','')),"token_number");
--> statement-breakpoint
DROP INDEX IF EXISTS "appointment_active_patient_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX "appointment_active_patient_idx" ON "appointments" USING btree ("patient_id","doctor_id","branch_id","date",(coalesce("data"->>'startTime',''))) WHERE "status" not in ('cancelled','completed','noShow');
--> statement-breakpoint
DROP INDEX IF EXISTS "appointment_one_consult_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX "appointment_one_consult_idx" ON "appointments" USING btree ("doctor_id","branch_id","date",(coalesce("data"->>'startTime',''))) WHERE "status" in ('called','inConsultation');