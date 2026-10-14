CREATE TABLE staff_erased_assets (
  asset_fingerprint text PRIMARY KEY CHECK (asset_fingerprint ~ '^[a-f0-9]{64}$'),
  operation_id text NOT NULL REFERENCES staff_deletion_receipts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION clinicflow_asset_alias_fingerprints(value text)
RETURNS SETOF text LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT DISTINCT encode(sha256(convert_to(m[1],'UTF8')),'hex')
  FROM regexp_matches(
    replace(replace(replace(lower(value),'%2d','-'),'&#45;','-'),'&#x2d;','-'),
    '([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})','g'
  ) m;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION clinicflow_no_erased_asset_reference() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM staff_erased_assets f
    JOIN clinicflow_asset_alias_fingerprints(to_jsonb(NEW)::text) a ON a=f.asset_fingerprint) THEN
    RAISE EXCEPTION 'An erased asset cannot be referenced or recreated' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION clinicflow_immutable_asset_fence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Erased asset fences are immutable' USING ERRCODE='23514';
END $$;
--> statement-breakpoint
CREATE TRIGGER asset_fence_immutable BEFORE UPDATE OR DELETE ON staff_erased_assets
FOR EACH ROW EXECUTE FUNCTION clinicflow_immutable_asset_fence();
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
      AND table_name NOT IN ('staff_erased_assets','staff_deletion_receipts','integration_credentials')
  LOOP
    EXECUTE format('CREATE TRIGGER erased_asset_reference_guard BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION clinicflow_no_erased_asset_reference()',t);
  END LOOP;
END $$;
