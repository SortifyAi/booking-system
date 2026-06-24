// @ts-nocheck
'use client'

import { CSS } from '@dnd-kit/utilities'
import { useSortable } from '@dnd-kit/sortable'
import { ArrowDown, ArrowUp, GripVertical, Trash2 } from 'lucide-react'
import { OfferingImageUploadControl } from '@/components/OfferingImageUploadControl'

export interface SortableOfferingService {
  id: string
  name: string
  description?: string
  duration: number
  price?: number
  image_url?: string | null
  imageUrl?: string | null
  available_as_addon?: boolean
  is_standalone_bookable?: boolean
}

interface SortableOfferingCardProps {
  service: SortableOfferingService
  position: number
  first: boolean
  last: boolean
  disabled: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  onToggleAddon: (value: boolean) => void
  onToggleStandalone: (value: boolean) => void
  onUpdated: (offering: unknown) => void
}

export function SortableOfferingCard({
  service,
  position,
  first,
  last,
  disabled,
  onMoveUp,
  onMoveDown,
  onDelete,
  onToggleAddon,
  onToggleStandalone,
  onUpdated,
}: SortableOfferingCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: service.id, disabled })

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`relative rounded-2xl border bg-white p-4 shadow-sm transition-shadow dark:bg-slate-900 ${
        isDragging
          ? 'z-20 border-blue-400 shadow-xl shadow-blue-950/15 dark:border-blue-500'
          : 'border-gray-200 hover:shadow-md dark:border-slate-800'
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-10 w-10 touch-none items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-600 dark:hover:bg-blue-950/40"
            aria-label={`Reihenfolge von ${service.name} ändern`}
            title="Ziehen, um die Position zu ändern"
            disabled={disabled}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-5 w-5" />
          </button>
          <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-blue-50 px-2 text-xs font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
            {position}
          </span>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Position
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={disabled || first}
            aria-label={`${service.name} nach oben verschieben`}
            title="Nach oben"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={disabled || last}
            aria-label={`${service.name} nach unten verschieben`}
            title="Nach unten"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            aria-label={`${service.name} löschen`}
            title="Löschen"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-950/30 dark:hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex min-w-0 items-start gap-3">
        {(service.image_url ?? service.imageUrl) && (
          <img
            src={service.image_url ?? service.imageUrl ?? ''}
            alt={`${service.name} Bild`}
            className="h-14 w-14 flex-shrink-0 rounded-xl object-cover ring-1 ring-gray-200 dark:ring-slate-700"
            loading="lazy"
          />
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-slate-100">
              {service.name}
            </h3>
            {service.available_as_addon && (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                Zusatzleistung
              </span>
            )}
          </div>
          {service.description && (
            <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-slate-400">
              {service.description}
            </p>
          )}
          <div className="mt-2 space-y-1 text-xs text-gray-500 dark:text-slate-400">
            <p>Dauer: {service.duration} Min</p>
            {service.price !== undefined && <p>Preis: €{service.price.toFixed(2)}</p>}
          </div>
        </div>
      </div>

      <label className="mt-4 flex items-center gap-2 text-xs text-gray-600 dark:text-slate-400">
        <input
          type="checkbox"
          checked={!!service.available_as_addon}
          onChange={(event) => onToggleAddon(event.target.checked)}
          disabled={disabled}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
        />
        Als Zusatzleistung anbieten
      </label>

      {service.available_as_addon && (
        <label className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-gray-600 dark:bg-slate-800/60 dark:text-slate-300">
          <input
            type="checkbox"
            checked={service.is_standalone_bookable !== false}
            onChange={(event) => onToggleStandalone(event.target.checked)}
            disabled={disabled}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
          />
          <span>
            <span className="block font-semibold text-slate-800 dark:text-slate-100">
              Auch einzeln buchbar
            </span>
            <span className="mt-0.5 block text-slate-500 dark:text-slate-400">
              Deaktiviert erscheint sie nur als Zusatz zu einer Hauptleistung.
            </span>
          </span>
        </label>
      )}

      <OfferingImageUploadControl offering={service} onUpdated={onUpdated} />
    </article>
  )
}
