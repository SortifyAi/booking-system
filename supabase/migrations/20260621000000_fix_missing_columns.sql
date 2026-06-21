-- Korrigiert fehlende Spalten, die in dieser DB nie angelegt wurden,
-- obwohl die ursprünglichen Migrationen als "applied" markiert sind.
--
-- Symptome vor diesem Fix:
--   * Standort bearbeiten -> "Standort konnte nicht aktualisiert werden"
--     (App sendet 'phone' im UPDATE -> PostgREST PGRST204:
--      "Could not find the 'phone' column of 'locations'")
--   * Oeffentliche Buchungsseite zeigt keinen Standort an / nichts passiert
--     (/api/public/org/[slug] selektiert 'phone' -> Query schlaegt fehl)
--   * Faehigkeiten-Seite / Skills-Update schlaegt fehl (resources.skills fehlt)
--
-- Alle Statements sind idempotent: existiert die Spalte bereits, passiert nichts.

-- 1) locations.phone  (urspruenglich aus 20260618202305_email_domain_blocklist.sql)
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2) resources.skills (urspruenglich aus 20260520_add_skills_to_resources.sql)
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_resources_skills
  ON public.resources USING GIN (skills);

-- PostgREST Schema-Cache neu laden, damit die neuen Spalten sofort sichtbar sind.
NOTIFY pgrst, 'reload schema';
