ALTER TABLE "masters" ADD CONSTRAINT "masters_parent_id_masters_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."masters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "appointment_reference_idx" ON "appointments" USING btree (("data"->>'reference'));--> statement-breakpoint
CREATE INDEX "patient_mobile_idx" ON "patients" USING btree ("mobile");--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointment_token_positive" CHECK ("appointments"."token_number" > 0);