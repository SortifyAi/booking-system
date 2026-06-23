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
assert.match(page, /flex-col gap-3 sm:flex-row sm:items-center sm:justify-between/, 'mobile service rows should stack content and actions')
assert.match(page, /h-10 self-end px-3\.5 text-sm sm:h-11 sm:px-4/, 'mobile add buttons should be compact')
assert.match(page, /h-11 min-w-\[132px\] px-4 text-sm sm:h-12 sm:min-w-\[150px\] sm:text-base/, 'mobile cart CTA should be smaller than desktop')
assert.match(page, /border-b border-slate-200\/70 px-4 py-3 dark:border-slate-800/, 'expanded cart should have a clean bottom-sheet divider')
assert.match(page, /text-xl font-bold text-slate-950 dark:text-white sm:text-2xl/, 'mobile cart total should not crowd the CTA')
assert.match(footer, /dark:brightness-0 dark:invert/, 'footer logo should invert in dark mode')
assert.match(button, /shadow-blue-600\/20/, 'primary buttons should have subtle depth')
assert.match(button, /active:scale-\[0\.98\]/, 'buttons should have a tactile active state')
