import assert from 'node:assert/strict'
import { normalizeEmail, validateEmailDomain } from './email-domain.ts'

const dnsError = (code) => Object.assign(new Error(code), { code })

const resolver = (mx, ipv4 = dnsError('ENODATA'), ipv6 = dnsError('ENODATA')) => ({
  resolveMx: async () => {
    if (mx instanceof Error) throw mx
    return mx
  },
  resolve4: async () => {
    if (ipv4 instanceof Error) throw ipv4
    return ipv4
  },
  resolve6: async () => {
    if (ipv6 instanceof Error) throw ipv6
    return ipv6
  },
})

assert.equal(normalizeEmail('  Max@Example.DE '), 'max@example.de')

assert.deepEqual(
  await validateEmailDomain('a@example.de', {
    resolver: resolver([{ exchange: 'mx.example.de', priority: 10 }]),
  }),
  { status: 'valid', domain: 'example.de' }
)

assert.equal(
  (await validateEmailDomain('a@example.de', {
    resolver: resolver([{ exchange: '.', priority: 0 }], ['203.0.113.1']),
  })).status,
  'invalid'
)

assert.equal(
  (await validateEmailDomain('a@example.de', {
    resolver: resolver(dnsError('ENODATA'), ['203.0.113.1']),
  })).status,
  'valid'
)

assert.equal(
  (await validateEmailDomain('a@missing.invalid', {
    resolver: resolver(dnsError('ENOTFOUND')),
  })).status,
  'invalid'
)

assert.equal(
  (await validateEmailDomain('a@example.de', {
    resolver: resolver(dnsError('ESERVFAIL')),
  })).status,
  'temporary_failure'
)

assert.equal((await validateEmailDomain('not-an-email')).status, 'invalid')

console.log('email-domain.test.mjs: all assertions passed')
