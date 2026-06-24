import assert from 'node:assert/strict'
import {
  groupOfferings,
  moveOffering,
  standaloneOfferings,
  validateCompleteGroupOrder,
} from './offering-order.mjs'

const mainA = {
  id: 'main-a',
  available_as_addon: false,
  sort_order: 1,
  created_at: '2026-01-01T00:00:00.000Z',
}
const mainB = {
  id: 'main-b',
  available_as_addon: false,
  sort_order: 2,
  created_at: '2026-01-02T00:00:00.000Z',
}
const addonOnly = {
  id: 'addon-only',
  available_as_addon: true,
  is_standalone_bookable: false,
  sort_order: 1,
  created_at: '2026-01-03T00:00:00.000Z',
}
const addonStandalone = {
  id: 'addon-standalone',
  available_as_addon: true,
  is_standalone_bookable: true,
  sort_order: 2,
  created_at: '2026-01-04T00:00:00.000Z',
}

assert.deepEqual(moveOffering([mainA, mainB], 'main-b', 'main-a').map((item) => item.id), [
  'main-b',
  'main-a',
])
assert.deepEqual(moveOffering([mainA, mainB], 'main-a', 'main-a'), [mainA, mainB])
assert.deepEqual(groupOfferings([addonStandalone, mainB, addonOnly, mainA]), {
  main: [mainA, mainB],
  addon: [addonOnly, addonStandalone],
})
assert.deepEqual(
  standaloneOfferings([addonStandalone, mainB, addonOnly, mainA]).map((item) => item.id),
  ['main-a', 'main-b', 'addon-standalone']
)
assert.equal(validateCompleteGroupOrder(['main-a', 'main-b'], ['main-b', 'main-a']), true)
assert.equal(validateCompleteGroupOrder(['main-a', 'main-b'], ['main-a', 'main-a']), false)
assert.equal(validateCompleteGroupOrder(['main-a', 'main-b'], ['main-a']), false)
