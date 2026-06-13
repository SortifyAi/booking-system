# Technische und organisatorische Maßnahmen (TOMs)

> **Hinweis:** Vorlage, keine Rechtsberatung. Vor produktivem Einsatz prüfen und an
> die tatsächlich umgesetzten Maßnahmen anpassen. `[PLATZHALTER]` ausfüllen.

**Verantwortlicher (Auftragsverarbeiter):** Pascal Raub – Flying Chair AI, Grüne Str. 70, 27749 Delmenhorst
**Stand:** 2026-06-12
**Bezug:** Art. 32 DSGVO, Anlage 1 zum Auftragsverarbeitungsvertrag

---

## 1. Vertraulichkeit (Art. 32 Abs. 1 lit. b DSGVO)

### 1.1 Zutrittskontrolle (physisch)
- Datenbank- und Anwendungsbetrieb erfolgt ausschließlich bei zertifizierten
  Cloud-Anbietern (Supabase, Vercel). Physische Sicherheit der Rechenzentren wird
  durch deren Zertifizierungen (u. a. ISO 27001, SOC 2) gewährleistet.
- Kein eigener Serverbetrieb / keine eigene Hardware mit personenbezogenen Daten.

### 1.2 Zugangskontrolle (Systeme)
- Authentifizierung am Dashboard über E-Mail/Passwort; Passwörter werden nur als
  Hash gespeichert (Supabase Auth, bcrypt/argon2).
- Zugriff auf Produktivinfrastruktur (Supabase, Vercel) nur für berechtigte Personen
  mit individuellen Accounts und starken Passwörtern.
- 2-Faktor-Authentifizierung für Admin-Zugänge ist derzeit **nicht aktiviert**
  (geplante Verbesserung, siehe offene Punkte).
- Keine geteilten Administrationskonten.

### 1.3 Zugriffskontrolle (Berechtigungen)
- Rollen-/Rechtekonzept: Nutzer sehen nur Daten ihrer eigenen Organisation
  (Mandantentrennung über `organization_id` und Row-Level-Security-Policies).
- Datenbankzugriff der Anwendung über dedizierte Service-Rollen mit minimalen
  Rechten (Least Privilege).

### 1.4 Trennungskontrolle
- Mandantenfähige Datenhaltung: logische Trennung der Organisationen in derselben
  Datenbank über Fremdschlüssel und RLS.
- Trennung von Entwicklungs-/Test- und Produktivumgebung.

### 1.5 Pseudonymisierung / Datenminimierung
- Es werden nur die für die Buchung erforderlichen Daten erhoben (Name, E-Mail;
  Telefon/Anmerkungen optional).
- Audit-Protokollierung von Kundendaten ist deaktiviert (siehe Löschkonzept).

## 2. Integrität (Art. 32 Abs. 1 lit. b DSGVO)

### 2.1 Weitergabekontrolle (Transport)
- Sämtliche Datenübertragung erfolgt verschlüsselt über HTTPS/TLS.
- E-Mail-Versand über Resend (TLS-Transport).

### 2.2 Eingabekontrolle
- Änderungen an Konfigurationsdaten (Standorte, Leistungen, Ressourcen) werden
  protokolliert (Audit-Log, ohne Kundendaten).
- Validierung von Eingaben auf Server- und Datenbankebene (u. a.
  Constraints, Schema-Validierung).

## 3. Verfügbarkeit und Belastbarkeit (Art. 32 Abs. 1 lit. b/c DSGVO)

- Regelmäßige automatische Backups der Datenbank durch Supabase (Free-Plan:
  tägliche Backups mit 7 Tagen Aufbewahrung).
- Hosting bei hochverfügbaren Cloud-Anbietern mit Redundanz.
- Schutz vor Datenverlust durch Datenbank-Constraints (u. a. Verhinderung von
  Doppelbuchungen auf DB-Ebene).

## 4. Verfahren zur regelmäßigen Überprüfung (Art. 32 Abs. 1 lit. d DSGVO)

- Datenschutz-Management: jährliche Überprüfung dieser Maßnahmen.
- Auftragskontrolle: Einsatz von Unterauftragsverarbeitern nur mit AVV
  (siehe `subprozessoren.md`).
- Incident-Response: definierter Prozess zur Meldung von Datenschutzverletzungen
  innerhalb von 72 Stunden (Art. 33 DSGVO).

---

## Offene Punkte / Empfehlungen
- [ ] **2-Faktor-Authentifizierung** für Supabase- und Vercel-Admin-Zugänge aktivieren
      (derzeit nicht aktiv – empfohlene Sicherheitsmaßnahme)
- [ ] Bei Wechsel auf Supabase Pro: Point-in-Time-Recovery / längere Backup-Aufbewahrung dokumentieren
- [ ] Datenschutzvorfälle: Kontakt ist Pascal Raub (info@flyingchair.cloud) – Prozess bei Bedarf verfeinern
