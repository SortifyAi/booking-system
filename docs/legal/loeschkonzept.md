# Löschkonzept

> **Hinweis:** Vorlage, keine Rechtsberatung. `[PLATZHALTER]` ausfüllen und an die
> tatsächlich umgesetzten Fristen anpassen.

**Verantwortlicher:** Pascal Raub – Flying Chair AI bzw. jeweilige Organisation (für Buchungsdaten)
**Stand:** 2026-06-19
**Bezug:** Art. 5 Abs. 1 lit. c/e, Art. 17 DSGVO

## Grundsatz
Personenbezogene Daten werden nur so lange gespeichert, wie es für den jeweiligen
Zweck erforderlich ist. Die Löschung erfolgt automatisiert direkt in der Datenbank.

## Löschregeln nach Datenkategorie

| Datenkategorie | Speicherort | Frist / Auslöser | Umsetzung |
|---|---|---|---|
| Buchungsdaten (Name, E-Mail, Telefon, Anmerkungen) | `bookings` | 14 Tage nach Termin-Ende (`end_time`) | pg_cron-Job `purge-expired-booking-data` (täglich) |
| Salonweite E-Mail-Sperren | `customer_email_blocks` | bis zur manuellen Aufhebung, Löschanfrage oder Löschung der Organisation | Admin-Verwaltung; Kaskadenlöschung mit der Organisation |
| Benachrichtigungs-Logs (Empfänger-E-Mail/Telefon) | `notification_log` | mit der zugehörigen Buchung; verwaiste Einträge nach 14 Tagen | dieselbe Funktion |
| Audit-Snapshots mit Kundendaten | `audit_logs` | mit der zugehörigen Buchung | dieselbe Funktion; Booking-Audit-Trigger zusätzlich deaktiviert |
| Server-/Zugriffs-Logs | Hosting (Vercel) | 30 Tage | Anbieter-seitige Log-Rotation |
| Backups | Supabase (Free-Plan) | tägliche Backups, 7 Tage Aufbewahrung | reguläre Backup-Rotation |
| Konto-/Stammdaten der Organisationen | `organizations`, `user_organizations` | bis Vertragsende + ggf. gesetzliche Aufbewahrung | manuell / [Prozess PLATZHALTER] |

## Technische Umsetzung
- **Migration** `20260612000000_gdpr_purge_booking_data.sql`: Funktion
  `purge_expired_booking_data()` + täglicher pg_cron-Job (03:15 UTC). Löscht
  Buchungen, zugehörige `notification_log`- und `audit_logs`-Einträge 14 Tage nach
  Termin-Ende.
- **Migration** `20260612010000_disable_bookings_audit_trigger.sql`: deaktiviert den
  Audit-Trigger für `bookings`, damit keine neuen Kundendaten-Snapshots entstehen.
- **Manuelle Prüfung:** `SELECT public.purge_expired_booking_data();`
- **Job-Status:** `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;`

### Salonweite E-Mail-Sperren

`customer_email_blocks` speichert die normalisierte E-Mail-Adresse, den optionalen
Grund, den auslösenden Termin sowie Sperr- und Entsperrzeitpunkte. Zweck ist die
Verhinderung unerwünschter oder missbräuchlicher öffentlicher Online-Buchungen.
Lesen dürfen Mitglieder der jeweiligen Organisation; anlegen und aufheben dürfen
nur Owner und Admins. Der öffentliche Buchungsablauf gibt weder den Eintrag noch
den Sperrgrund an den Kunden aus.

Der reguläre 14-Tage-Löschlauf für Buchungen entfernt aktive Sperren nicht. Wird
der verknüpfte Termin gelöscht, bleibt die Sperre bestehen und nur der optionale
Terminbezug wird durch `ON DELETE SET NULL` entfernt. Bei Löschung der Organisation
werden deren Sperren automatisch mitgelöscht. Aufgehobene Einträge bleiben mit
Zeitstempel zur betrieblichen Nachvollziehbarkeit erhalten, bis sie aufgrund einer
Löschanfrage oder eines festgelegten betrieblichen Löschlaufs entfernt werden.

## Löschung auf Anfrage (Art. 17 DSGVO)
Verlangt eine betroffene Person die Löschung vor Ablauf der 14-Tage-Frist, wird die
betreffende Buchung unverzüglich gelöscht, soweit keine gesetzliche
Aufbewahrungspflicht entgegensteht. Anfragen an: info@flyingchair.cloud
(Bearbeitung durch Pascal Raub).

Eine Löschanfrage umfasst auch Einträge in `customer_email_blocks`. Der zuständige
Salon prüft dabei, ob ein fortbestehender Sperrzweck rechtlich zulässig und
erforderlich ist; andernfalls wird der Eintrag gelöscht. Die Entscheidung und ihre
Begründung werden außerhalb der öffentlich zugänglichen Buchungsdaten dokumentiert.

## Gesetzliche Aufbewahrungspflichten
Bestehen steuer-/handelsrechtliche Aufbewahrungspflichten (z. B. für Rechnungen,
§ 147 AO, § 257 HGB), werden die betroffenen Belege bis zum Ablauf der jeweiligen
Frist aufbewahrt und erst danach gelöscht. In diesem System werden derzeit
**keine** abrechnungsrelevanten Daten (Rechnungen, Zahlungen) gespeichert.

## Offene Punkte
- [ ] Bei Wechsel auf Supabase Pro: Backup-/PITR-Angaben aktualisieren
- [ ] Bei Einführung von Abrechnung/Zahlungen: Aufbewahrungspflichten ergänzen
