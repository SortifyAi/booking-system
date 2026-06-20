import assert from 'node:assert/strict'
import {
  DEFAULT_REMINDER_TIMEZONE,
  getReminderDayWindow,
  isInReminderTargetDay,
} from './reminders.ts'

const delayedSummerRun = new Date('2026-06-15T08:30:00.000Z')
const summerWindow = getReminderDayWindow(delayedSummerRun, 'Europe/Berlin')

assert.equal(DEFAULT_REMINDER_TIMEZONE, 'Europe/Berlin')
assert.equal(summerWindow.targetDate, '2026-06-15')
assert.equal(summerWindow.startIso, '2026-06-14T22:00:00.000Z')
assert.equal(summerWindow.endIso, '2026-06-15T22:00:00.000Z')
assert.equal(
  isInReminderTargetDay('2026-06-15T06:30:00.000Z', delayedSummerRun, 'Europe/Berlin'),
  true,
  'same-day morning bookings are still eligible when Vercel runs late'
)
assert.equal(
  isInReminderTargetDay('2026-06-16T06:30:00.000Z', delayedSummerRun, 'Europe/Berlin'),
  false,
  'tomorrow bookings are not reminded during today morning run'
)

const delayedWinterRun = new Date('2026-12-15T08:30:00.000Z')
const winterWindow = getReminderDayWindow(delayedWinterRun, 'Europe/Berlin')

assert.equal(winterWindow.targetDate, '2026-12-15')
assert.equal(winterWindow.startIso, '2026-12-14T23:00:00.000Z')
assert.equal(winterWindow.endIso, '2026-12-15T23:00:00.000Z')

const fallbackWindow = getReminderDayWindow(delayedSummerRun, 'Not/AZone')
assert.equal(fallbackWindow.timeZone, DEFAULT_REMINDER_TIMEZONE)
