-- Self-service booking management without login.
-- Each booking gets an unguessable secret token used as a "magic link" so a
-- customer can view and cancel their own appointment without an account.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS manage_token TEXT;

-- Unique (NULLs allowed) so each link points to exactly one booking.
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_manage_token
  ON bookings(manage_token);

-- Backfill existing rows so old bookings are manageable too.
-- Two UUIDs (hex, dashes stripped) give ~240 bits of randomness without
-- requiring the pgcrypto extension.
UPDATE bookings
SET manage_token = replace(gen_random_uuid()::text, '-', '')
                 || replace(gen_random_uuid()::text, '-', '')
WHERE manage_token IS NULL;
