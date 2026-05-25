// @ts-nocheck
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CreateScheduleRequest, Schedule, UpdateScheduleRequest } from '@/types/models'
import { createClient } from '@/lib/supabase/client'
import { isMockMode, mockDelay } from '@/lib/utils/mock'
import { z } from 'zod'

const SCHEDULES_QUERY_KEY = ['schedules']

export function useSchedules(resourceId?: string) {
  const queryKey = [...SCHEDULES_QUERY_KEY, { resourceId }]

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (isMockMode()) {
        await mockDelay()
        return []
      }

      const params = new URLSearchParams()
      if (resourceId) params.append('resource_id', resourceId)

      const response = await fetch(`/api/schedules?${params}`)
      if (!response.ok) throw new Error('Zeitpläne konnten nicht geladen werden')

      const data = await response.json()
      return data.schedules as Schedule[]
    },
  })
}

export function useCreateSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CreateScheduleRequest) => {
      const schema = isMockMode()
        ? z.object({
            resourceId: z.string().min(1),
            locationId: z.string().min(1),
            dayOfWeek: z.number().min(0).max(6),
            startTime: z.string(),
            endTime: z.string(),
          })
        : z.object({
            resourceId: z.string().uuid(),
            locationId: z.string().uuid(),
            dayOfWeek: z.number().min(0).max(6),
            startTime: z.string(),
            endTime: z.string(),
          })

      if (isMockMode()) {
        const validation = schema.safeParse(payload)
        if (!validation.success) {
          throw new Error(validation.error.issues[0]?.message || 'Validierung fehlgeschlagen')
        }

        await mockDelay()
        return {
          id: `mock-schedule-${Date.now()}`,
          ...validation.data,
          is_active: true,
          created_at: new Date().toISOString(),
        }
      }

      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Zeitplan konnte nicht erstellt werden')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULES_QUERY_KEY })
    },
  })
}

export function useUpdateSchedule(scheduleId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updates: UpdateScheduleRequest) => {
      if (isMockMode()) {
        await mockDelay()
        return { id: scheduleId, ...updates }
      }

      const response = await fetch(`/api/schedules/${scheduleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Zeitplan konnte nicht aktualisiert werden')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULES_QUERY_KEY })
    },
  })
}

export function useDeleteSchedule(scheduleId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (isMockMode()) {
        await mockDelay()
        return { success: true }
      }

      const response = await fetch(`/api/schedules/${scheduleId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Zeitplan konnte nicht gelöscht werden')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULES_QUERY_KEY })
    },
  })
}