import assert from 'node:assert/strict'

async function main() {
  const policy: any = await import('./booking-policy.ts')

  assert.equal(typeof policy.isFutureBookingStart, 'function')
  assert.equal(typeof policy.withPastSlotsUnavailable, 'function')
  assert.equal(typeof policy.isSameOrAfterLocalDay, 'function')

  // Rescheduling defaults to allowed and is only off when explicitly disabled.
  assert.equal(policy.getAllowReschedule(null), true, 'reschedule allowed by default')
  assert.equal(policy.getAllowReschedule({}), true, 'reschedule allowed when unset')
  assert.equal(policy.getAllowReschedule({ allowReschedule: false }), false, 'admin can disable reschedule')
  assert.equal(policy.getAllowReschedule({ allowReschedule: true }), true, 'explicitly enabled stays on')

  assert.equal(policy.getPublicBookingTheme(null), 'dark', 'public booking theme defaults to dark')
  assert.equal(policy.getPublicBookingTheme({}), 'dark', 'unset public booking theme defaults to dark')
  assert.equal(
    policy.getPublicBookingTheme({ publicBookingTheme: 'dark' }),
    'dark',
    'explicit dark public booking theme stays dark'
  )
  assert.equal(
    policy.getPublicBookingTheme({ publicBookingTheme: 'light' }),
    'light',
    'explicit light public booking theme stays light'
  )
  assert.equal(
    policy.getPublicBookingTheme({ publicBookingTheme: 'system' }),
    'dark',
    'unsupported system public booking theme falls back to dark'
  )
  assert.equal(
    policy.getPublicBookingTheme({ publicBookingTheme: 1 }),
    'dark',
    'non-string public booking theme falls back to dark'
  )

  const now = new Date('2026-06-14T10:00:00.000Z')

  assert.equal(
    policy.isFutureBookingStart('2026-06-14T10:30:00.000Z', now),
    true,
    'future appointment starts are bookable'
  )
  assert.equal(
    policy.isFutureBookingStart('2026-06-14T10:00:00.000Z', now),
    false,
    'appointment starts at the current instant are not in the future'
  )
  assert.equal(
    policy.isFutureBookingStart('2026-06-14T09:59:59.999Z', now),
    false,
    'past appointment starts are not bookable'
  )

  assert.deepEqual(
    policy.withPastSlotsUnavailable(
      [
        {
          startTime: '2026-06-14T09:30:00.000Z',
          endTime: '2026-06-14T10:00:00.000Z',
          available: true,
        },
        {
          startTime: '2026-06-14T10:30:00.000Z',
          endTime: '2026-06-14T11:00:00.000Z',
          available: true,
        },
      ],
      now
    ).map((slot: { available: boolean }) => slot.available),
    [false, true],
    'past slots are hidden from booking while future slots stay available'
  )

  assert.equal(
    policy.isSameOrAfterLocalDay(
      new Date(2026, 5, 14, 0, 0),
      new Date(2026, 5, 14, 23, 59)
    ),
    true,
    'same local calendar day is not treated as past just because its time is earlier'
  )
  assert.equal(
    policy.isSameOrAfterLocalDay(
      new Date(2026, 5, 13, 23, 59),
      new Date(2026, 5, 14, 0, 0)
    ),
    false,
    'previous local calendar day is treated as past'
  )

  console.log('booking-policy.test.ts: all assertions passed')
}

main()
