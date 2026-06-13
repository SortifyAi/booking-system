// @ts-nocheck
// Zod validation schemas for all API requests

import { z } from 'zod'

// ============================================================================
// LOCATION SCHEMAS
// ============================================================================

export const CreateLocationSchema = z.object({
  organizationId: z.string().uuid('Ungültige Organisations-ID'),
  name: z.string().min(1, 'Standortname ist erforderlich').max(255),
  address: z.string().max(500).optional(),
  timezone: z.string().default('Europe/Berlin'),
  settings: z.record(z.unknown()).optional(),
})

export const UpdateLocationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  address: z.string().max(500).optional(),
  timezone: z.string().optional(),
  settings: z.record(z.unknown()).optional(),
})

// ============================================================================
// OFFERING SCHEMAS
// ============================================================================

export const CreateOfferingSchema = z.object({
  organizationId: z.string().uuid('Ungültige Organisations-ID'),
  locationId: z.string().uuid('Ungültige Standort-ID'),
  name: z.string().min(1, 'Leistungsname ist erforderlich').max(255),
  description: z.string().max(1000).optional(),
  durationMinutes: z
    .number()
    .int('Dauer muss in Minuten angegeben werden')
    .positive('Dauer muss positiv sein')
    .default(60),
  capacity: z.number().int().positive().default(1),
  priceCents: z.number().int().nonnegative('Preis darf nicht negativ sein').optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Ungültiges Farbformat').optional(),
})

export const UpdateOfferingSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  durationMinutes: z.number().int().positive().optional(),
  capacity: z.number().int().positive().optional(),
  priceCents: z.number().int().nonnegative().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  isActive: z.boolean().optional(),
})

// ============================================================================
// RESOURCE SCHEMAS
// ============================================================================

export const CreateResourceSchema = z.object({
  organizationId: z.string().uuid('Ungültige Organisations-ID'),
  locationId: z.string().uuid('Ungültige Standort-ID'),
  name: z.string().min(1, 'Ressourcenname ist erforderlich').max(255),
  type: z.enum(['staff', 'table', 'room', 'equipment']),
  capacity: z.number().int().positive('Kapazität muss positiv sein').default(1),
  imageUrl: z.string().nullable().optional(),
})

export const UpdateResourceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.enum(['staff', 'table', 'room', 'equipment']).optional(),
  capacity: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  imageUrl: z.string().nullable().optional(),
})

// ============================================================================
// SCHEDULE SCHEMAS
// ============================================================================

const TimeFormatRegex = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

export const CreateScheduleSchema = z.object({
  organizationId: z.string().uuid(),
  locationId: z.string().uuid(),
  resourceId: z.string().uuid(),
  dayOfWeek: z.number().int().min(0).max(6, 'Wochentag muss 0-6 sein'),
  startTime: z.string().regex(TimeFormatRegex, 'Ungültiges Zeitformat (HH:MM:SS)'),
  endTime: z.string().regex(TimeFormatRegex, 'Ungültiges Zeitformat (HH:MM:SS)'),
}).refine(data => data.startTime < data.endTime, {
  message: 'Startzeit muss vor Endzeit liegen',
  path: ['endTime'],
})

export const UpdateScheduleSchema = z.object({
  startTime: z.string().regex(TimeFormatRegex).optional(),
  endTime: z.string().regex(TimeFormatRegex).optional(),
  isActive: z.boolean().optional(),
})

// ============================================================================
// BLOCK SCHEMAS
// ============================================================================

export const CreateBlockSchema = z.object({
  organizationId: z.string().uuid(),
  locationId: z.string().uuid(),
  resourceId: z.string().uuid().optional(),
  startTime: z.string().datetime('Ungültiges Datumsformat'),
  endTime: z.string().datetime('Ungültiges Datumsformat'),
  reason: z.string().max(500).optional(),
  type: z.enum(['holiday', 'break', 'maintenance', 'other']).optional(),
}).refine(data => new Date(data.startTime) < new Date(data.endTime), {
  message: 'Startzeit muss vor Endzeit liegen',
  path: ['endTime'],
})

export const UpdateBlockSchema = z.object({
  reason: z.string().max(500).optional(),
  type: z.enum(['holiday', 'break', 'maintenance', 'other']).optional(),
})

// ============================================================================
// BOOKING SCHEMAS
// ============================================================================

export const CreateBookingSchema = z.object({
  organizationId: z.string().uuid().optional(),
  locationId: z.string().uuid('Ungültige Standort-ID'),
  offeringId: z.string().uuid('Ungültige Leistungs-ID'),
  customerName: z.string().min(1, 'Kundenname ist erforderlich').max(255),
  customerEmail: z.string().email('Ungültige E-Mail-Adresse'),
  customerPhone: z.string().max(20).optional(),
  startTime: z.string().datetime('Ungültiges Datumsformat'),
  endTime: z.string().datetime('Ungültiges Datumsformat'),
  notes: z.string().max(1000).optional(),
}).refine(data => new Date(data.startTime) < new Date(data.endTime), {
  message: 'Startzeit muss vor Endzeit liegen',
  path: ['endTime'],
})

export const UpdateBookingSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed', 'no_show']).optional(),
  notes: z.string().max(1000).optional(),
  customerName: z.string().min(1).max(255).optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().max(20).optional(),
})

// ============================================================================
// AVAILABILITY SCHEMAS
// ============================================================================

export const AvailabilitySchema = z.object({
  locationId: z.string().uuid('Ungültige Standort-ID'),
  offeringId: z.string().uuid('Ungültige Leistungs-ID'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datumsformat muss YYYY-MM-DD sein'),
  duration: z.number().int().positive().optional(),
})

// Type inference
export type CreateLocationInput = z.infer<typeof CreateLocationSchema>
export type UpdateLocationInput = z.infer<typeof UpdateLocationSchema>
export type CreateOfferingInput = z.infer<typeof CreateOfferingSchema>
export type UpdateOfferingInput = z.infer<typeof UpdateOfferingSchema>
export type CreateResourceInput = z.infer<typeof CreateResourceSchema>
export type UpdateResourceInput = z.infer<typeof UpdateResourceSchema>
export type CreateScheduleInput = z.infer<typeof CreateScheduleSchema>
export type UpdateScheduleInput = z.infer<typeof UpdateScheduleSchema>
export type CreateBlockInput = z.infer<typeof CreateBlockSchema>
export type UpdateBlockInput = z.infer<typeof UpdateBlockSchema>
export type CreateBookingInput = z.infer<typeof CreateBookingSchema>
export type UpdateBookingInput = z.infer<typeof UpdateBookingSchema>
export type AvailabilityInput = z.infer<typeof AvailabilitySchema>
