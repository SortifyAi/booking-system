import { zonedTimeToUtc } from './timezone'

export const DEMO_BOOKING_SLUG = 'salon-nordlicht'
export const DEMO_TIMEZONE = 'Europe/Berlin'

export const demoOrganization = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Salon Nordlicht',
  slug: DEMO_BOOKING_SLUG,
  logo_url: '/demo/salon-nordlicht-logo.svg',
  settings: {
    showPrices: true,
    showDuration: true,
    requiredCustomerFields: {
      phone: false,
      notes: false,
    },
    privacyPolicyUrl: 'https://bookanord.de/datenschutz',
  },
}

export const demoLocations = [
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Hamburg Eimsbuettel',
    address: 'Osterstrasse 42, 20259 Hamburg',
    phone: '+49 40 1234567',
    timezone: DEMO_TIMEZONE,
    organization_id: demoOrganization.id,
    settings: {
      openingHours: [
        { day: 0, closed: false, open: '10:00', close: '16:00' },
        { day: 1, closed: false, open: '09:00', close: '18:00' },
        { day: 2, closed: false, open: '09:00', close: '18:00' },
        { day: 3, closed: false, open: '09:00', close: '18:00' },
        { day: 4, closed: false, open: '09:00', close: '19:00' },
        { day: 5, closed: false, open: '09:00', close: '19:00' },
        { day: 6, closed: false, open: '10:00', close: '16:00' },
      ],
    },
  },
]

export const demoOfferings = [
  {
    id: '33333333-3333-4333-8333-333333333331',
    name: 'Haarschnitt',
    description: 'Waschen, Schneiden, Styling',
    duration_minutes: 45,
    price_cents: 3900,
    color: '#2563EB',
    location_id: demoLocations[0].id,
    organization_id: demoOrganization.id,
    is_active: true,
  },
  {
    id: '33333333-3333-4333-8333-333333333332',
    name: 'Farbe & Glossing',
    description: 'Farbauffrischung mit Beratung',
    duration_minutes: 90,
    price_cents: 8900,
    color: '#14B8A6',
    location_id: demoLocations[0].id,
    organization_id: demoOrganization.id,
    is_active: true,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Bartpflege',
    description: 'Konturen, Pflege und Finish',
    duration_minutes: 30,
    price_cents: 2400,
    color: '#0F766E',
    location_id: demoLocations[0].id,
    organization_id: demoOrganization.id,
    is_active: true,
  },
]

export const demoStaffMembers = [
  {
    id: '44444444-4444-4444-8444-444444444441',
    name: 'Mira Hansen',
    type: 'staff',
    capacity: 1,
    image_url: '/demo/mira-hansen.svg',
    location_id: demoLocations[0].id,
    organization_id: demoOrganization.id,
    is_active: true,
  },
  {
    id: '44444444-4444-4444-8444-444444444442',
    name: 'Jonas Meyer',
    type: 'staff',
    capacity: 1,
    image_url: '/demo/jonas-meyer.svg',
    location_id: demoLocations[0].id,
    organization_id: demoOrganization.id,
    is_active: true,
  },
  {
    id: '44444444-4444-4444-8444-444444444443',
    name: 'Lea Fischer',
    type: 'staff',
    capacity: 1,
    image_url: '/demo/lea-fischer.svg',
    location_id: demoLocations[0].id,
    organization_id: demoOrganization.id,
    is_active: true,
  },
]

const demoSlotTimesByStaff: Record<string, string[]> = {
  [demoStaffMembers[0].id]: ['09:00', '10:30', '13:30', '15:00'],
  [demoStaffMembers[1].id]: ['09:30', '11:00', '14:00', '16:30'],
  [demoStaffMembers[2].id]: ['10:00', '12:00', '15:30', '17:00'],
}

type DemoAvailabilityParams = {
  date: string
  offeringId: string
  preferredStaffId?: string
  aggregated?: boolean
  mode?: 'smart'
}

export function isDemoBookingSlug(slug: string): boolean {
  return slug.toLowerCase() === DEMO_BOOKING_SLUG
}

export function isDemoLocationId(locationId: string): boolean {
  return demoLocations.some((location) => location.id === locationId)
}

export function isDemoOfferingId(offeringId: string): boolean {
  return demoOfferings.some((offering) => offering.id === offeringId)
}

export function getDemoOfferings(locationId?: string | null) {
  return locationId
    ? demoOfferings.filter((offering) => offering.location_id === locationId)
    : demoOfferings
}

export function getDemoStaffMembers(locationId?: string | null) {
  return locationId
    ? demoStaffMembers.filter((staff) => staff.location_id === locationId)
    : demoStaffMembers
}

function createDemoSlot(date: string, time: string, durationMinutes: number, staff: typeof demoStaffMembers[number]) {
  const [hour, minute] = time.split(':').map(Number)
  const start = zonedTimeToUtc(date, hour, minute, DEMO_TIMEZONE)
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000)

  return {
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    available: true,
    staffId: staff.id,
    staffName: staff.name,
    staffImageUrl: staff.image_url,
  }
}

export function buildDemoAvailability({
  date,
  offeringId,
  preferredStaffId,
  aggregated,
  mode,
}: DemoAvailabilityParams) {
  const offering = demoOfferings.find((item) => item.id === offeringId) ?? demoOfferings[0]
  const staffAvailabilities = demoStaffMembers.map((staff, priority) => {
    const slots = (demoSlotTimesByStaff[staff.id] ?? []).map((time) =>
      createDemoSlot(date, time, offering.duration_minutes, staff)
    )

    return {
      staffId: staff.id,
      staffName: staff.name,
      staffImageUrl: staff.image_url,
      slots,
      availableSlots: slots.length,
      totalSlots: slots.length,
      utilizationRate: 0,
      priority,
    }
  })

  if (mode === 'smart') {
    const preferredAvailability = preferredStaffId
      ? staffAvailabilities.find((staff) => staff.staffId === preferredStaffId)
      : staffAvailabilities[0]
    const preferredStaffAvailableSlots = preferredAvailability?.slots ?? []
    const fallbackNextAvailable = preferredStaffAvailableSlots.length
      ? null
      : staffAvailabilities.flatMap((staff) => staff.slots)[0] ?? null

    return {
      type: 'smart',
      date,
      preferredStaffId: preferredStaffId || null,
      preferredStaffAvailableSlots,
      fallbackNextAvailable,
      reason: fallbackNextAvailable ? 'Dieser Demo-Mitarbeiter ist ausgebucht, ein anderer Slot ist frei.' : null,
    }
  }

  if (aggregated) {
    const totalSlots = staffAvailabilities.reduce((sum, staff) => sum + staff.totalSlots, 0)

    return {
      type: 'aggregated',
      aggregated: {
        date,
        totalCapacity: staffAvailabilities.length,
        bookedCapacity: 0,
        availableCapacity: staffAvailabilities.length,
        utilizationRate: 0,
        peakHours: [],
        freeSlots: staffAvailabilities.flatMap((staff) => staff.slots).slice(0, 3).map((slot) => slot.startTime),
        status: 'green',
        staffSummary: staffAvailabilities.map((staff) => ({
          staffId: staff.staffId,
          staffName: staff.staffName,
          utilization: staff.utilizationRate,
        })),
      },
      staffDetails: staffAvailabilities,
      totalSlots,
    }
  }

  return {
    type: 'multi',
    date,
    staffAvailabilities,
  }
}
