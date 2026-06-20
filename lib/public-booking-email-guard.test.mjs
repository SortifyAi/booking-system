import assert from 'node:assert/strict'
import { guardPublicBookingEmail } from './public-booking-email-guard.ts'

const base = {
  email: '  Max@Example.DE ',
  organizationId: 'org-1',
  locationPhone: '+49 40 123',
}

const invalid = await guardPublicBookingEmail(base, {
  validateDomain: async () => ({ status: 'invalid', domain: 'example.de' }),
  hasActiveBlock: async () => false,
})
assert.equal(invalid.ok, false)
assert.equal(invalid.body.code, 'EMAIL_INVALID')

const temporary = await guardPublicBookingEmail(base, {
  validateDomain: async () => ({ status: 'temporary_failure', domain: 'example.de' }),
  hasActiveBlock: async () => false,
})
assert.equal(temporary.ok, false)
assert.equal(temporary.body.code, 'CONTACT_SALON')
assert.equal(temporary.status, 503)

const domainFailure = await guardPublicBookingEmail(base, {
  validateDomain: async () => { throw new Error('resolver crashed') },
  hasActiveBlock: async () => false,
  logError: () => {},
})
assert.equal(domainFailure.ok, false)
assert.equal(domainFailure.body.code, 'CONTACT_SALON')

const blocked = await guardPublicBookingEmail(base, {
  validateDomain: async () => ({ status: 'valid', domain: 'example.de' }),
  hasActiveBlock: async (_org, email) => email === 'max@example.de',
})
assert.equal(blocked.ok, false)
assert.equal(blocked.body.code, 'CONTACT_SALON')
assert.equal(blocked.status, 503)

const allowed = await guardPublicBookingEmail(base, {
  validateDomain: async () => ({ status: 'valid', domain: 'example.de' }),
  hasActiveBlock: async () => false,
})
assert.deepEqual(allowed, { ok: true, normalizedEmail: 'max@example.de' })

console.log('public-booking-email-guard.test.mjs: all assertions passed')
