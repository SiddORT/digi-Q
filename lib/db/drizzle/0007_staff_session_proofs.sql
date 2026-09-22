CREATE TABLE "staff_session_proofs" (
	"session_id" text PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "staff_session_proof_user_idx" ON "staff_session_proofs" USING btree ("clerk_user_id");
--> statement-breakpoint
CREATE INDEX "staff_session_proof_expiry_idx" ON "staff_session_proofs" USING btree ("expires_at");