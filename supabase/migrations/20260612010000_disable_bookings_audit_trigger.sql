-- DSGVO: Audit-Logging für Buchungen abschalten.
--
-- Der Trigger `audit_bookings` schrieb bei jedem INSERT/UPDATE/DELETE einer
-- Buchung row_to_json(...) der GANZEN Zeile nach audit_logs.changes — also
-- vollständige Kundendaten (customer_name/_email/_phone, notes). Diese Daten
-- werden von der App nirgends gelesen (reiner Schreib-Ballast) und duplizieren
-- genau die personenbezogenen Daten, die laut DSGVO nach kurzer Frist gelöscht
-- werden müssen. Wir schalten das Booking-Audit daher ab.
--
-- Die Funktion create_audit_log() und die Trigger für locations/offerings/
-- resources bleiben erhalten (diese loggen nur Konfigurationsdaten, KEINE
-- Kundendaten). Das Booking-Audit lässt sich jederzeit wieder aktivieren:
--
--   CREATE TRIGGER audit_bookings
--   AFTER INSERT OR UPDATE OR DELETE ON bookings
--   FOR EACH ROW EXECUTE FUNCTION create_audit_log();
--
-- !!! WICHTIG FÜR DEN NÄCHSTEN, DER DAS WIEDER ANSCHALTET !!!
-- create_audit_log() speichert per row_to_json den KOMPLETTEN Datensatz. Wenn
-- der Booking-Audit reaktiviert wird, MÜSSEN die Kundenfelder (customer_name,
-- customer_email, customer_phone, notes, metadata) vorher aus dem Snapshot
-- entfernt/maskiert werden, sonst landen personenbezogene Daten wieder im Log
-- und die DSGVO-Löschung (siehe purge_expired_booking_data) ist ausgehebelt.

DROP TRIGGER IF EXISTS audit_bookings ON bookings;

-- Warnhinweis dauerhaft in der DB hinterlegen (sichtbar u. a. im Supabase
-- Table Editor und in \d-Ausgaben), damit er nicht in dieser Migrationsdatei
-- vergraben bleibt.
COMMENT ON TABLE audit_logs IS
  'DSGVO-Hinweis: Hier dürfen KEINE Kundendaten (customer_name/_email/_phone, '
  'notes) landen. Das Booking-Audit ist deshalb abgeschaltet '
  '(Migration 20260612010000). Vor einer Reaktivierung Kundenfelder aus dem '
  'Snapshot entfernen/maskieren.';

COMMENT ON FUNCTION create_audit_log() IS
  'DSGVO-Hinweis: speichert per row_to_json den KOMPLETTEN Datensatz. Für '
  'Tabellen mit Kundendaten (z. B. bookings) NICHT ungefiltert verwenden — '
  'sonst landen personenbezogene Daten im Log. Siehe Migration 20260612010000.';
