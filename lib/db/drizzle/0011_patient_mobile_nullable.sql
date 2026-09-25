-- Bring fresh migration-based databases into alignment with the existing
-- Drizzle/dev/production contract. Do not rewrite any stored mobile values.
ALTER TABLE "patients" ALTER COLUMN "mobile" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "mobile" DROP DEFAULT;