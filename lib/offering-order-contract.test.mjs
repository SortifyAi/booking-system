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
