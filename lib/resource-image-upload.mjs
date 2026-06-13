export const RESOURCE_IMAGE_BUCKET = 'resource-images'

export const RESOURCE_IMAGE_MAX_SIZE = 512
export const RESOURCE_IMAGE_QUALITY = 0.82
export const RESOURCE_IMAGE_CONTENT_TYPE = 'image/webp'

const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function isAcceptedResourceImageType(type) {
  return ACCEPTED_IMAGE_TYPES.has(type)
}

function slugifyFileName(fileName) {
  const baseName = String(fileName || 'mitarbeiter')
    .replace(/\.[^.]+$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return baseName || 'mitarbeiter'
}

export function getResourceImageUploadPath({
  organizationId,
  resourceId,
  fileName,
  version = Date.now(),
}) {
  return `${organizationId}/${resourceId}/${version}-${slugifyFileName(fileName)}.webp`
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Bild konnte nicht geladen werden'))
    }
    image.src = url
  })
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Bild konnte nicht komprimiert werden'))
          return
        }
        resolve(blob)
      },
      type,
      quality
    )
  })
}

export async function compressResourceImage(
  file,
  {
    maxSize = RESOURCE_IMAGE_MAX_SIZE,
    quality = RESOURCE_IMAGE_QUALITY,
  } = {}
) {
  if (!isAcceptedResourceImageType(file.type)) {
    throw new Error('Bitte JPEG, PNG oder WebP hochladen')
  }

  const image = await readImage(file)
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Bild konnte nicht verarbeitet werden')
  }

  context.drawImage(image, 0, 0, width, height)
  const blob = await canvasToBlob(canvas, RESOURCE_IMAGE_CONTENT_TYPE, quality)

  return new File([blob], `${slugifyFileName(file.name)}.webp`, {
    type: RESOURCE_IMAGE_CONTENT_TYPE,
    lastModified: Date.now(),
  })
}

export async function uploadCompressedResourceImage({
  supabase,
  file,
  organizationId,
  resourceId,
}) {
  const compressedFile = await compressResourceImage(file)
  const path = getResourceImageUploadPath({
    organizationId,
    resourceId,
    fileName: compressedFile.name,
  })

  const { error } = await supabase.storage
    .from(RESOURCE_IMAGE_BUCKET)
    .upload(path, compressedFile, {
      cacheControl: '31536000',
      contentType: compressedFile.type,
    })

  if (error) {
    throw new Error(error.message || 'Bild konnte nicht hochgeladen werden')
  }

  const { data } = supabase.storage.from(RESOURCE_IMAGE_BUCKET).getPublicUrl(path)
  return data.publicUrl
}
