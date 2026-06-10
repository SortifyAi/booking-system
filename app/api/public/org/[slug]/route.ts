import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mockOrganizations, mockLocations } from '@/lib/mock-data'
import { isMockMode } from '@/lib/mock-mode'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  if (isMockMode()) {
    const org = mockOrganizations.find((o) => o.slug === slug)
    if (!org) return NextResponse.json({ error: 'Organisation nicht gefunden' }, { status: 404 })
    const locations = mockLocations.filter((l) => l.organization_id === org.id)
    return NextResponse.json({ org, locations })
  }

  const { data: org, error } = await supabase
    .from('organizations')
    .select('id, name, slug, logo_url, settings')
    .eq('slug', slug)
    .single()

  if (error || !org) {
    return NextResponse.json({ error: 'Organisation nicht gefunden' }, { status: 404 })
  }

  const { data: locations } = await supabase
    .from('locations')
    .select('id, name, address, timezone')
    .eq('organization_id', org.id)

  return NextResponse.json({ org, locations: locations ?? [] })
}
