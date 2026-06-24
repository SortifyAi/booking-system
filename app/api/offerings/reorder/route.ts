// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, getUser } from '@/lib/supabase/server'
import { ReorderOfferingsSchema } from '@/lib/validations/schemas'

export async function POST(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    }

    const validation = ReorderOfferingsSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validierung fehlgeschlagen', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { locationId, availableAsAddon, offeringIds } = validation.data
    const client = await createClient()
    const { error } = await client.rpc('reorder_offerings', {
      p_location_id: locationId,
      p_available_as_addon: availableAsAddon,
      p_offering_ids: offeringIds,
    })

    if (error) {
      const status = error.code === '42501' ? 403 : 400
      return NextResponse.json(
        { error: error.message || 'Reihenfolge konnte nicht gespeichert werden' },
        { status }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error reordering offerings:', error)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}
