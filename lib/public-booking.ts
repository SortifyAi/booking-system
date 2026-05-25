export interface PublicBookingSlot {
  startTime: string
  endTime: string
  available: boolean
  staffId?: string
  staffName?: string
}

export interface StaffAvailabilityForPublicBooking {
  staffId: string
  staffName: string
  priority?: number
  slots: PublicBookingSlot[]
}

export function combineStaffAvailabilitySlots(
  staffDetails: StaffAvailabilityForPublicBooking[]
): PublicBookingSlot[] {
  const slotMap = new Map<string, PublicBookingSlot & { priority: number }>()

  staffDetails.forEach((staff) => {
    staff.slots.forEach((slot) => {
      const key = `${slot.startTime}|${slot.endTime}`
      const candidate = {
        ...slot,
        staffId: slot.staffId || staff.staffId,
        staffName: slot.staffName || staff.staffName,
        priority: staff.priority ?? 0,
      }
      const existing = slotMap.get(key)

      if (!existing) {
        slotMap.set(key, candidate)
        return
      }

      if (!existing.available && candidate.available) {
        slotMap.set(key, candidate)
        return
      }

      if (
        existing.available === candidate.available &&
        candidate.priority < existing.priority
      ) {
        slotMap.set(key, candidate)
      }
    })
  })

  return Array.from(slotMap.values())
    .map(({ priority, ...slot }) => slot)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}
