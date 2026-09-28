-- Additive only. Keep clerk_id and staff_session_proofs for rollback until migration is verified.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp with time zone;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_changed_at" timestamp with time zone;
CREATE TABLE IF NOT EXISTS "auth_sessions" (
  "token_hash" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "auth_session_user_idx" ON "auth_sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "auth_session_expiry_idx" ON "auth_sessions" ("expires_at");
CREATE TABLE IF NOT EXISTS "auth_challenges" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text REFERENCES "users"("id"),
  "email" text NOT NULL,
  "purpose" text NOT NULL,
  "token_hash" text NOT NULL,
  "data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "auth_challenge_email_idx" ON "auth_challenges" ("email", "purpose");
CREATE INDEX IF NOT EXISTS "auth_challenge_expiry_idx" ON "auth_challenges" ("expires_at");
CREATE TABLE IF NOT EXISTS "auth_rate_limits" (
  "key" text PRIMARY KEY NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);
CREATE INDEX IF NOT EXISTS "auth_rate_limit_expiry_idx" ON "auth_rate_limits" ("expires_at");