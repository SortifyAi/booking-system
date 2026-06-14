// @ts-nocheck
// Auto-generated Supabase types
// This file should be regenerated after running database migrations:
// npm run supabase:generate-types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          settings: Json
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          settings?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          settings?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_organizations: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_organizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_organizations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      locations: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          organization_id: string
          settings: Json
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id: string
          settings?: Json
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          settings?: Json
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      offerings: {
        Row: {
          capacity: number
          color: string | null
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          image_url: string | null
          is_active: boolean
          location_id: string
          name: string
          organization_id: string
          price_cents: number | null
          updated_at: string
        }
        Insert: {
          capacity?: number
          color?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          location_id: string
          name: string
          organization_id: string
          price_cents?: number | null
          updated_at?: string
        }
        Update: {
          capacity?: number
          color?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          location_id?: string
          name?: string
          organization_id?: string
          price_cents?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offerings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offerings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      resources: {
        Row: {
          capacity: number
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          location_id: string
          name: string
          organization_id: string
          type: string
          updated_at?: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          location_id: string
          name: string
          organization_id: string
          type: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          location_id?: string
          name?: string
          organization_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      schedules: {
        Row: {
          created_at: string
          day_of_week: number | null
          end_time: string
          id: string
          is_active: boolean
          location_id: string
          organization_id: string
          resource_id: string
          start_time: string
        }
        Insert: {
          created_at?: string
          day_of_week?: number | null
          end_time: string
          id?: string
          is_active?: boolean
          location_id: string
          organization_id: string
          resource_id: string
          start_time: string
        }
        Update: {
          created_at?: string
          day_of_week?: number | null
          end_time?: string
          id?: string
          is_active?: boolean
          location_id?: string
          organization_id?: string
          resource_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          }
        ]
      }
      blocks: {
        Row: {
          created_at: string
          end_time: string
          id: string
          location_id: string
          organization_id: string
          reason: string | null
          resource_id: string | null
          start_time: string
          type: string | null
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          location_id: string
          organization_id: string
          reason?: string | null
          resource_id?: string | null
          start_time: string
          type?: string | null
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          location_id?: string
          organization_id?: string
          reason?: string | null
          resource_id?: string | null
          start_time?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocks_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          }
        ]
      }
      bookings: {
        Row: {
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string | null
          end_time: string
          id: string
          location_id: string
          metadata: Json
          notes: string | null
          offering_id: string | null
          organization_id: string
          resource_id: string | null
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          end_time: string
          id?: string
          location_id: string
          metadata?: Json
          notes?: string | null
          offering_id?: string | null
          organization_id: string
          resource_id?: string | null
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          end_time?: string
          id?: string
          location_id?: string
          metadata?: Json
          notes?: string | null
          offering_id?: string | null
          organization_id?: string
          resource_id?: string | null
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          }
        ]
      }
      audit_logs: {
        Row: {
          action: string
          changes: Json
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          organization_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          organization_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          organization_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      notification_log: {
        Row: {
          booking_id: string | null
          channel: string
          created_at: string
          error: string | null
          id: string
          organization_id: string
          provider_id: string | null
          recipient: string
          sent_at: string | null
          status: string
          type: string
        }
        Insert: {
          booking_id?: string | null
          channel: string
          created_at?: string
          error?: string | null
          id?: string
          organization_id: string
          provider_id?: string | null
          recipient: string
          sent_at?: string | null
          status?: string
          type: string
        }
        Update: {
          booking_id?: string | null
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          organization_id?: string
          provider_id?: string | null
          recipient?: string
          sent_at?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {}
    Functions: {
      get_available_slots: {
        Args: {
          p_location_id: string
          p_offering_id: string
          p_date: string
          p_duration_minutes: number
        }
        Returns: {
          start_time: string
          end_time: string
        }[]
      }
      count_bookings_in_range: {
        Args: {
          p_resource_id: string
          p_start_time: string
          p_end_time: string
        }
        Returns: number
      }
    }
    Enums: {
      booking_status: "pending" | "confirmed" | "cancelled" | "completed" | "no_show"
      resource_type: "staff" | "table" | "room" | "equipment"
      user_role: "owner" | "admin" | "manager" | "staff"
    }
  }
}
