-- Reminder pipeline: track when a reminder email was sent for a booking so the
-- hourly cron does not send duplicates. NULL = not yet reminded.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_sent TIMESTAMPTZ;

-- Partial index makes the cron's "WHERE reminder_sent IS NULL" lookup cheap.
CREATE INDEX IF NOT EXISTS idx_bookings_reminder_sent
  ON bookings(reminder_sent)
  WHERE reminder_sent IS NULL;
