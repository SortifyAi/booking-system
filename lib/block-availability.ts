// Reine Overlap-Logik für Blocks (Abwesenheiten: Urlaub, Krankheit, Pause …),
// geteilt von Verfügbarkeits- und Buchungs-Validierung. Hier zentral, weil ein
// subtiler Fehler hier zu Doppelbuchungen über Abwesenheiten hinweg führt.

export interface BlockInterval {
  start_time: string
  end_time: string
  resource_id?: string | null
}

/**
 * Überlappt ein Block das Tages-/Abfragefenster [rangeStart, rangeEnd]?
 *
 * Dies spiegelt den Supabase-Filter wider, mit dem Blocks für einen Tag geladen
 * werden. Es MUSS ein Overlap-Test sein, kein Containment-Test: Ein mehrtägiger
 * Block (z. B. ein Urlaub über mehrere Tage) startet vor und endet nach einem
 * Tag in der Mitte des Zeitraums und würde von einem Containment-Filter still
 * verworfen — wodurch Buchungen trotz Abwesenheit durchrutschen.
 */
export function blockOverlapsRange(
  block: BlockInterval,
  rangeStart: Date,
  rangeEnd: Date,
): boolean {
  return (
    new Date(block.start_time) <= rangeEnd &&
    new Date(block.end_time) >= rangeStart
  )
}

/**
 * Macht ein Block den Slot [slotStart, slotEnd] für einen Mitarbeiter unfrei?
 *
 * Ein Block greift, wenn er global ist (kein resource_id) oder genau diesen
 * Mitarbeiter betrifft, und sein Intervall den Slot echt überlappt. Sich nur
 * berührende Kanten (slotEnd === blockStart) zählen nicht als Konflikt.
 *
 * staffId = undefined behandelt jeden Block als global (genutzt von der
 * einfachen Verfügbarkeits-Route, die Blocks nicht je Mitarbeiter auflöst).
 */
export function blockBlocksSlot(
  block: BlockInterval,
  slotStart: Date,
  slotEnd: Date,
  staffId?: string,
): boolean {
  const appliesToStaff = !block.resource_id || block.resource_id === staffId
  if (!appliesToStaff) return false
  return (
    slotStart < new Date(block.end_time) &&
    slotEnd > new Date(block.start_time)
  )
}
