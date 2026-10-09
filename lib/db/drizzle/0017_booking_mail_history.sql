-- Read-only owner history: clinic equality followed by the exact deterministic order.
-- Keep recipient payloads out of the index. No history or dispatch state is rewritten.
CREATE INDEX IF NOT EXISTS "settings_owner_booking_history_idx" ON "settings" USING btree
  ((data->>'clinicId'), ((data->>'createdAt')::bigint) DESC NULLS LAST, id DESC)
  WHERE id LIKE 'mail-outbox:booking:%'
    AND data->>'event' = 'booking' AND data->>'recipientGroup' = 'clinicAdmin';
