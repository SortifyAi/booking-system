-- Schnell-Termin im Dashboard: das Personal kennt die E-Mail einer
-- Laufkundschaft oft nicht. Bisher war bookings.customer_email NOT NULL
-- (aus 20250213000000_init_schema.sql), wodurch ein Insert ohne E-Mail
-- abgelehnt wurde.
--
-- Idempotent: DROP NOT NULL auf einer bereits nullable Spalte ist ein No-op.

ALTER TABLE public.bookings
  ALTER COLUMN customer_email DROP NOT NULL;

-- PostgREST Schema-Cache neu laden, damit die Änderung sofort greift.
NOTIFY pgrst, 'reload schema';
