-- Zusatzleistungen (add-on services) + Sammelbuchungen für mehrere Personen
--
-- 1. offerings.available_as_addon: markiert eine Leistung als zubuchbare
--    Zusatzleistung. Solche Leistungen erscheinen im Buchungsflow zusätzlich
--    zum gewählten Hauptservice und bleiben weiterhin einzeln buchbar.
-- 2. bookings.group_id: verknüpft die parallel angelegten Buchungen einer
--    Sammelbuchung (mehrere Personen, gleiche Startzeit, je eigener Mitarbeiter).
--    Die Buchungen einer Gruppe teilen sich zusätzlich denselben manage_token,
--    damit Verwaltung/Storno die gesamte Gruppe betreffen.
--    Zusatzleistungen einer Buchung liegen in bookings.metadata.addons.

ALTER TABLE offerings
  ADD COLUMN IF NOT EXISTS available_as_addon BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS group_id UUID;

CREATE INDEX IF NOT EXISTS idx_bookings_group_id ON bookings(group_id);
