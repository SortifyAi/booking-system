# Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO)

> **Hinweis:** Vorlage, keine Rechtsberatung. `[PLATZHALTER]` ausfüllen.
> BookaNord hat eine Doppelrolle: **Verantwortlicher** für die eigenen
> Geschäftsdaten (Verzeichnis nach Art. 30 Abs. 1) und **Auftragsverarbeiter** für
> die Buchungsdaten der Kunden (Verzeichnis nach Art. 30 Abs. 2).

**Stand:** 2026-06-12

## Stammdaten des Verantwortlichen
- Name / Firma: Pascal Raub – Flying Chair AI
- Anschrift: Grüne Str. 70, 27749 Delmenhorst, Deutschland
- Kontakt: info@flyingchair.cloud
- Datenschutzbeauftragter: nicht erforderlich (Einzelunternehmer, < 20 Personen)

---

## Teil A — BookaNord als Verantwortlicher (Art. 30 Abs. 1)

### V1: Kundenkonten / Vertragsverwaltung
- **Zweck:** Bereitstellung und Verwaltung der Plattform-Accounts der Geschäftskunden
- **Betroffene:** Inhaber/Mitarbeiter der nutzenden Betriebe
- **Datenkategorien:** Name, E-Mail, Login-Daten (Passwort-Hash), Organisation
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO (Vertrag)
- **Empfänger:** Supabase, Vercel (siehe Subprozessoren)
- **Löschfrist:** bis Vertragsende + ggf. gesetzliche Aufbewahrung
- **Drittland:** USA (SCC/DPF)

### V2: Support- und Kommunikationsanfragen
- **Zweck:** Bearbeitung von Anfragen/Onboarding
- **Betroffene:** Interessenten, Geschäftskunden
- **Datenkategorien:** Name, E-Mail, Inhalt der Anfrage
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b / lit. f DSGVO
- **Löschfrist:** nach abschließender Bearbeitung, spätestens nach 24 Monaten

### V3: Server-/Zugriffslogs
- **Zweck:** Sicherheit und Stabilität der Anwendung
- **Datenkategorien:** IP-Adresse, Zeitstempel, abgerufene Ressource
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. f DSGVO
- **Löschfrist:** 30 Tage

---

## Teil B — BookaNord als Auftragsverarbeiter (Art. 30 Abs. 2)

### Für jeden Verantwortlichen (nutzenden Betrieb)
- **Auftraggeber (Verantwortlicher):** der jeweilige Betrieb (Organisation)
- **Kategorien der Verarbeitung:** Online-Terminbuchung, Versand von Bestätigungs-
  und Erinnerungs-E-Mails, Verwaltung/Stornierung von Terminen
- **Datenkategorien:** Name, E-Mail, Telefon (optional), Termin- und Leistungsdaten,
  Anmerkungen
- **Betroffene:** Endkunden des Betriebs
- **Empfänger / Unterauftragsverarbeiter:** Supabase, Vercel, Resend
- **Drittlandübermittlung:** USA (SCC/DPF)
- **Löschfristen:** siehe `loeschkonzept.md` (Standard: 14 Tage nach Termin-Ende)
- **TOMs:** siehe `toms.md`

---

## Offene Punkte
- [ ] Bei Wachstum (≥ 20 mit Verarbeitung befasste Personen) DSB-Pflicht neu prüfen
- [ ] Bei neuen Diensten (Analytics, SMS, Zahlung) Verzeichnis ergänzen
