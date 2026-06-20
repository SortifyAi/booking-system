export type NoShowRow = {
  id: string
  group_id?: string | null
}

export function countNoShowIncidents(rows: NoShowRow[]): number {
  return new Set(rows.map((row) => row.group_id || row.id)).size
}

export function publicBookingEmailError(
  kind: 'invalid' | 'contact',
  phone?: string | null
) {
  if (kind === 'invalid') {
    return {
      code: 'EMAIL_INVALID' as const,
      message:
        'Terminbuchung über diese E-Mail-Adresse ist nicht möglich. Bitte prüfen Sie die Adresse oder verwenden Sie eine andere.',
    }
  }

  const cleanPhone = phone?.trim()
  return {
    code: 'CONTACT_SALON' as const,
    message: cleanPhone
      ? 'Online-Terminbuchung ist derzeit nicht möglich. Bitte rufen Sie uns an.'
      : 'Online-Terminbuchung ist derzeit nicht möglich. Bitte kontaktieren Sie den Salon telefonisch.',
    phone: cleanPhone || null,
  }
}
