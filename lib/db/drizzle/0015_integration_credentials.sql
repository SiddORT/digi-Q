-- Additive storage only. Apply through the authorized deployment migration process.
CREATE TABLE IF NOT EXISTS integration_credentials (
  provider text PRIMARY KEY,
  encrypted text NOT NULL,
  revision text NOT NULL
);