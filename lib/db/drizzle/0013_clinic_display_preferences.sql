-- Additive settings-document migration; no schedule, timezone or instant changes.
-- Preserve existing selections and unrelated settings. Safe to repeat.
UPDATE clinics
SET data = jsonb_build_object('dateFormat', 'DD MMM YYYY', 'timeFormat', '12h') || data
WHERE NOT (data ? 'dateFormat') OR NOT (data ? 'timeFormat');