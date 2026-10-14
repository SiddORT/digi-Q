CREATE TABLE staff_erased_identities (
  identity_fingerprint text PRIMARY KEY CHECK (identity_fingerprint ~ '^[a-f0-9]{64}$'),
  operation_id text NOT NULL REFERENCES staff_deletion_receipts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION clinicflow_json_identity_tokens(value jsonb)
RETURNS SETOF text LANGUAGE sql IMMUTABLE STRICT AS $$
  WITH RECURSIVE nodes(v) AS (
    SELECT value
    UNION ALL
    SELECT child.v FROM nodes n CROSS JOIN LATERAL (
      SELECT e.value AS v FROM jsonb_each(CASE WHEN jsonb_typeof(n.v)='object' THEN n.v ELSE '{}'::jsonb END) e
      UNION ALL
      SELECT a.value AS v FROM jsonb_array_elements(CASE WHEN jsonb_typeof(n.v)='array' THEN n.v ELSE '[]'::jsonb END) a
    ) child
  )
  SELECT DISTINCT token FROM nodes n CROSS JOIN LATERAL
    regexp_split_to_table(n.v #>> '{}', ':') token WHERE jsonb_typeof(n.v)='string'
  UNION SELECT DISTINCT n.v #>> '{}' FROM nodes n WHERE jsonb_typeof(n.v)='string'
  UNION SELECT DISTINCT k FROM nodes n CROSS JOIN LATERAL
    jsonb_object_keys(CASE WHEN jsonb_typeof(n.v)='object' THEN n.v ELSE '{}'::jsonb END) k;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION clinicflow_no_erased_staff_reference() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM staff_erased_identities f JOIN
    clinicflow_json_identity_tokens(to_jsonb(NEW)) token
      ON f.identity_fingerprint=encode(sha256(convert_to(token,'UTF8')),'hex')) THEN
    RAISE EXCEPTION 'A removed staff identity cannot be referenced or recreated' USING ERRCODE='23514';
  END IF;
  IF TG_TABLE_NAME='settings' AND TG_OP='UPDATE' THEN
    IF OLD.data->>'erased'='true' AND NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'Erased message claims cannot be restored' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER identity_fence_immutable BEFORE UPDATE OR DELETE ON staff_erased_identities
FOR EACH ROW EXECUTE FUNCTION clinicflow_immutable_asset_fence();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION clinicflow_preserve_erased_claim() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.data->>'erased'='true' THEN
    IF TG_OP='DELETE' THEN
      RAISE EXCEPTION 'Erased message claims cannot be deleted' USING ERRCODE='23514';
    END IF;
    IF NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'Erased message claims cannot be restored' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER erased_claim_immutable BEFORE UPDATE OR DELETE ON settings
FOR EACH ROW EXECUTE FUNCTION clinicflow_preserve_erased_claim();
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
      AND table_name NOT IN ('staff_erased_assets','staff_erased_identities','staff_deletion_receipts','integration_credentials')
  LOOP
    EXECUTE format('CREATE TRIGGER erased_staff_reference_guard BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION clinicflow_no_erased_staff_reference()',t);
  END LOOP;
END $$;
