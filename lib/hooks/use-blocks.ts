// @ts-nocheck
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Block, CreateBlockRequest, UpdateBlockRequest } from '@/types/models'
import { createClient } from '@/lib/supabase/client'
import { isMockMode, mockDelay } from '@/lib/utils/mock'
import { z } from 'zod'

const BLOCKS_QUERY_KEY = ['blocks']

export function useBlocks(resourceId?: string, locationId?: string) {
  const queryKey = [...BLOCKS_QUERY_KEY, { resourceId, locationId }]

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (isMockMode()) {
        await mockDelay()
        return []
      }

      const params = new URLSearchParams()
      if (resourceId) params.append('resource_id', resourceId)
      if (locationId) params.append('location_id', locationId)

      const response = await fetch(`/api/blocks?${params}`)
      if (!response.ok) throw new Error('Urlaub/Krankheit konnte nicht geladen werden')

      const data = await response.json()
      return data.blocks as Block[]
    },
  })
}

export function useCreateBlock() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CreateBlockRequest) => {
      const schema = isMockMode()
        ? z.object({
            locationId: z.string().min(1),
            resourceId: z.string().optional(),
            startTime: z.string(),
            endTime: z.string(),
            reason: z.string().optional(),
            type: z.enum(['vacation', 'sick', 'break', 'maintenance', 'other']).default('other'),
          })
        : z.object({
            locationId: z.string().uuid(),
            resourceId: z.string().uuid().optional(),
            startTime: z.string(),
            endTime: z.string(),
            reason: z.string().optional(),
            type: z.enum(['vacation', 'sick', 'break', 'maintenance', 'other']).default('other'),
          })

      if (isMockMode()) {
        const validation = schema.safeParse(payload)
        if (!validation.success) {
          throw new Error(validation.error.issues[0]?.message || 'Validierung fehlgeschlagen')
        }

        await mockDelay()
        return {
          id: `mock-block-${Date.now()}`,
          ...validation.data,
          created_at: new Date().toISOString(),
        }
      }

      const response = await fetch('/api/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Urlaub/Krankheit konnte nicht erstellt werden')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BLOCKS_QUERY_KEY })
    },
  })
}

export function useUpdateBlock(blockId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updates: UpdateBlockRequest) => {
      if (isMockMode()) {
        await mockDelay()
        return { id: blockId, ...updates }
      }

      const response = await fetch(`/api/blocks/${blockId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Urlaub/Krankheit konnte nicht aktualisiert werden')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BLOCKS_QUERY_KEY })
    },
  })
}

export function useDeleteBlock(blockId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (isMockMode()) {
        await mockDelay()
        return { success: true }
      }

      const response = await fetch(`/api/blocks/${blockId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Urlaub/Krankheit konnte nicht gelöscht werden')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BLOCKS_QUERY_KEY })
    },
  })
}