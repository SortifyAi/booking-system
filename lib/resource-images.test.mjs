import assert from 'node:assert/strict'
import { normalizeResourceImageUrl } from './resource-images.mjs'

assert.equal(normalizeResourceImageUrl(' https://example.com/anna.jpg '), 'https://example.com/anna.jpg')
assert.equal(normalizeResourceImageUrl('/team/anna.jpg'), '/team/anna.jpg')
assert.equal(normalizeResourceImageUrl(''), null)
assert.equal(normalizeResourceImageUrl('   '), null)
assert.throws(() => normalizeResourceImageUrl('javascript:alert(1)'), /Bild-URL/)
