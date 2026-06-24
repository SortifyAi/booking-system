// Domain Models (TypeScript types for API responses and business logic)

// Organization
export interface Organization {
  id: string
  name: string
  slug: string
  settings: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type UserRole = 'owner' | 'admin' | 'manager' | 'staff'

export interface UserOrganization {
  id: string
  userId: string
  organizationId: string
  role: UserRole
  createdAt: string
}

// Location/Branch
export interface Location {
  id: string
  organizationId: string
  name: string
  address: string | null
  timezone: string
  settings: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

// Offering/Service
export interface Offering {
  id: string
  organizationId: string
  locationId: string
  name: string
  description: string | null
  durationMinutes: number
  capacity: number
  priceCents: number | null
  color: string | null
  imageUrl?: string | null
  image_url?: string | null
  availableAsAddon?: boolean
  isStandaloneBookable: boolean
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Resource (staff, table, room, equipment)
export type ResourceType = 'staff' | 'table' | 'room' | 'equipment'

export interface Resource {
  id: string
  organizationId: string
  locationId: string
  name: string
  type: ResourceType
  capacity: number
  imageUrl?: string | null
  availableAsAddon?: boolean
  isStandaloneBookable?: boolean
  image_url?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Schedule (working hours)
export interface Schedule {
  id: string
  organizationId: string
  resourceId: string
  locationId: string
  dayOfWeek: number // 0-6 (Sunday-Saturday)
  startTime: string // HH:MM:SS
  endTime: string   // HH:MM:SS
  isActive: boolean
  createdAt: string
}

// Block (holidays, breaks, maintenance)
export type BlockType = 'holiday' | 'break' | 'maintenance' | 'other'

export interface Block {
  id: string
  organizationId: string
  resourceId: string | null
  locationId: string
  startTime: string // ISO 8601 timestamp
  endTime: string   // ISO 8601 timestamp
  reason: string | null
  type: BlockType
  createdAt: string
}

// Booking/Reservation
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'

export interface Booking {
  id: string
  organizationId: string
  locationId: string
  offeringId: string | null
  resourceId: string | null
  customerName: string
  customerEmail: string
  customerPhone: string | null
  startTime: string // ISO 8601 timestamp
  endTime: string   // ISO 8601 timestamp
  status: BookingStatus
  notes: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

// Audit Log
export interface AuditLog {
  id: string
  organizationId: string
  userId: string | null
  action: string
  entityType: string
  entityId: string | null
  changes: Record<string, unknown>
  createdAt: string
}

// Notification Log
export type NotificationType = 'confirmation' | 'reminder' | 'cancellation' | 'update'
export type NotificationChannel = 'email' | 'sms'
export type NotificationStatus = 'pending' | 'sent' | 'failed'

export interface NotificationLog {
  id: string
  organizationId: string
  bookingId: string | null
  type: NotificationType
  channel: NotificationChannel
  recipient: string
  status: NotificationStatus
  providerId: string | null
  error: string | null
  sentAt: string | null
  createdAt: string
}

// API Response Types

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// Request/Validation Types
export interface CreateLocationRequest {
  name: string
  address?: string
  timezone?: string
  settings?: Record<string, unknown>
}

export interface UpdateLocationRequest {
  name?: string
  address?: string
  timezone?: string
  settings?: Record<string, unknown>
}

export interface CreateOfferingRequest {
  organizationId: string
  locationId: string
  name: string
  description?: string
  durationMinutes: number
  capacity?: number
  priceCents?: number
  color?: string
  imageUrl?: string | null
}

export interface UpdateOfferingRequest {
  name?: string
  description?: string
  durationMinutes?: number
  capacity?: number
  priceCents?: number
  color?: string
  imageUrl?: string | null
  isActive?: boolean
  availableAsAddon?: boolean
  isStandaloneBookable?: boolean
}

export interface CreateResourceRequest {
  organizationId: string
  locationId: string
  name: string
  type: ResourceType
  capacity?: number
  imageUrl?: string | null
}

export interface UpdateResourceRequest {
  name?: string
  type?: ResourceType
  capacity?: number
  imageUrl?: string | null
  isActive?: boolean
}

export interface CreateScheduleRequest {
  resourceId: string
  locationId: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

export interface UpdateScheduleRequest {
  startTime?: string
  endTime?: string
  isActive?: boolean
}

export interface CreateBlockRequest {
  locationId: string
  resourceId?: string
  startTime: string
  endTime: string
  reason?: string
  type?: BlockType
}

export interface UpdateBlockRequest {
  reason?: string
  type?: BlockType
}

export interface CreateBookingRequest {
  organizationId?: string // Only required for staff
  locationId: string
  offeringId: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  startTime: string
  endTime: string
  notes?: string
}

export interface UpdateBookingRequest {
  startTime?: string
  endTime?: string
  status?: BookingStatus
  notes?: string
  customerName?: string
  customerEmail?: string
  customerPhone?: string
}

export interface AvailabilityRequest {
  locationId: string
  offeringId: string
  date: string // YYYY-MM-DD
  duration?: number // default from offering
}

export interface AvailabilitySlot {
  startTime: string // ISO 8601
  endTime: string   // ISO 8601
  available: boolean
  staffId?: string
  staffName?: string
  staffImageUrl?: string | null
}
