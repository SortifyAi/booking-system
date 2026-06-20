import assert from 'node:assert/strict'
import { countNoShowIncidents, publicBookingEmailError } from './customer-email.ts'

assert.equal(
  countNoShowIncidents([
    { id: 'a', group_id: 'group-1' },
    { id: 'b', group_id: 'group-1' },
    { id: 'c', group_id: null },
  ]),
  2
)

assert.deepEqual(publicBookingEmailError('invalid', '+49 40 123'), {
  code: 'EMAIL_INVALID',
  message:
    'Terminbuchung über diese E-Mail-Adresse ist nicht möglich. Bitte prüfen Sie die Adresse oder verwenden Sie eine andere.',
})

const contactWithPhone = publicBookingEmailError('contact', '+49 40 123')
assert.equal(contactWithPhone.code, 'CONTACT_SALON')
assert.equal(contactWithPhone.phone, '+49 40 123')
assert.equal(
  contactWithPhone.message,
  'Online-Terminbuchung ist derzeit nicht möglich. Bitte rufen Sie uns an.'
)
assert.doesNotMatch(contactWithPhone.message, /gesperrt|Sperrliste/i)
assert.match(publicBookingEmailError('contact', null).message, /telefonisch/)

console.log('customer-email.test.mjs: all assertions passed')
