// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient, getUser } from '@/lib/supabase/server'
import { normalizeEmail } from '@/lib/email-domain'

const createBlockSchema = z.object({
  organizationId: z.string().uuid(),
  email: z.string().trim().email(),
  reason: z.string().trim().max(500).optional(),
  sourceBookingId: z.string().uuid().optional(),
})

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

    const client = await createClient()
    const { data: memberships, error: membershipError } = await client
      .from('user_organizations')
      .select('organization_id, role, organizations(id, name)')
      .eq('user_id', user.id)

    if (membershipError) throw membershipError

    const organizationIds = (memberships || []).map((row: any) => row.organization_id)
    if (organizationIds.length === 0) {
      return NextResponse.json({ blocks: [], organizations: [] })
    }

    const { data: blocks, error: blocksError } = await client
      .from('customer_email_blocks')
      .select('*')
      .in('organization_id', organizationIds)
      .order('blocked_at', { ascending: false })

    if (blocksError) throw blocksError

    const actorIds = Array.from(new Set(
      (blocks || []).flatMap((block: any) => [block.blocked_by, block.unblocked_by]).filter(Boolean)
    )) as string[]
    const actorLabels = new Map<string, string>()

    if (actorIds.length > 0 && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const service = createServiceClient()
      await Promise.all(actorIds.map(async (actorId) => {
        try {
          const { data } = await service.auth.admin.getUserById(actorId)
          actorLabels.set(actorId, data.user?.email || actorId)
        } catch {
          actorLabels.set(actorId, actorId)
        }
      }))
    }

    return NextResponse.json({
      blocks: (blocks || []).map((block: any) => ({
        ...block,
        blockedByLabel: block.blocked_by
          ? actorLabels.get(block.blocked_by) || block.blocked_by
          : null,
        unblockedByLabel: block.unblocked_by
          ? actorLabels.get(block.unblocked_by) || block.unblocked_by
          : null,
      })),
      organizations: (memberships || []).map((membership: any) => ({
        id: membership.organization_id,
        name: membership.organizations?.name || 'Salon',
        role: membership.role,
      })),
    })
  } catch (error) {
    console.error('Failed to load customer email blocks:', error)
    return NextResponse.json({ error: 'Sperrliste konnte nicht geladen werden' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

    const parsed = createBlockSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Ungültige Eingabe', details: parsed.error.issues }, { status: 400 })
    }

    const client = await createClient()
    const { organizationId, email, reason, sourceBookingId } = parsed.data
    const normalizedEmail = normalizeEmail(email)

    const { data: membership } = await client
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .maybeSingle() as any

    if (!['owner', 'admin'].includes(membership?.role || '')) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 })
    }

    if (sourceBookingId) {
      const { data: sourceBooking } = await client
        .from('bookings')
        .select('organization_id, customer_email')
        .eq('id', sourceBookingId)
        .maybeSingle() as any
      if (
        !sourceBooking ||
        sourceBooking.organization_id !== organizationId ||
        normalizeEmail(sourceBooking.customer_email || '') !== normalizedEmail
      ) {
        return NextResponse.json({ error: 'Ausgangstermin passt nicht zur E-Mail-Adresse' }, { status: 400 })
      }
    }

    const { data: block, error } = await client
      .from('customer_email_blocks')
      .insert({
        organization_id: organizationId,
        normalized_email: normalizedEmail,
        reason: reason || null,
        source_booking_id: sourceBookingId || null,
        blocked_by: user.id,
      })
      .select()
      .single() as any

    if (error?.code === '23505') {
      return NextResponse.json({ error: 'Diese E-Mail-Adresse ist bereits gesperrt.' }, { status: 409 })
    }
    if (error) throw error

    return NextResponse.json(block, { status: 201 })
  } catch (error) {
    console.error('Failed to create customer email block:', error)
    return NextResponse.json({ error: 'E-Mail-Adresse konnte nicht gesperrt werden' }, { status: 500 })
  }
}
