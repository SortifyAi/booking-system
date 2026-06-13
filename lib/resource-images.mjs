export function normalizeResourceImageUrl(value) {
  if (value === null || value === undefined) return null

  const trimmed = String(value).trim()
  if (!trimmed) return null

  if (trimmed.startsWith('/')) return trimmed

  try {
    const url = new URL(trimmed)
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString()
  } catch {
    // Fall through to the shared validation error below.
  }

  throw new Error('Bild-URL muss mit http://, https:// oder / beginnen')
}
