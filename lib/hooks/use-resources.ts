// @ts-nocheck
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CreateResourceRequest, Resource, UpdateResourceRequest } from '@/types/models'
import { createClient } from '@/lib/supabase/client'
import { CreateResourceSchema } from '@/lib/validations/schemas'
import { mockLocations, mockOrganizations } from '@/lib/mock-data'
import { z } from 'zod'
import { isMockMode, mockDelay } from '@/lib/utils/mock'
import { mockResources } from '@/lib/mock-data'

const RESOURCES_QUERY_KEY = ['resources']

export function useResources(locationId?: string) {
  const queryKey = [...RESOURCES_QUERY_KEY, { locationId }]

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (isMockMode()) {
        await mockDelay()
        return locationId
          ? mockResources.filter(resource => resource.location_id === locationId)
          : mockResources
      }

      const params = new URLSearchParams()
      if (locationId) params.append('location_id', locationId)

      const response = await fetch(`/api/resources?${params}`)
      if (!response.ok) throw new Error('Ressourcen konnten nicht geladen werden')

      const data = await response.json()
      return data.resources as Resource[]
    },
  })
}

export function useCreateResource() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CreateResourceRequest) => {
      const schema = isMockMode()
        ? CreateResourceSchema.extend({
            organizationId: z.string().min(1, 'Organisation ist erforderlich'),
            locationId: z.string().min(1, 'Standort ist erforderlich'),
          })
        : CreateResourceSchema

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
          id: `mock-res-${Date.now()}`,
          ...validation.data,
          capacity: validation.data.capacity ?? 1,
          type: validation.data.type || 'staff',
          image_url: validation.data.imageUrl ?? null,
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

      const response = await fetch('/api/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Ressource konnte nicht erstellt werden')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESOURCES_QUERY_KEY })
    },
  })
}

export function useUpdateResource(resourceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updates: UpdateResourceRequest) => {
      if (isMockMode()) {
        await mockDelay()
        return { id: resourceId, ...updates }
      }

      const response = await fetch(`/api/resources/${resourceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Ressource konnte nicht aktualisiert werden')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESOURCES_QUERY_KEY })
    },
  })
}

export function useDeleteResource(resourceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (isMockMode()) {
        await mockDelay()
        return { success: true }
      }

      const response = await fetch(`/api/resources/${resourceId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Ressource konnte nicht gelöscht werden')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESOURCES_QUERY_KEY })
    },
  })
}
