import { NextRequest, NextResponse } from 'next/server'
import { fetchHolidays } from '@/lib/holidays'

/**
 * GET /api/holidays?land=BY&year=2026
 *
 * Server-side proxy for feiertage-api.de used by the location form's holiday
 * preview. Going through our own route avoids browser CORS concerns and reuses
 * the in-memory cache in lib/holidays. Returns the year's holidays sorted by
 * date; an unreachable upstream yields an empty list rather than an error.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const land = searchParams.get('land') || ''
  const year = Number(searchParams.get('year')) || new Date().getFullYear()

  const map = await fetchHolidays(land, year)
  const holidays = Array.from(map.entries())
    .map(([date, name]) => ({ date, name }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({ holidays })
}
