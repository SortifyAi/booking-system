import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const page = readFileSync(resolve(root, 'app/book/[slug]/page.tsx'), 'utf8')
const footer = readFileSync(resolve(root, 'components/PublicBookingLegal.tsx'), 'utf8')
const button = readFileSync(resolve(root, 'components/ui/button.tsx'), 'utf8')

assert.match(page, /dark:from-slate-950/, 'booking page should use the deeper clean dark background')
assert.match(page, /rounded-2xl border border-slate-200\/80 bg-white\/95/, 'wizard cards should use the clean app surface')
assert.match(page, /shadow-\[0_24px_80px_-40px_rgba\(15,23,42,0\.55\)\]/, 'wizard cards should use the new soft app shadow')
assert.match(page, /shadow-\[inset_0_0_0_1px_rgba\(37,99,235,0\.28\)\]/, 'selected services should have an inset blue active ring')
assert.match(page, /shadow-\[0_-18px_50px_-28px_rgba\(15,23,42,0\.65\)\]/, 'sticky cart bar should read as a bottom action bar')
assert.match(footer, /dark:brightness-0 dark:invert/, 'footer logo should invert in dark mode')
assert.match(button, /shadow-blue-600\/20/, 'primary buttons should have subtle depth')
assert.match(button, /active:scale-\[0\.98\]/, 'buttons should have a tactile active state')
