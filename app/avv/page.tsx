import type { Metadata } from 'next'
import { CURRENT_AVV_VERSION } from '@/lib/booking-policy'

export const metadata: Metadata = {
  title: 'Auftragsverarbeitungsvertrag (AVV) – BookaNord',
  description: 'Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO zwischen dem Kunden (Verantwortlicher) und BookaNord (Auftragsverarbeiter).',
}

// ---------------------------------------------------------------------------
// HINWEIS: Sorgfältig vorbereitete VORLAGE, KEINE Rechtsberatung. Vor dem
// produktiven Einsatz juristisch prüfen lassen. Alle [PLATZHALTER] mit den
// echten Angaben von BookaNord füllen.
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-6 text-gray-700 dark:text-gray-300">{children}</div>
    </section>
  )
}

export default function AvvPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
        Auftragsverarbeitungsvertrag (AVV)
      </h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        Vereinbarung zur Auftragsverarbeitung gemäß Art. 28 DSGVO · Version {CURRENT_AVV_VERSION}
      </p>

      <p className="mt-6 text-sm leading-6 text-gray-700 dark:text-gray-300">
        Dieser Vertrag wird geschlossen zwischen dem die BookaNord-Plattform nutzenden Kunden
        (nachfolgend <strong>„Verantwortlicher"</strong>) und
      </p>
      <p className="mt-2 rounded-lg bg-gray-50 p-4 text-sm dark:bg-slate-800/60">
        Pascal Raub – Flying Chair AI
        <br />
        Grüne Str. 70
        <br />
        27749 Delmenhorst, Deutschland
        <br />
        E-Mail: info@flyingchair.cloud
      </p>
      <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">
        (nachfolgend <strong>„Auftragsverarbeiter"</strong>). Er konkretisiert die
        datenschutzrechtlichen Pflichten der Parteien für die im Rahmen der Nutzung der
        BookaNord-Plattform durchgeführte Verarbeitung personenbezogener Daten.
      </p>

      <Section title="1. Gegenstand und Dauer des Auftrags">
        <p>
          Gegenstand des Auftrags ist die Verarbeitung personenbezogener Daten durch den
          Auftragsverarbeiter im Rahmen der Bereitstellung der BookaNord-Buchungsplattform
          (Online-Terminbuchung, Bestätigungs- und Erinnerungs-E-Mails, Verwaltung der Buchungen).
          Die Dauer des Auftrags entspricht der Laufzeit des Nutzungsvertrags über die Plattform.
        </p>
      </Section>

      <Section title="2. Art, Zweck und Umfang der Verarbeitung">
        <p>
          Die Verarbeitung erfolgt ausschließlich zur Erbringung der vertraglich vereinbarten
          Leistungen und nach dokumentierter Weisung des Verantwortlichen. Eine Verarbeitung zu
          eigenen Zwecken des Auftragsverarbeiters findet nicht statt.
        </p>
      </Section>

      <Section title="3. Art der Daten und Kategorien betroffener Personen">
        <p>Folgende Datenarten werden verarbeitet:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Stammdaten der Endkunden: Name, E-Mail-Adresse, Telefonnummer (optional)</li>
          <li>Termindaten: Datum, Uhrzeit, gebuchte Leistung, Anmerkungen</li>
          <li>Kommunikationsdaten: versandte Bestätigungs- und Erinnerungsnachrichten</li>
        </ul>
        <p>Kategorien betroffener Personen: Endkunden des Verantwortlichen (Buchende).</p>
      </Section>

      <Section title="4. Pflichten des Auftragsverarbeiters">
        <ul className="list-disc space-y-2 pl-5">
          <li>Verarbeitung personenbezogener Daten ausschließlich nach Weisung des Verantwortlichen (Art. 28 Abs. 3 lit. a DSGVO).</li>
          <li>Verpflichtung der zur Verarbeitung befugten Personen auf Vertraulichkeit (Art. 28 Abs. 3 lit. b, Art. 29 DSGVO).</li>
          <li>Umsetzung der technischen und organisatorischen Maßnahmen nach Art. 32 DSGVO (siehe Anlage 1 / TOMs).</li>
          <li>Unterstützung des Verantwortlichen bei der Beantwortung von Betroffenenanfragen (Art. 12–23 DSGVO).</li>
          <li>Unterstützung bei der Einhaltung der Pflichten aus Art. 32–36 DSGVO (Sicherheit, Meldung von Datenschutzverletzungen, Datenschutz-Folgenabschätzung).</li>
          <li>Unverzügliche Meldung von Verletzungen des Schutzes personenbezogener Daten an den Verantwortlichen.</li>
          <li>Nach Wahl des Verantwortlichen Löschung oder Rückgabe der Daten nach Beendigung des Auftrags (siehe Ziffer 8).</li>
          <li>Nachweis der Einhaltung der Pflichten und Ermöglichung von Überprüfungen (Art. 28 Abs. 3 lit. h DSGVO).</li>
        </ul>
      </Section>

      <Section title="5. Technische und organisatorische Maßnahmen (TOMs)">
        <p>
          Der Auftragsverarbeiter trifft die in <strong>Anlage 1 (TOMs)</strong> beschriebenen
          technischen und organisatorischen Maßnahmen gemäß Art. 32 DSGVO. Dazu gehören u. a.
          Transportverschlüsselung (HTTPS/TLS), Verschlüsselung gespeicherter Daten, ein
          Rollen- und Berechtigungskonzept, sichere Authentifizierung sowie regelmäßige Backups.
        </p>
      </Section>

      <Section title="6. Unterauftragsverarbeiter">
        <p>
          Der Verantwortliche stimmt dem Einsatz der in <strong>Anlage 2 (Unterauftragsverarbeiter)</strong>
          genannten Subunternehmer zu. Der Auftragsverarbeiter informiert über beabsichtigte
          Änderungen (Hinzufügung/Ersetzung) und räumt dem Verantwortlichen ein Widerspruchsrecht
          ein. Mit jedem Unterauftragsverarbeiter bestehen Verträge mit Datenschutzpflichten, die
          denen dieses Vertrags entsprechen. Aktuell eingesetzt:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Supabase (Datenbank-/Backend-Hosting)</li>
          <li>Vercel (Anwendungs-Hosting)</li>
          <li>Resend (E-Mail-Versand)</li>
        </ul>
        <p>Die jeweils aktuelle Liste ist unter https://bookanord.de/subunternehmer abrufbar.</p>
      </Section>

      <Section title="7. Drittlandtransfer">
        <p>
          Soweit Daten außerhalb der EU/des EWR verarbeitet werden, stellt der Auftragsverarbeiter
          geeignete Garantien nach Art. 44 ff. DSGVO sicher (insbesondere EU-Standardvertragsklauseln
          und/oder Zertifizierung nach dem EU-US Data Privacy Framework).
        </p>
      </Section>

      <Section title="8. Löschung und Rückgabe von Daten">
        <p>
          Buchungsdaten der Endkunden werden gemäß dem Löschkonzept des Verantwortlichen automatisiert
          gelöscht – standardmäßig spätestens 14 Tage nach dem jeweiligen Termin. Nach Beendigung des
          Auftrags werden alle personenbezogenen Daten nach Wahl des Verantwortlichen gelöscht oder
          zurückgegeben, soweit keine gesetzliche Aufbewahrungspflicht entgegensteht.
        </p>
      </Section>

      <Section title="9. Kontroll- und Auskunftsrechte">
        <p>
          Der Verantwortliche hat das Recht, sich von der Einhaltung der vereinbarten Maßnahmen zu
          überzeugen. Der Auftragsverarbeiter stellt die hierfür erforderlichen Informationen bereit
          und ermöglicht Überprüfungen in angemessenem Umfang.
        </p>
      </Section>

      <Section title="10. Haftung und Schlussbestimmungen">
        <p>
          Für die Haftung gelten die Regelungen des Art. 82 DSGVO sowie die Bestimmungen des
          zugrunde liegenden Hauptvertrags. Änderungen bedürfen der Textform. Sollte eine Bestimmung
          unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt. Es gilt das
          Recht der Bundesrepublik Deutschland.
        </p>
      </Section>

      <Section title="Anlagen">
        <ul className="list-disc space-y-1 pl-5">
          <li>Anlage 1: Technische und organisatorische Maßnahmen (TOMs)</li>
          <li>Anlage 2: Liste der Unterauftragsverarbeiter</li>
        </ul>
      </Section>

      <p className="mt-10 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
        Hinweis: Diese Fassung ist eine Vorlage und ersetzt keine Rechtsberatung. Die Annahme erfolgt
        über das BookaNord-Dashboard (Einstellungen); der Zeitpunkt der Zustimmung wird dort
        protokolliert.
      </p>
    </main>
  )
}
