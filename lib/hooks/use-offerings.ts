// @ts-nocheck
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CreateOfferingRequest, Offering, UpdateOfferingRequest } from '@/types/models'
import { createClient } from '@/lib/supabase/client'
import { CreateOfferingSchema } from '@/lib/validations/schemas'
import { mockLocations, mockOrganizations } from '@/lib/mock-data'
import { z } from 'zod'
import { isMockMode, mockDelay } from '@/lib/utils/mock'
import { mockOfferings } from '@/lib/mock-data'

const OFFERINGS_QUERY_KEY = ['offerings']

export function useOfferings(locationId?: string) {
  const queryKey = [...OFFERINGS_QUERY_KEY, { locationId }]

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (isMockMode()) {
        await mockDelay()
        return locationId
          ? mockOfferings.filter(offering => offering.location_id === locationId)
          : mockOfferings
      }

      const params = new URLSearchParams()
      if (locationId) params.append('location_id', locationId)

      const response = await fetch(`/api/offerings?${params}`)
      if (!response.ok) throw new Error('Leistungen konnten nicht geladen werden')

      const data = await response.json()
      return data.offerings as Offering[]
    },
  })
}

export function useCreateOffering() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CreateOfferingRequest) => {
      const schema = isMockMode()
        ? CreateOfferingSchema.extend({
            organizationId: z.string().min(1, 'Organisation ist erforderlich'),
            locationId: z.string().min(1, 'Standort ist erforderlich'),
          })
        : CreateOfferingSchema

      if (isMockMode()) {
        const orgId = payload.organizationId?.trim() || null
        const resolvedOrgId =
          orgId || (mockOrganizations.length === 1 ? mockOrganizations[0].id : null)
        if (!resolvedOrgId) {
          throw new Error('Organisation muss ausgewählt werden')
        }

        const locId = payload.locationId?.trim() || null
        const availableLocations = mockLocations.filter(loc => loc.organization_id === resolvedOrgId)
        const resolvedLocationId =
          locId || (availableLocations.length === 1 ? availableLocations[0].id : null)
        if (!resolvedLocationId) {
          throw new Error('Standort muss ausgewählt werden')
        }

        const validation = schema.safeParse({
          ...payload,
          organizationId: resolvedOrgId,
          locationId: resolvedLocationId,
        })
        if (!validation.success) {
          throw new Error(validation.error.issues[0]?.message || 'Validierung fehlgeschlagen')
        }

        await mockDelay()
        return {
          id: `mock-off-${Date.now()}`,
          ...validation.data,
          organization_id: resolvedOrgId,
          location_id: resolvedLocationId,
          duration_minutes: validation.data.durationMinutes,
          price_cents: validation.data.priceCents || null,
          capacity: validation.data.capacity ?? 1,
          color: validation.data.color || '#2563EB',
          image_url: validation.data.imageUrl ?? null,
          available_as_addon: validation.data.availableAsAddon ?? false,
          is_standalone_bookable: validation.data.isStandaloneBookable ?? true,
          sort_order:
            mockOfferings.filter(
              offering =>
                offering.location_id === resolvedLocationId &&
                !!offering.available_as_addon === !!validation.data.availableAsAddon
            ).length + 1,
          created_at: new Date().toISOString(),
        }
      }

      const client = createClient()
      let organizationId = payload.organizationId?.trim() || ''
      let locationId = payload.locationId?.trim() || ''

      if (!organizationId) {
        const { data: userData } = await client.auth.getUser()
        const user = userData?.user
        if (user) {
          const { data, count } = await client
            .from('user_organizations')
            .select('organization_id', { count: 'exact' })
            .eq('user_id', user.id)

          if (count === 1 && data?.[0]) {
            organizationId = data[0].organization_id
          }
        }
      }

      if (!organizationId) {
        throw new Error('Organisation muss ausgewählt werden')
      }

      if (!locationId) {
        const { data, count } = await client
          .from('locations')
          .select('id', { count: 'exact' })
          .eq('organization_id', organizationId)

        if (count === 1 && data?.[0]) {
          locationId = data[0].id
        }
      }

      if (!locationId) {
        throw new Error('Standort muss ausgewählt werden')
      }

      const validation = schema.safeParse({
        ...payload,
        organizationId,
        locationId,
      })
      if (!validation.success) {
        throw new Error(validation.error.issues[0]?.message || 'Validierung fehlgeschlagen')
      }

      const response = await fetch('/api/offerings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Leistung konnte nicht erstellt werden')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OFFERINGS_QUERY_KEY })
    },
  })
}

export function useUpdateOffering(offeringId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updates: UpdateOfferingRequest) => {
      if (isMockMode()) {
        await mockDelay()
        return { id: offeringId, ...updates }
      }

      const response = await fetch(`/api/offerings/${offeringId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Leistung konnte nicht aktualisiert werden')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OFFERINGS_QUERY_KEY })
    },
  })
}

export function useDeleteOffering(offeringId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (isMockMode()) {
        await mockDelay()
        return { success: true }
      }

      const response = await fetch(`/api/offerings/${offeringId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Leistung konnte nicht gelöscht werden')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OFFERINGS_QUERY_KEY })
    },
  })
}
