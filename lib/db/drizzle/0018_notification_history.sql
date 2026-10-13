-- Protected snapshots remain ciphertext; contact filters use keyed hashes.
CREATE INDEX IF NOT EXISTS settings_notification_history_page_idx ON settings
  (((data->>'createdAt')::bigint) DESC, id DESC) WHERE id LIKE 'notification-history:%';
CREATE INDEX IF NOT EXISTS settings_notification_history_scope_idx ON settings
  ((data->>'clinicId'), (data->>'channel'), ((data->>'createdAt')::bigint) DESC, id DESC)
  WHERE id LIKE 'notification-history:%';
CREATE INDEX IF NOT EXISTS settings_notification_history_recipient_idx ON settings
  ((data->>'recipientHash'), ((data->>'createdAt')::bigint) DESC, id DESC)
  WHERE id LIKE 'notification-history:%';
CREATE INDEX IF NOT EXISTS settings_notification_history_sender_idx ON settings
  ((data->>'senderHash'), ((data->>'createdAt')::bigint) DESC, id DESC)
  WHERE id LIKE 'notification-history:%';
CREATE INDEX IF NOT EXISTS settings_legacy_notification_time_idx ON settings
  (((data->>'createdAt')::bigint) DESC, id DESC)
  WHERE id LIKE 'mail-outbox:%' OR id LIKE 'sms-outbox:%';
