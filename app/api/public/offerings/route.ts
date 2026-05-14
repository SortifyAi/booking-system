// @ts-check
/**
 * Public API for offerings (services)
 * Returns active services that customers can book
 * No authentication required
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * GET /api/public/offerings
 * Returns active offerings, optionally filtered by location
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const locationId = searchParams.get('location_id')
    const isMock = process.env.NEXT_PUBLIC_MOCK_MODE === 'true'

    // Mock data for development
    if (isMock) {
      const mockOfferings = [
        { id: '1', name: 'Haarschnitt', description: 'Waschen, Schneiden, Föhnen', duration_minutes: 45, price_cents: 3500, color: '#3B82F6', location_id: 'loc-berlin', is_active: true },
        { id: '2', name: 'Farbe', description: 'Haare färben mit professionellen Produkten', duration_minutes: 120, price_cents: 8000, color: '#8B5CF6', location_id: 'loc-berlin', is_active: true },
        { id: '3', name: 'Strähnen', description: 'Strähnen und Highlights', duration_minutes: 150, price_cents: 12000, color: '#EC4899', location_id: 'loc-berlin', is_active: true },
        { id: '4', name: 'Bartrasur', description: 'Klassische Rasur mit heißen Towels', duration_minutes: 30, price_cents: 2000, color: '#10B981', location_id: 'loc-hamburg', is_active: true },
        { id: '5', name: 'Massage', description: 'Kopfmassage während der Wäsche', duration_minutes: 15, price_cents: 1000, color: '#F59E0B', location_id: 'loc-munich', is_active: true },
      ]
      const filtered = locationId ? mockOfferings.filter(o => o.location_id === locationId) : mockOfferings
      return NextResponse.json({ offerings: filtered })
    }

    let query = supabase
      .from('offerings')
      .select(`
        id,
        name,
        description,
        duration_minutes,
        price_cents,
        color,
        location_id,
        is_active,
        locations:name,organization_id
      `)
      .eq('is_active', true)

    if (locationId) {
      query = query.eq('location_id', locationId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch offerings' },
        { status: 500 }
      )
    }

    return NextResponse.json({ offerings: data || [] })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
