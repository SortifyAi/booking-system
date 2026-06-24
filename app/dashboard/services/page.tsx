// @ts-nocheck
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { Briefcase, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/EmptyState'
import { SkeletonGrid } from '@/components/ui/skeleton'
import { isMockMode } from '@/lib/utils/mock'
import { mockOfferings } from '@/lib/mock-data'
import { OfferingForm } from '@/components/OfferingForm'
import {
  SortableOfferingCard,
  type SortableOfferingService,
} from '@/components/SortableOfferingCard'
import { groupOfferings, moveOffering } from '@/lib/offering-order.mjs'

interface Service extends SortableOfferingService {
  organization_id?: string
  organizationId?: string
  location_id: string
  location_name?: string
  sort_order: number
  is_standalone_bookable: boolean
  created_at?: string
}

function withNormalizedPositions(services: Service[]) {
  return services.map((service, index) => ({ ...service, sort_order: index + 1 }))
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const supabase = createClient()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const mapOfferingToService = useCallback((offering: any): Service => {
    const duration = offering.duration_minutes ?? offering.durationMinutes ?? 0
    const priceCents = offering.price_cents ?? offering.priceCents ?? null
    return {
      id: offering.id,
      name: offering.name,
      description: offering.description || undefined,
      duration,
      price: typeof priceCents === 'number' ? priceCents / 100 : undefined,
      organization_id: offering.organization_id,
      organizationId: offering.organizationId,
      location_id: offering.location_id ?? offering.locationId ?? 'default',
      location_name: offering.locations?.name ?? offering.location_name,
      image_url: offering.image_url ?? offering.imageUrl ?? null,
      imageUrl: offering.imageUrl ?? offering.image_url ?? null,
      available_as_addon:
        offering.available_as_addon ?? offering.availableAsAddon ?? false,
      is_standalone_bookable:
        offering.is_standalone_bookable ?? offering.isStandaloneBookable ?? true,
      sort_order: offering.sort_order ?? offering.sortOrder ?? Number.MAX_SAFE_INTEGER,
      created_at: offering.created_at ?? offering.createdAt,
    }
  }, [])

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true)

      if (isMockMode()) {
        setServices(mockOfferings.map(mapOfferingToService))
        return
      }

      const { data, error } = await supabase
        .from('offerings')
        .select('*, locations(name)')
        .order('available_as_addon', { ascending: true })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })

      if (error) throw error
      setServices((data || []).map(mapOfferingToService))
    } catch {
      toast.error('Leistungen konnten nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }, [mapOfferingToService, supabase])

  useEffect(() => {
    fetchServices()
  }, [fetchServices])

  const locationGroups = useMemo(() => {
    const grouped = new Map<string, { id: string; name: string; services: Service[] }>()
    for (const service of services) {
      const current = grouped.get(service.location_id) ?? {
        id: service.location_id,
        name: service.location_name || 'Standort',
        services: [],
      }
      current.services.push(service)
      grouped.set(service.location_id, current)
    }
    return Array.from(grouped.values())
  }, [services])

  const replaceGroup = useCallback(
    (
      allServices: Service[],
      locationId: string,
      availableAsAddon: boolean,
      nextGroup: Service[]
    ) => {
      const replacements = new Map(
        withNormalizedPositions(nextGroup).map((service) => [service.id, service])
      )
      return allServices.map((service) => {
        if (
          service.location_id !== locationId ||
          !!service.available_as_addon !== availableAsAddon
        ) {
          return service
        }
        return replacements.get(service.id) ?? service
      })
    },
    []
  )

  const persistOrder = useCallback(
    async (
      locationId: string,
      availableAsAddon: boolean,
      previousServices: Service[],
      nextGroup: Service[],
      movedService: Service
    ) => {
      setSavingOrder(true)
      setServices((current) =>
        replaceGroup(current, locationId, availableAsAddon, nextGroup)
      )

      try {
        if (!isMockMode()) {
          const response = await fetch('/api/offerings/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              locationId,
              availableAsAddon,
              offeringIds: nextGroup.map((service) => service.id),
            }),
          })
          if (!response.ok) {
            const body = await response.json().catch(() => ({}))
            throw new Error(body.error || 'Reihenfolge konnte nicht gespeichert werden')
          }
        }

        const position = nextGroup.findIndex((service) => service.id === movedService.id) + 1
        setAnnouncement(`${movedService.name} ist jetzt an Position ${position}.`)
      } catch (error) {
        setServices(previousServices)
        toast.error(
          error instanceof Error
            ? error.message
            : 'Reihenfolge konnte nicht gespeichert werden'
        )
        await fetchServices()
      } finally {
        setSavingOrder(false)
      }
    },
    [fetchServices, replaceGroup]
  )

  const reorderGroup = useCallback(
    (
      locationId: string,
      availableAsAddon: boolean,
      activeId: string,
      overId: string
    ) => {
      const previousServices = services
      const locationServices = services.filter(
        (service) => service.location_id === locationId
      )
      const group = groupOfferings(locationServices)[
        availableAsAddon ? 'addon' : 'main'
      ] as Service[]
      const nextGroup = moveOffering(group, activeId, overId) as Service[]
      if (nextGroup === group) return
      const movedService = group.find((service) => service.id === activeId)
      if (!movedService) return
      void persistOrder(
        locationId,
        availableAsAddon,
        previousServices,
        nextGroup,
        movedService
      )
    },
    [persistOrder, services]
  )

  const moveByOffset = useCallback(
    (
      locationId: string,
      availableAsAddon: boolean,
      group: Service[],
      index: number,
      offset: number
    ) => {
      const target = group[index + offset]
      if (!target) return
      reorderGroup(locationId, availableAsAddon, group[index].id, target.id)
    },
    [reorderGroup]
  )

  const handleCreated = (offering: unknown) => {
    if (isMockMode()) {
      setServices((previous) => [...previous, mapOfferingToService(offering)])
      return
    }
    void fetchServices()
  }

  const handleUpdated = (updatedOffering: unknown) => {
    const updated = mapOfferingToService(updatedOffering)
    setServices((previous) =>
      previous.map((service) =>
        service.id === updated.id ? { ...service, ...updated } : service
      )
    )
  }

  const handleToggleAddon = async (id: string, value: boolean) => {
    const previousServices = services
    const service = services.find((item) => item.id === id)
    if (!service) return
    const destination = services.filter(
      (item) =>
        item.location_id === service.location_id &&
        !!item.available_as_addon === value &&
        item.id !== id
    )
    setServices((previous) =>
      previous.map((item) =>
        item.id === id
          ? {
              ...item,
              available_as_addon: value,
              sort_order: destination.length + 1,
            }
          : item
      )
    )

    if (isMockMode()) return

    try {
      const response = await fetch(`/api/offerings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availableAsAddon: value }),
      })
      if (!response.ok) throw new Error('Leistungstyp konnte nicht gespeichert werden')
      handleUpdated(await response.json())
    } catch (error) {
      setServices(previousServices)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Änderung konnte nicht gespeichert werden'
      )
    }
  }

  const handleToggleStandalone = async (id: string, value: boolean) => {
    const previousServices = services
    setServices((previous) =>
      previous.map((service) =>
        service.id === id ? { ...service, is_standalone_bookable: value } : service
      )
    )

    if (isMockMode()) return

    try {
      const response = await fetch(`/api/offerings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isStandaloneBookable: value }),
      })
      if (!response.ok) throw new Error('Buchungsart konnte nicht gespeichert werden')
      handleUpdated(await response.json())
    } catch (error) {
      setServices(previousServices)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Änderung konnte nicht gespeichert werden'
      )
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bist du sicher, dass du diese Leistung löschen möchtest?')) return

    try {
      if (isMockMode()) {
        setServices((previous) => previous.filter((service) => service.id !== id))
        toast.success('Leistung erfolgreich gelöscht')
        return
      }

      const { error } = await supabase.from('offerings').delete().eq('id', id)
      if (error) throw error
      setServices((previous) => previous.filter((service) => service.id !== id))
      toast.success('Leistung erfolgreich gelöscht')
    } catch {
      toast.error('Leistung konnte nicht gelöscht werden')
    }
  }

  const renderGroup = (
    locationId: string,
    availableAsAddon: boolean,
    group: Service[],
    title: string,
    description: string,
    mainCount = 0
  ) => (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
      {group.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
          Keine {title.toLowerCase()} vorhanden.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={({ active, over }) => {
            if (over && active.id !== over.id) {
              reorderGroup(
                locationId,
                availableAsAddon,
                String(active.id),
                String(over.id)
              )
            }
          }}
        >
          <SortableContext
            items={group.map((service) => service.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.map((service, index) => (
                <SortableOfferingCard
                  key={service.id}
                  service={service}
                  position={availableAsAddon ? mainCount + index + 1 : index + 1}
                  first={index === 0}
                  last={index === group.length - 1}
                  disabled={savingOrder}
                  onMoveUp={() =>
                    moveByOffset(locationId, availableAsAddon, group, index, -1)
                  }
                  onMoveDown={() =>
                    moveByOffset(locationId, availableAsAddon, group, index, 1)
                  }
                  onDelete={() => handleDelete(service.id)}
                  onToggleAddon={(value) => handleToggleAddon(service.id, value)}
                  onToggleStandalone={(value) =>
                    handleToggleStandalone(service.id, value)
                  }
                  onUpdated={handleUpdated}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </section>
  )

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 sm:text-3xl">
            Leistungen
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
            Lege fest, in welcher Reihenfolge Kunden deine Leistungen sehen.
          </p>
        </div>
        <Button
          onClick={() => setShowModal(true)}
          className="flex w-full items-center gap-2 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Leistung hinzufügen
        </Button>
      </div>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      {loading ? (
        <SkeletonGrid count={3} />
      ) : services.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-12 w-12" />}
          title="Noch keine Leistungen"
          description="Erstelle deine erste Leistung, um Buchungen zu verwalten"
          action={{
            label: 'Leistung erstellen',
            onClick: () => setShowModal(true),
          }}
        />
      ) : (
        <div className="space-y-8">
          {locationGroups.map((location) => {
            const groups = groupOfferings(location.services) as {
              main: Service[]
              addon: Service[]
            }
            return (
              <section
                key={location.id}
                className="space-y-6 rounded-3xl border border-slate-200 bg-white/60 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/20 sm:p-6"
              >
                {locationGroups.length > 1 && (
                  <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
                    <h2 className="text-lg font-bold text-slate-950 dark:text-white">
                      {location.name}
                    </h2>
                  </div>
                )}
                {renderGroup(
                  location.id,
                  false,
                  groups.main,
                  'Hauptleistungen',
                  'Diese Leistungen werden Kunden immer zuerst angezeigt.'
                )}
                {renderGroup(
                  location.id,
                  true,
                  groups.addon,
                  'Zusatzleistungen',
                  'Einzeln buchbare Zusätze erscheinen nach den Hauptleistungen.',
                  groups.main.length
                )}
              </section>
            )
          })}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Neue Leistung erstellen</DialogTitle>
          </DialogHeader>
          <OfferingForm onCreated={handleCreated} onCancel={() => setShowModal(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
