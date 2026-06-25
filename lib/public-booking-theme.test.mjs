import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const settingsPage = readFileSync(resolve(root, 'app/dashboard/settings/page.tsx'), 'utf8')
const bookingPage = readFileSync(resolve(root, 'app/book/[slug]/page.tsx'), 'utf8')

assert.match(settingsPage, /getPublicBookingTheme/)
assert.match(settingsPage, /useState<PublicBookingTheme>\('dark'\)/)
assert.match(settingsPage, /publicBookingTheme:\s*value/)
assert.match(settingsPage, /label: 'Dunkel'/)
assert.match(settingsPage, /label: 'Hell'/)
assert.match(settingsPage, /Nur für die öffentliche Kundenseite/)

assert.match(bookingPage, /getPublicBookingTheme\(org\?\.settings\)/)
assert.match(bookingPage, /setDocumentThemeOverride\(publicBookingTheme\)/)
assert.match(bookingPage, /setDocumentThemeOverride\(null\)/)

console.log('public-booking-theme.test.mjs: all assertions passed')
