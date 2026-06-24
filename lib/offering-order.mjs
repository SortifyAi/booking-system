export function compareOfferings(first, second) {
  return (
    (first.sort_order ?? Number.MAX_SAFE_INTEGER) -
      (second.sort_order ?? Number.MAX_SAFE_INTEGER) ||
    String(first.created_at ?? '').localeCompare(String(second.created_at ?? '')) ||
    String(first.id).localeCompare(String(second.id))
  )
}

export function moveOffering(items, activeId, overId) {
  const from = items.findIndex((item) => item.id === activeId)
  const to = items.findIndex((item) => item.id === overId)
  if (from < 0 || to < 0 || from === to) return items

  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

export function groupOfferings(items) {
  return {
    main: items.filter((item) => !item.available_as_addon).sort(compareOfferings),
    addon: items.filter((item) => item.available_as_addon).sort(compareOfferings),
  }
}

export function standaloneOfferings(items) {
  const groups = groupOfferings(items)
  return [
    ...groups.main,
    ...groups.addon.filter((item) => item.is_standalone_bookable !== false),
  ]
}

export function validateCompleteGroupOrder(expectedIds, submittedIds) {
  if (expectedIds.length !== submittedIds.length) return false
  if (new Set(submittedIds).size !== submittedIds.length) return false

  const expected = new Set(expectedIds)
  return submittedIds.every((id) => expected.has(id))
}
