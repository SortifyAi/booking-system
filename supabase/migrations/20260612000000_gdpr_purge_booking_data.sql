-- DSGVO: automatische Löschung von Buchungs- und Kontaktdaten.
--
-- Personenbezogene Daten (Name, E-Mail, Telefon, Notizen, Metadaten der
-- Kund:innen) werden nur so lange aufbewahrt, wie sie für den Zweck der
-- Terminabwicklung gebraucht werden. 14 Tage nach Termin-Ende ist der Zweck
-- erfüllt: die Buchung wird vollständig gelöscht (DELETE).
--
-- WICHTIG: PII der Kund:innen steckt an DREI Stellen:
--   1. bookings                (customer_name/_email/_phone, notes, metadata)
--   2. notification_log        (recipient = E-Mail/Telefon)
--   3. audit_logs.changes      (vollständiger row_to_json-Snapshot der Buchung,
--                               vom Trigger `audit_bookings` bei jedem
--                               INSERT/UPDATE/DELETE geschrieben)
-- Alle drei müssen bereinigt werden, sonst bleibt die DSGVO-Löschung wirkungslos.
--
-- Besonderheit audit_logs: der AFTER-DELETE-Trigger schreibt beim Löschen einer
-- Buchung row_to_json(OLD) — also erneut sämtliche Kundendaten — frisch in
-- audit_logs. Deshalb werden die Audit-Einträge der betroffenen Buchungen
-- NACH dem DELETE noch einmal entfernt.
--
-- Umgesetzt direkt in der Datenbank über pg_cron, damit die Löschung auch
-- ohne laufende Anwendung garantiert und nachvollziehbar erfolgt.

-- pg_cron erlaubt zeitgesteuerte Jobs innerhalb von Postgres.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- Löschfunktion
-- ============================================================================
-- SECURITY DEFINER, damit der pg_cron-Hintergrundprozess (eigene Rolle) die
-- Zeilen löschen darf. search_path fest, um Hijacking zu vermeiden.
CREATE OR REPLACE FUNCTION public.purge_expired_booking_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- 14 Tage nach Termin-Ende
  cutoff TIMESTAMPTZ := NOW() - INTERVAL '14 days';
  expired_ids UUID[];
  deleted_bookings INT;
BEGIN
  -- IDs der abgelaufenen Buchungen einsammeln, um damit gezielt auch die
  -- abhängigen Logs (notification_log, audit_logs) treffen zu können.
  SELECT array_agg(id) INTO expired_ids
  FROM bookings
  WHERE end_time < cutoff;

  -- Audit-Snapshots dieser Buchungen entfernen (changes enthält PII).
  -- WICHTIG: nur wenn es überhaupt abgelaufene Buchungen gibt; bei NULL würde
  -- `= ANY(NULL)` ungewollt nichts/alles matchen.
  IF expired_ids IS NOT NULL THEN
    DELETE FROM audit_logs
    WHERE entity_type = 'bookings'
      AND entity_id = ANY(expired_ids);

    -- Benachrichtigungs-Logs der betroffenen Buchungen (recipient = PII).
    DELETE FROM notification_log
    WHERE booking_id = ANY(expired_ids);

    -- Die Buchungen selbst löschen. Achtung: löst den AFTER-DELETE-Trigger
    -- aus, der erneut PII-Snapshots in audit_logs schreibt.
    DELETE FROM bookings
    WHERE id = ANY(expired_ids);
    GET DIAGNOSTICS deleted_bookings = ROW_COUNT;

    -- Die vom DELETE-Trigger frisch erzeugten Audit-Snapshots wieder entfernen.
    DELETE FROM audit_logs
    WHERE entity_type = 'bookings'
      AND entity_id = ANY(expired_ids);
  ELSE
    deleted_bookings := 0;
  END IF;

  -- Verwaiste Benachrichtigungs-Logs (Buchung bereits gelöscht), die älter als
  -- die Aufbewahrungsfrist sind, ebenfalls bereinigen.
  DELETE FROM notification_log
  WHERE booking_id IS NULL
    AND created_at < cutoff;

  RAISE NOTICE 'purge_expired_booking_data: % Buchungen (inkl. audit_logs/notification_log) gelöscht, Stichtag %',
    deleted_bookings, cutoff;
END;
$$;

COMMENT ON FUNCTION public.purge_expired_booking_data() IS
  'DSGVO: löscht Buchungen + zugehörige audit_logs- und notification_log-Einträge 14 Tage nach Termin-Ende. Täglich via pg_cron.';

-- ============================================================================
-- Zeitsteuerung (täglich um 03:15 UTC)
-- ============================================================================
-- Vorhandenen Job mit gleichem Namen zuerst entfernen, damit die Migration
-- idempotent ist (erneutes Einspielen erzeugt keine Duplikate).
SELECT cron.unschedule('purge-expired-booking-data')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'purge-expired-booking-data'
);

SELECT cron.schedule(
  'purge-expired-booking-data',
  '15 3 * * *',
  $$ SELECT public.purge_expired_booking_data(); $$
);
