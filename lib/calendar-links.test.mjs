import assert from 'node:assert/strict'
import {
  buildGoogleCalendarUrl,
  buildOutlookCalendarUrl,
  buildIcsContent,
} from './calendar-links.ts'

const event = {
  uid: 'booking-abc@bookanord',
  title: 'Haarschnitt – Salon Müller',
  description: 'Ihr Termin bei Salon Müller.',
  location: 'Salon Müller, Hauptstraße 1, 20095 Hamburg',
  start: '2026-06-20T08:30:00.000Z',
  end: '2026-06-20T09:15:00.000Z',
}

// --- Google ---
const google = buildGoogleCalendarUrl(event)
assert.ok(google.startsWith('https://calendar.google.com/calendar/render?'))
const googleParams = new URL(google).searchParams
assert.equal(googleParams.get('action'), 'TEMPLATE')
assert.equal(googleParams.get('text'), event.title)
assert.equal(googleParams.get('dates'), '20260620T083000Z/20260620T091500Z')
assert.equal(googleParams.get('location'), event.location)

// --- Outlook ---
const outlook = buildOutlookCalendarUrl(event)
assert.ok(outlook.startsWith('https://outlook.live.com/calendar/0/deeplink/compose?'))
const outlookParams = new URL(outlook).searchParams
assert.equal(outlookParams.get('rru'), 'addevent')
assert.equal(outlookParams.get('subject'), event.title)
assert.equal(outlookParams.get('startdt'), '2026-06-20T08:30:00.000Z')
assert.equal(outlookParams.get('enddt'), '2026-06-20T09:15:00.000Z')

// --- ICS ---
const ics = buildIcsContent(event)
assert.ok(ics.includes('BEGIN:VCALENDAR'))
assert.ok(ics.includes('END:VCALENDAR'))
assert.ok(ics.includes('BEGIN:VEVENT'))
assert.ok(ics.includes('UID:booking-abc@bookanord'))
assert.ok(ics.includes('DTSTART:20260620T083000Z'))
assert.ok(ics.includes('DTEND:20260620T091500Z'))
assert.ok(ics.includes('STATUS:CONFIRMED'))
// CRLF line endings are required by RFC 5545.
assert.ok(ics.includes('\r\n'))
// Commas in the location must be escaped.
assert.ok(ics.includes('LOCATION:Salon Müller\\, Hauptstraße 1\\, 20095 Hamburg'))

// --- Escaping of special characters ---
const tricky = buildIcsContent({
  ...event,
  title: 'A; B, C\\D',
})
assert.ok(tricky.includes('SUMMARY:A\\; B\\, C\\\\D'))

console.log('calendar-links: all assertions passed')
