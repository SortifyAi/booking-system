// @ts-nocheck
import { addDays, addHours } from 'date-fns'

const now = new Date()

export const mockUser = {
  id: 'mock-user-1',
  email: 'demo@buchung.de',
  created_at: new Date(now.getFullYear(), now.getMonth() - 4, 12).toISOString(),
}

export const mockOrganizations = [
  {
    id: 'org-1',
    name: 'Demo Organisation',
    slug: 'demo-organisation',
    settings: {},
    created_at: addDays(now, -120).toISOString(),
    updated_at: addDays(now, -5).toISOString(),
  },
]

export const mockLocations = [
  {
    id: 'loc-berlin',
    name: 'Berlin Mitte',
    address: 'Friedrichstr. 123, 10117 Berlin',
    timezone: 'Europe/Berlin',
    organization_id: 'org-1',
    created_at: addDays(now, -90).toISOString(),
  },
  {
    id: 'loc-hamburg',
    name: 'Hamburg Hafen',
    address: 'Am Sandtorkai 1, 20457 Hamburg',
    timezone: 'Europe/Berlin',
    organization_id: 'org-1',
    created_at: addDays(now, -70).toISOString(),
  },
  {
    id: 'loc-munich',
    name: 'München Zentrum',
    address: 'Sendlinger Str. 9, 80331 München',
    timezone: 'Europe/Berlin',
    organization_id: 'org-1',
    created_at: addDays(now, -60).toISOString(),
  },
]

export const mockOfferings = [
  {
    id: 'off-beratung',
    name: 'Beratung 60 Min',
    description: 'Persönliche Beratung vor Ort oder remote',
    duration_minutes: 60,
    capacity: 1,
    price_cents: 8900,
    color: '#2563EB',
    location_id: 'loc-berlin',
    organization_id: 'org-1',
    created_at: addDays(now, -50).toISOString(),
  },
  {
    id: 'off-service',
    name: 'Service 30 Min',
    description: 'Schneller Service-Termin',
    duration_minutes: 30,
    capacity: 1,
    price_cents: 4900,
    color: '#16A34A',
    location_id: 'loc-hamburg',
    organization_id: 'org-1',
    created_at: addDays(now, -45).toISOString(),
  },
  {
    id: 'off-gruppe',
    name: 'Gruppen-Termin 90 Min',
    description: 'Team-Workshop mit bis zu 6 Personen',
    duration_minutes: 90,
    capacity: 6,
    price_cents: 15900,
    color: '#F97316',
    location_id: 'loc-munich',
    organization_id: 'org-1',
    created_at: addDays(now, -40).toISOString(),
  },
]

export const mockStaff = [
  {
    id: 'staff-anna',
    name: 'Anna',
    color: '#8B5CF6',
  },
  {
    id: 'staff-marc',
    name: 'Marc',
    color: '#3B82F6',
  },
  {
    id: 'staff-sophie',
    name: 'Sophie',
    color: '#10B981',
  },
];

export const mockResources = [
  {
    id: 'res-anna',
    name: 'Anna Weber',
    type: 'staff',
    capacity: 1,
    location_id: 'loc-berlin',
    organization_id: 'org-1',
    created_at: addDays(now, -60).toISOString(),
  },
  {
    id: 'res-marc',
    name: 'Marc Bauer',
    type: 'staff',
    capacity: 1,
    location_id: 'loc-berlin',
    organization_id: 'org-1',
    created_at: addDays(now, -55).toISOString(),
  },
  {
    id: 'res-sophie',
    name: 'Sophie Klein',
    type: 'staff',
    capacity: 1,
    location_id: 'loc-hamburg',
    organization_id: 'org-1',
    created_at: addDays(now, -50).toISOString(),
  },
  {
    id: 'res-room-1',
    name: 'Raum 1',
    type: 'room',
    capacity: 4,
    location_id: 'loc-hamburg',
    organization_id: 'org-1',
    created_at: addDays(now, -55).toISOString(),
  },
  {
    id: 'res-equip-1',
    name: 'Equipment Set A',
    type: 'equipment',
    capacity: 2,
    location_id: 'loc-munich',
    organization_id: 'org-1',
    created_at: addDays(now, -52).toISOString(),
  },
]

export const mockBookings = [
  // Today bookings
  {
    id: 'book-001',
    start_time: addHours(now, 1).toISOString(),
    end_time: addHours(now, 2).toISOString(),
    status: 'confirmed',
    guest_name: 'Lena Hoffmann',
    service: 'Haircut',
    location_id: 'loc-berlin',
    staff_id: 'staff-anna',
  },
  {
    id: 'book-002',
    start_time: addHours(now, 3.5).toISOString(),
    end_time: addHours(now, 4.5).toISOString(),
    status: 'confirmed',
    guest_name: 'Tom Berger',
    service: 'Massage',
    location_id: 'loc-berlin',
    staff_id: 'staff-marc',
  },
  {
    id: 'book-003',
    start_time: addHours(now, 6).toISOString(),
    end_time: addHours(now, 7).toISOString(),
    status: 'pending',
    guest_name: 'Anna Schmidt',
    service: 'Konsultation',
    location_id: 'loc-berlin',
    staff_id: 'staff-sophie',
  },
  // Tomorrow bookings
  {
    id: 'book-004',
    start_time: addHours(addDays(now, 1), 8).toISOString(),
    end_time: addHours(addDays(now, 1), 9).toISOString(),
    status: 'confirmed',
    guest_name: 'Mara Klein',
    service: 'Haircut',
    location_id: 'loc-hamburg',
    staff_id: 'staff-anna',
  },
  {
    id: 'book-005',
    start_time: addHours(addDays(now, 1), 10).toISOString(),
    end_time: addHours(addDays(now, 1), 11.5).toISOString(),
    status: 'confirmed',
    guest_name: 'Jonas Köhler',
    service: 'Massage',
    location_id: 'loc-hamburg',
    staff_id: 'staff-sophie',
  },
  // Day 2
  {
    id: 'book-006',
    start_time: addHours(addDays(now, 2), 9).toISOString(),
    end_time: addHours(addDays(now, 2), 10).toISOString(),
    status: 'confirmed',
    guest_name: 'Peter Müller',
    service: 'Haircut',
    location_id: 'loc-munich',
    staff_id: 'staff-marc',
  },
  {
    id: 'book-007',
    start_time: addHours(addDays(now, 2), 14).toISOString(),
    end_time: addHours(addDays(now, 2), 15).toISOString(),
    status: 'confirmed',
    guest_name: 'Sophia Weber',
    service: 'Konsultation',
    location_id: 'loc-munich',
    staff_id: 'staff-anna',
  },
  {
    id: 'book-008',
    start_time: addHours(addDays(now, 2), 16).toISOString(),
    end_time: addHours(addDays(now, 2), 17.5).toISOString(),
    status: 'confirmed',
    guest_name: 'Klaus Fischer',
    service: 'Massage',
    location_id: 'loc-munich',
    staff_id: 'staff-sophie',
  },
  // Day 3
  {
    id: 'book-009',
    start_time: addHours(addDays(now, 3), 8.5).toISOString(),
    end_time: addHours(addDays(now, 3), 9.5).toISOString(),
    status: 'pending',
    guest_name: 'Iris Keller',
    service: 'Haircut',
    location_id: 'loc-berlin',
    staff_id: 'staff-anna',
  },
  {
    id: 'book-010',
    start_time: addHours(addDays(now, 3), 11).toISOString(),
    end_time: addHours(addDays(now, 3), 12.5).toISOString(),
    status: 'confirmed',
    guest_name: 'Marco Rossi',
    service: 'Massage',
    location_id: 'loc-berlin',
    staff_id: 'staff-marc',
  },
  // Day 4
  {
    id: 'book-011',
    start_time: addHours(addDays(now, 4), 10).toISOString(),
    end_time: addHours(addDays(now, 4), 11).toISOString(),
    status: 'confirmed',
    guest_name: 'Nina Bauer',
    service: 'Konsultation',
    location_id: 'loc-hamburg',
    staff_id: 'staff-sophie',
  },
  {
    id: 'book-012',
    start_time: addHours(addDays(now, 4), 15).toISOString(),
    end_time: addHours(addDays(now, 4), 16).toISOString(),
    status: 'confirmed',
    guest_name: 'Robert Schmidt',
    service: 'Haircut',
    location_id: 'loc-hamburg',
    staff_id: 'staff-anna',
  },
  // Day 5
  {
    id: 'book-013',
    start_time: addHours(addDays(now, 5), 9).toISOString(),
    end_time: addHours(addDays(now, 5), 10.5).toISOString(),
    status: 'confirmed',
    guest_name: 'Eva Richter',
    service: 'Massage',
    location_id: 'loc-munich',
    staff_id: 'staff-marc',
  },
  {
    id: 'book-014',
    start_time: addHours(addDays(now, 5), 13).toISOString(),
    end_time: addHours(addDays(now, 5), 14).toISOString(),
    status: 'confirmed',
    guest_name: 'Frank Wagner',
    service: 'Haircut',
    location_id: 'loc-munich',
    staff_id: 'staff-sophie',
  },
  {
    id: 'book-015',
    start_time: addHours(addDays(now, 5), 17).toISOString(),
    end_time: addHours(addDays(now, 5), 18).toISOString(),
    status: 'pending',
    guest_name: 'Greta Wolf',
    service: 'Konsultation',
    location_id: 'loc-munich',
    staff_id: 'staff-anna',
  },
  // Day 6 (Saturday)
  {
    id: 'book-016',
    start_time: addHours(addDays(now, 6), 10).toISOString(),
    end_time: addHours(addDays(now, 6), 11).toISOString(),
    status: 'confirmed',
    guest_name: 'Hans Meier',
    service: 'Haircut',
    location_id: 'loc-berlin',
    staff_id: 'staff-marc',
  },
]

export const mockBookingTrends = Array.from({ length: 14 }).map((_, idx) => {
  const date = addDays(now, -13 + idx)
  return {
    date,
    value: Math.max(2, Math.round(Math.sin(idx / 2) * 6 + 8 + (idx % 3) * 2)),
  }
})

export const mockTimezones = [
  'Europe/Berlin',
  'Europe/Vienna',
  'Europe/Zurich',
  'Europe/Paris',
  'Europe/Rome',
  'Europe/Amsterdam',
  'Europe/Stockholm',
  'Europe/Madrid',
  'Europe/London',
  'Europe/Dublin',
  'Europe/Oslo',
]
