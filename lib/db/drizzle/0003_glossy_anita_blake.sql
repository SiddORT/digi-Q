DROP INDEX "audit_scope_idx";--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "branch_id" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_scope_idx" ON "audit_logs" USING btree ("clinic_id","branch_id","created_at");