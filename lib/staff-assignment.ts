/**
 * Constrained staff↔position assignment for group bookings.
 *
 * A "position" is one appointment in a parallel group booking. Each needs a
 * distinct staff member who is free for its duration. A position may pin a
 * specific staff member (the customer chose them); the rest are "any".
 *
 * This is a small bipartite matching: positions on one side, staff on the
 * other, an edge where the staff is free for that position's duration (and, for
 * pinned positions, only the chosen staff). We solve it with Kuhn's augmenting
 * path algorithm — N (positions) and the staff count are tiny here, so the
 * simple O(N · E) approach is more than fast enough.
 *
 * Used by the cart/range availability endpoints (feasibility for a candidate
 * start time) and by the group-booking endpoint (the concrete assignment).
 */

export interface AssignmentPosition {
  duration: number
  /** Pinned staff for this position; null/undefined means "any". */
  fixedStaffId?: string | null
}

/**
 * Returns one valid assignment (staffId per position, index-aligned with
 * `positions`) or `null` if no distinct assignment exists.
 *
 * `staffIds` should already be ordered by preference (e.g. least-loaded first)
 * so the matching prefers those staff for the "any" positions.
 */
export function assignStaffToPositions(
  positions: AssignmentPosition[],
  staffIds: string[],
  isFree: (staffId: string, duration: number) => boolean,
): string[] | null {
  // Candidate staff per position, honouring the pin and the free-check.
  const candidates: string[][] = positions.map((pos) => {
    if (pos.fixedStaffId) {
      return isFree(pos.fixedStaffId, pos.duration) ? [pos.fixedStaffId] : []
    }
    return staffIds.filter((id) => isFree(id, pos.duration))
  })

  // Any position with no candidate makes the whole assignment impossible.
  if (candidates.some((c) => c.length === 0)) return null

  // staffId -> index of the position currently matched to it.
  const matchedBy = new Map<string, number>()

  const tryAssign = (posIdx: number, seen: Set<string>): boolean => {
    for (const staffId of candidates[posIdx]) {
      if (seen.has(staffId)) continue
      seen.add(staffId)
      const current = matchedBy.get(staffId)
      if (current === undefined || tryAssign(current, seen)) {
        matchedBy.set(staffId, posIdx)
        return true
      }
    }
    return false
  }

  // Match harder positions (fewest candidates) first to fail fast.
  const order = positions
    .map((_, idx) => idx)
    .sort((a, b) => candidates[a].length - candidates[b].length)

  for (const posIdx of order) {
    if (!tryAssign(posIdx, new Set<string>())) return null
  }

  const assignment: string[] = new Array(positions.length)
  for (const [staffId, posIdx] of matchedBy) assignment[posIdx] = staffId
  return assignment
}
