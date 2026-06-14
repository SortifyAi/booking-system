import assert from 'node:assert/strict'
import {
  OFFERING_IMAGE_BUCKET,
  RESOURCE_IMAGE_BUCKET,
  getOfferingImageUploadPath,
  getResourceImageUploadPath,
  isAcceptedResourceImageType,
} from './resource-image-upload.mjs'

assert.equal(RESOURCE_IMAGE_BUCKET, 'resource-images')
assert.equal(OFFERING_IMAGE_BUCKET, 'offering-images')
assert.equal(
  getResourceImageUploadPath({
    organizationId: 'org-1',
    resourceId: 'res-anna',
    fileName: 'Anna Weber.png',
    version: 'v1',
  }),
  'org-1/res-anna/v1-anna-weber.webp'
)
assert.equal(
  getOfferingImageUploadPath({
    organizationId: 'org-1',
    offeringId: 'off-cut',
    fileName: 'Haarschnitt Premium.png',
    version: 'v2',
  }),
  'org-1/off-cut/v2-haarschnitt-premium.webp'
)
assert.equal(isAcceptedResourceImageType('image/jpeg'), true)
assert.equal(isAcceptedResourceImageType('image/png'), true)
assert.equal(isAcceptedResourceImageType('image/webp'), true)
assert.equal(isAcceptedResourceImageType('image/gif'), false)
