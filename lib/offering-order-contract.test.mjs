import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(
  'supabase/migrations/20260624010000_offering_ordering.sql',
  'utf8'
)

assert.match(migration, /add column if not exists sort_order integer/)
assert.match(
  migration,
  /add column if not exists is_standalone_bookable boolean not null default true/
)
assert.match(migration, /row_number\(\) over/)
assert.match(migration, /create or replace function public\.reorder_offerings/)
assert.match(migration, /security invoker/)
assert.match(migration, /revoke all on function public\.reorder_offerings/)
assert.match(migration, /grant execute on function public\.reorder_offerings/)

const reorderRoute = readFileSync('app/api/offerings/reorder/route.ts', 'utf8')
assert.match(reorderRoute, /getUser/)
assert.match(reorderRoute, /ReorderOfferingsSchema\.safeParse/)
assert.match(reorderRoute, /\.rpc\('reorder_offerings'/)
assert.match(reorderRoute, /p_location_id/)
assert.match(reorderRoute, /p_available_as_addon/)
assert.match(reorderRoute, /p_offering_ids/)

const offeringsRoute = readFileSync('app/api/offerings/route.ts', 'utf8')
const offeringRoute = readFileSync('app/api/offerings/[id]/route.ts', 'utf8')
const publicOfferingsRoute = readFileSync('app/api/public/offerings/route.ts', 'utf8')

assert.match(offeringsRoute, /isStandaloneBookable/)
assert.match(offeringsRoute, /is_standalone_bookable/)
assert.match(offeringsRoute, /sort_order/)
assert.match(offeringsRoute, /\.eq\('available_as_addon'/)
assert.match(offeringsRoute, /\.order\('available_as_addon', \{ ascending: true \}\)/)
assert.match(offeringsRoute, /\.order\('sort_order', \{ ascending: true \}\)/)
assert.match(offeringRoute, /isStandaloneBookable/)
assert.match(offeringRoute, /is_standalone_bookable/)
assert.match(offeringRoute, /available_as_addon/)
assert.match(offeringRoute, /sort_order/)
assert.match(publicOfferingsRoute, /is_standalone_bookable/)
assert.match(publicOfferingsRoute, /sort_order/)
assert.match(
  publicOfferingsRoute,
  /\.order\('available_as_addon', \{ ascending: true \}\)/
)
assert.match(publicOfferingsRoute, /\.order\('sort_order', \{ ascending: true \}\)/)

const servicesPage = readFileSync('app/dashboard/services/page.tsx', 'utf8')
const sortableCard = readFileSync('components/SortableOfferingCard.tsx', 'utf8')

assert.match(servicesPage, /DndContext/)
assert.match(servicesPage, /SortableContext/)
assert.match(servicesPage, /PointerSensor/)
assert.match(servicesPage, /KeyboardSensor/)
assert.match(servicesPage, /sortableKeyboardCoordinates/)
assert.match(servicesPage, /\/api\/offerings\/reorder/)
assert.match(servicesPage, /setServices\(previousServices\)/)
assert.match(servicesPage, /aria-live="polite"/)
assert.match(servicesPage, /Hauptleistungen/)
assert.match(servicesPage, /Zusatzleistungen/)
assert.match(sortableCard, /useSortable/)
assert.match(sortableCard, /Reihenfolge von .* ändern/)
assert.match(sortableCard, /nach oben verschieben/)
assert.match(sortableCard, /nach unten verschieben/)
