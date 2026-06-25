// @ts-nocheck
'use client';

import * as React from 'react';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  DEFAULT_TIMEZONE,
  zonedTimeToUtc,
  formatTimeInTimeZone,
  formatDateInTimeZone,
} from '@/lib/timezone';
import { toast } from 'sonner';
import { CalendarContainer } from '@/components/CalendarContainer';
import { isMockMode } from '@/lib/utils/mock';
import { mockBookings, mockLocations, mockOfferings, mockStaff } from '@/lib/mock-data';
import { Calendar as CalendarIcon, Phone, Mail, Clock, User, Briefcase, Trash2, Edit2, Lock, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  CalendarBooking,
  CalendarBlock,
  CalendarStaffMember,
  normalizeCalendarBooking,
  normalizeCalendarBlock,
  blockTypeLabels,
} from '@/lib/calendar-admin';

interface Location {
  id: string;
  name: string;
  organization_id?: string;
  timezone?: string | null;
  settings?: {
    openingHours?: Array<{
      day: number;
      open: string;
      close: string;
      closed?: boolean;
    }>;
  } | null;
}

interface Offering {
  id: string;
  name: string;
  duration_minutes: number;
  location_id?: string;
}

const staffColorPalette = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatTimeInput = (date: Date) => {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

/**
 * Turn a `YYYY-MM-DD` date + `HH:mm` time the operator typed into the absolute
 * UTC instant it represents in the location's timezone. Using `new Date(...)`
 * would interpret the wall-clock in the operator's *device* timezone, so a
 * laptop set to UTC would store "12:00" as 12:00Z (= 14:00 in Berlin).
 */
const wallClockToUtcIso = (dateStr: string, timeStr: string, timeZone: string) => {
  const [hour, minute] = timeStr.split(':').map(Number);
  return zonedTimeToUtc(dateStr, hour || 0, minute || 0, timeZone).toISOString();
};

export default function CalendarPage() {
  const [viewMode, setViewMode] = React.useState<'week' | 'day'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<CalendarBooking[]>([]);
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'booking' | 'block'>('booking');
  const [detailBookingId, setDetailBookingId] = useState<string | null>(null);
  const [customerHistory, setCustomerHistory] = useState({
    loading: false,
    noShowCount: 0,
    isBlocked: false,
    canManageBlock: false,
  });
  const [detailBlockId, setDetailBlockId] = useState<string | null>(null);
  const [isEditingBooking, setIsEditingBooking] = useState(false);
  const [newBlock, setNewBlock] = useState({
    staff_id: '',
    location_id: '',
    date: '',
    time: '',
    duration_minutes: 60,
    type: 'other',
    reason: '',
  });
  const [editBooking, setEditBooking] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    location_id: '',
    offering_id: '',
    service: '',
    staff_id: '',
    date: '',
    time: '',
    duration_minutes: 60,
    notes: '',
    status: 'confirmed',
  });
  const [quickCreateData, setQuickCreateData] = useState<{
    date: Date;
    hour: number;
    minute: number;
    staffId?: string;
  } | null>(null);
  const [newBooking, setNewBooking] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    location_id: '',
    offering_id: '',
    service: '',
    staff_id: '',
    date: '',
    time: '',
    duration_minutes: 60,
    notes: '',
    status: 'confirmed',
  });
  const [staffMembers, setStaffMembers] = useState<CalendarStaffMember[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const supabase = React.useMemo(() => createClient(), []);

  const loadCalendarData = useCallback(async () => {
    try {
      setLoading(true);

      if (isMockMode()) {
        const mockCalendarStaff = mockStaff.map((staff) => ({
          id: staff.id,
          name: staff.name,
          color: staff.color,
        }));

        setStaffMembers(mockCalendarStaff);
        setLocations(mockLocations.map(({ id, name, organization_id, timezone, settings }) => ({
          id,
          name,
          organization_id,
          timezone,
          settings,
        })));
        setOfferings(mockOfferings.map(({ id, name, duration_minutes, location_id }) => ({
          id,
          name,
          duration_minutes,
          location_id,
        })));
        setBookings(mockBookings.map((booking) => normalizeCalendarBooking(booking, mockCalendarStaff)));
        setBlocks([]);
        return;
      }

      const [staffData, locationsData, offeringsData, bookingsData, blocksData] = await Promise.all([
        supabase
          .from('resources')
          .select('id, name, type')
          .eq('type', 'staff')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('locations')
          .select('id, name, organization_id, timezone, settings')
          .order('name'),
        supabase
          .from('offerings')
          .select('id, name, duration_minutes, location_id')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('bookings')
          .select('*, offerings(name), resources(id, name)')
          .in('status', ['pending', 'confirmed'])
          .order('start_time', { ascending: true }),
        supabase
          .from('blocks')
          .select('*')
          .order('start_time', { ascending: true }),
      ]);

      if (staffData.error) throw staffData.error;
      if (locationsData.error) throw locationsData.error;
      if (offeringsData.error) throw offeringsData.error;
      if (bookingsData.error) throw bookingsData.error;
      if (blocksData.error) throw blocksData.error;

      const calendarStaff = (staffData.data || []).map((resource, idx) => ({
        id: resource.id,
        name: resource.name,
        color: staffColorPalette[idx % staffColorPalette.length],
      }));

      setStaffMembers(calendarStaff);
      setLocations(locationsData.data || []);
      setOfferings(offeringsData.data || []);
      setBookings((bookingsData.data || []).map((booking) => normalizeCalendarBooking(booking, calendarStaff)));
      setBlocks((blocksData.data || []).map((block) => normalizeCalendarBlock(block, calendarStaff)));
    } catch (error) {
      console.error('Calendar load error:', error);
      toast.error('Kalenderdaten konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData]);

  const filteredBookings = selectedStaff === 'all'
    ? bookings
    : bookings.filter((booking) => booking.staff_id === selectedStaff);

  const filteredBlocks = selectedStaff === 'all'
    ? blocks
    : blocks.filter((block) => {
        const blockStaffId = block.resource_id || block.staff_id;
        return !blockStaffId || blockStaffId === selectedStaff;
      });

  const handleQuickCreate = (date: Date, hour: number, minute: number, staffId?: string) => {
    const selectedDate = new Date(date);
    selectedDate.setHours(hour, minute, 0, 0);

    const defaultOffering = offerings[0];
    const defaultDuration = defaultOffering?.duration_minutes || 60;
    const defaultLocationId = defaultOffering?.location_id || locations[0]?.id || '';
    const slotEndTime = new Date(selectedDate.getTime() + defaultDuration * 60000);
    const hasConflict = (memberId: string) => bookings.some((booking) => {
      const bookingStaffId = booking.staff_id || booking.resource_id;
      const bookingStart = new Date(booking.start_time);
      const bookingEnd = new Date(booking.end_time);

      return bookingStaffId === memberId
        && selectedDate < bookingEnd
        && bookingStart < slotEndTime;
    });
    const firstAvailableStaff = staffMembers.find((staff) => !hasConflict(staff.id));
    const defaultStaffId = staffId
      || (selectedStaff !== 'all' ? selectedStaff : firstAvailableStaff?.id || staffMembers[0]?.id || '');

    setQuickCreateData({ date: selectedDate, hour, minute, staffId: defaultStaffId });
    setCreateMode('booking');
    setNewBooking({
      customer_name: '',
      customer_email: '',
      customer_phone: '',
      location_id: defaultLocationId,
      offering_id: defaultOffering?.id || '',
      service: defaultOffering?.name || '',
      staff_id: defaultStaffId,
      date: formatDateInput(selectedDate),
      time: formatTimeInput(selectedDate),
      duration_minutes: defaultDuration,
      notes: '',
      status: 'confirmed',
    });
    setNewBlock({
      staff_id: defaultStaffId,
      location_id: defaultLocationId,
      date: formatDateInput(selectedDate),
      time: formatTimeInput(selectedDate),
      duration_minutes: 60,
      type: 'other',
      reason: '',
    });
    setIsModalOpen(true);
  };

  const handleOfferingChange = (offeringId: string) => {
    const offering = offerings.find((item) => item.id === offeringId);
    setNewBooking((prev) => ({
      ...prev,
      offering_id: offeringId,
      service: offering?.name || prev.service,
      location_id: offering?.location_id || prev.location_id,
      duration_minutes: offering?.duration_minutes || prev.duration_minutes,
    }));
  };

  const handleSaveQuickBooking = async () => {
    if (!newBooking.customer_name || !newBooking.date || !newBooking.time) {
      toast.error('Bitte Name, Datum und Uhrzeit ausfüllen');
      return;
    }

    if (!newBooking.staff_id) {
      toast.error('Bitte Mitarbeiter auswählen');
      return;
    }

    if (!newBooking.location_id) {
      toast.error('Bitte Standort auswählen');
      return;
    }

    if (!newBooking.offering_id && !newBooking.service) {
      toast.error('Bitte Leistung auswählen oder eintragen');
      return;
    }

    const staff = staffMembers.find((member) => member.id === newBooking.staff_id);
    const offering = offerings.find((item) => item.id === newBooking.offering_id);
    const location = locations.find((item) => item.id === newBooking.location_id);
    const tz = location?.timezone || DEFAULT_TIMEZONE;
    const startTime = new Date(wallClockToUtcIso(newBooking.date, newBooking.time, tz));
    const endTime = new Date(startTime.getTime() + newBooking.duration_minutes * 60000);

    setSubmitting(true);
    try {
      if (isMockMode()) {
        const newBookingEntry: CalendarBooking = {
          id: `book-${Date.now()}`,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          guest_name: newBooking.customer_name,
          service: offering?.name || newBooking.service,
          status: newBooking.status,
          location_id: newBooking.location_id,
          offering_id: newBooking.offering_id || null,
          resource_id: newBooking.staff_id,
          staff_id: newBooking.staff_id,
          staff_name: staff?.name,
          staff_color: staff?.color,
        };

        setBookings((prev) => [...prev, newBookingEntry]);
        toast.success('Termin wurde erstellt');
        setIsModalOpen(false);
        setQuickCreateData(null);
        return;
      }

      if (!location?.organization_id) {
        toast.error('Organisation für den Standort fehlt');
        return;
      }

      const { data, error } = await supabase
        .from('bookings')
        .insert({
          organization_id: location.organization_id,
          location_id: newBooking.location_id,
          offering_id: newBooking.offering_id || null,
          resource_id: newBooking.staff_id,
          customer_name: newBooking.customer_name,
          customer_email: newBooking.customer_email || '',
          customer_phone: newBooking.customer_phone || null,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          status: newBooking.status,
          notes: newBooking.notes || null,
          metadata: { createdFrom: 'admin-calendar' },
        })
        .select('*, offerings(name), resources(id, name)')
        .single();

      if (error) throw error;

      setBookings((prev) => [...prev, normalizeCalendarBooking(data, staffMembers)]);
      toast.success('Termin wurde erstellt');
      setIsModalOpen(false);
      setQuickCreateData(null);
    } catch (error) {
      console.error('Calendar booking create error:', error);
      toast.error('Termin konnte nicht erstellt werden');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveQuickBlock = async () => {
    if (!newBlock.staff_id) {
      toast.error('Bitte Mitarbeiter auswählen');
      return;
    }

    if (!newBlock.date || !newBlock.time) {
      toast.error('Bitte Datum und Uhrzeit ausfüllen');
      return;
    }

    const staff = staffMembers.find((member) => member.id === newBlock.staff_id);
    const location = locations.find((item) => item.id === newBlock.location_id) || locations[0];
    const tz = location?.timezone || DEFAULT_TIMEZONE;
    const isFullDay = newBlock.duration_minutes >= 1440;
    const startTime = isFullDay
      ? new Date(wallClockToUtcIso(newBlock.date, '00:00', tz))
      : new Date(wallClockToUtcIso(newBlock.date, newBlock.time, tz));
    const endTime = isFullDay
      ? new Date(wallClockToUtcIso(newBlock.date, '23:59', tz))
      : new Date(startTime.getTime() + newBlock.duration_minutes * 60000);

    setSubmitting(true);
    try {
      if (isMockMode()) {
        const newBlockEntry: CalendarBlock = {
          id: `block-${Date.now()}`,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          location_id: location?.id || null,
          resource_id: newBlock.staff_id,
          staff_id: newBlock.staff_id,
          staff_name: staff?.name,
          staff_color: staff?.color,
          reason: newBlock.reason || null,
          type: newBlock.type,
        };

        setBlocks((prev) => [...prev, newBlockEntry]);
        toast.success('Blocker wurde erstellt');
        setIsModalOpen(false);
        setQuickCreateData(null);
        return;
      }

      if (!location?.organization_id) {
        toast.error('Organisation für den Standort fehlt');
        return;
      }

      const { data, error } = await supabase
        .from('blocks')
        .insert({
          organization_id: location.organization_id,
          location_id: location.id,
          resource_id: newBlock.staff_id,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          reason: newBlock.reason || null,
          type: newBlock.type,
        })
        .select()
        .single();

      if (error) throw error;

      setBlocks((prev) => [...prev, normalizeCalendarBlock(data, staffMembers)]);
      toast.success('Blocker wurde erstellt');
      setIsModalOpen(false);
      setQuickCreateData(null);
    } catch (error) {
      console.error('Calendar block create error:', error);
      toast.error('Blocker konnte nicht erstellt werden');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    const existing = blocks.find((block) => block.id === blockId);
    if (!existing) return;
    if (!confirm('Diesen Blocker wirklich entfernen?')) return;

    setBlocks((prev) => prev.filter((block) => block.id !== blockId));
    setDetailBlockId(null);

    if (isMockMode()) {
      toast.success('Blocker entfernt');
      return;
    }

    try {
      const { error } = await supabase.from('blocks').delete().eq('id', blockId);
      if (error) throw error;
      toast.success('Blocker entfernt');
    } catch (error) {
      console.error('Block delete error:', error);
      setBlocks((prev) => [...prev, existing]);
      toast.error('Blocker konnte nicht entfernt werden');
    }
  };

  const handleBookingMove = async (
    bookingId: string,
    newStart: Date,
    newEnd: Date,
    newStaffId?: string,
  ) => {
    const existing = bookings.find((booking) => booking.id === bookingId);
    if (!existing) return;

    const newStaff = newStaffId
      ? staffMembers.find((member) => member.id === newStaffId)
      : undefined;

    const optimistic: CalendarBooking = {
      ...existing,
      start_time: newStart.toISOString(),
      end_time: newEnd.toISOString(),
      ...(newStaffId
        ? {
            resource_id: newStaffId,
            staff_id: newStaffId,
            staff_name: newStaff?.name ?? existing.staff_name,
            staff_color: newStaff?.color ?? existing.staff_color,
          }
        : {}),
    };

    // Optimistic update
    setBookings((prev) => prev.map((booking) => (booking.id === bookingId ? optimistic : booking)));

    if (isMockMode()) {
      toast.success('Termin verschoben');
      return;
    }

    try {
      const updatePayload: Record<string, unknown> = {
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
      };
      if (newStaffId) updatePayload.resource_id = newStaffId;

      const { error } = await supabase
        .from('bookings')
        .update(updatePayload)
        .eq('id', bookingId);

      if (error) throw error;
      toast.success('Termin verschoben');
    } catch (error) {
      console.error('Booking move error:', error);
      // revert on failure
      setBookings((prev) => prev.map((booking) => (booking.id === bookingId ? existing : booking)));
      toast.error('Termin konnte nicht verschoben werden');
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    const existing = bookings.find((booking) => booking.id === bookingId);
    if (!existing) return;
    if (!confirm('Diesen Termin wirklich absagen?')) return;

    setBookings((prev) => prev.filter((booking) => booking.id !== bookingId));
    setDetailBookingId(null);

    if (isMockMode()) {
      toast.success('Termin abgesagt');
      return;
    }

    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId);
      if (error) throw error;
      toast.success('Termin abgesagt');
    } catch (error) {
      console.error('Booking cancel error:', error);
      setBookings((prev) => [...prev, existing].sort((a, b) => a.start_time.localeCompare(b.start_time)));
      toast.error('Termin konnte nicht abgesagt werden');
    }
  };

  const detailBooking = bookings.find((booking) => booking.id === detailBookingId) || null;
  const detailBlock = blocks.find((block) => block.id === detailBlockId) || null;

  useEffect(() => {
    if (!detailBookingId) {
      setCustomerHistory({ loading: false, noShowCount: 0, isBlocked: false, canManageBlock: false });
      return;
    }
    if (isMockMode()) {
      setCustomerHistory({ loading: false, noShowCount: 0, isBlocked: false, canManageBlock: false });
      return;
    }

    let cancelled = false;
    setCustomerHistory({ loading: true, noShowCount: 0, isBlocked: false, canManageBlock: false });
    fetch(`/api/customer-email-history/${detailBookingId}`)
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Kundenhistorie konnte nicht geladen werden');
        if (!cancelled) {
          setCustomerHistory({
            loading: false,
            noShowCount: result.noShowCount || 0,
            isBlocked: Boolean(result.isBlocked),
            canManageBlock: Boolean(result.canManageBlock),
          });
        }
      })
      .catch((error) => {
        console.error('Customer history load error:', error);
        if (!cancelled) {
          setCustomerHistory({ loading: false, noShowCount: 0, isBlocked: false, canManageBlock: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [detailBookingId]);

  const handleMarkNoShow = async () => {
    if (!detailBooking) return;
    if (!confirm('Diesen Termin als „Nicht erschienen“ markieren?')) return;

    setSubmitting(true);
    try {
      if (isMockMode()) {
        setBookings((prev) => prev.map((booking) =>
          booking.id === detailBooking.id ? { ...booking, status: 'no_show' } : booking
        ));
        setCustomerHistory((prev) => ({ ...prev, noShowCount: prev.noShowCount + 1 }));
        toast.success('Termin als nicht erschienen markiert');
        return;
      }

      const response = await fetch(`/api/bookings/${detailBooking.id}/no-show`, { method: 'POST' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Termin konnte nicht aktualisiert werden');

      const changedIds = new Set<string>(result.changedIds || [detailBooking.id]);
      setBookings((prev) => prev.map((booking) =>
        changedIds.has(booking.id) ? { ...booking, status: 'no_show' } : booking
      ));
      setCustomerHistory((prev) => ({ ...prev, noShowCount: result.noShowCount || 1 }));
      toast.success('Termin als nicht erschienen markiert');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Termin konnte nicht aktualisiert werden');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBlockCustomer = async () => {
    if (!detailBooking?.organization_id || !detailBooking.customer_email) return;
    if (!confirm(`${detailBooking.customer_email} salonweit für Online-Buchungen sperren?`)) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/customer-email-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: detailBooking.organization_id,
          email: detailBooking.customer_email,
          reason: `${customerHistory.noShowCount} Fehltermin(e)`,
          sourceBookingId: detailBooking.id,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Kunde konnte nicht gesperrt werden');
      setCustomerHistory((prev) => ({ ...prev, isBlocked: true }));
      toast.success('Kunde wurde salonweit gesperrt');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kunde konnte nicht gesperrt werden');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = () => {
    if (!detailBooking) return;

    const start = new Date(detailBooking.start_time);
    const end = new Date(detailBooking.end_time);
    const durationMinutes = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));

    setEditBooking({
      customer_name: detailBooking.guest_name || '',
      customer_email: detailBooking.customer_email || '',
      customer_phone: detailBooking.customer_phone || '',
      location_id: detailBooking.location_id || '',
      offering_id: detailBooking.offering_id || '',
      service: detailBooking.service || '',
      staff_id: detailBooking.staff_id || detailBooking.resource_id || '',
      date: formatDateInput(start),
      time: formatTimeInput(start),
      duration_minutes: durationMinutes,
      notes: detailBooking.notes || '',
      status: detailBooking.status,
    });
    setIsEditingBooking(true);
  };

  const handleEditOfferingChange = (offeringId: string) => {
    const offering = offerings.find((item) => item.id === offeringId);
    setEditBooking((prev) => ({
      ...prev,
      offering_id: offeringId,
      service: offering?.name || prev.service,
      location_id: offering?.location_id || prev.location_id,
      duration_minutes: offering?.duration_minutes || prev.duration_minutes,
    }));
  };

  const handleSaveBookingEdit = async () => {
    if (!detailBooking) return;

    if (!editBooking.customer_name || !editBooking.date || !editBooking.time) {
      toast.error('Bitte Name, Datum und Uhrzeit ausfüllen');
      return;
    }

    if (!editBooking.staff_id) {
      toast.error('Bitte Mitarbeiter auswählen');
      return;
    }

    if (!editBooking.location_id) {
      toast.error('Bitte Standort auswählen');
      return;
    }

    if (!editBooking.offering_id && !editBooking.service) {
      toast.error('Bitte Leistung auswählen oder eintragen');
      return;
    }

    const staff = staffMembers.find((member) => member.id === editBooking.staff_id);
    const offering = offerings.find((item) => item.id === editBooking.offering_id);
    const editLocation = locations.find((item) => item.id === editBooking.location_id);
    const editTz = editLocation?.timezone || DEFAULT_TIMEZONE;
    const startTime = new Date(wallClockToUtcIso(editBooking.date, editBooking.time, editTz));
    const endTime = new Date(startTime.getTime() + editBooking.duration_minutes * 60000);
    const existing = detailBooking;

    setSubmitting(true);
    try {
      if (isMockMode()) {
        const updated: CalendarBooking = {
          ...existing,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          guest_name: editBooking.customer_name,
          service: offering?.name || editBooking.service,
          status: editBooking.status,
          location_id: editBooking.location_id,
          offering_id: editBooking.offering_id || null,
          resource_id: editBooking.staff_id,
          staff_id: editBooking.staff_id,
          staff_name: staff?.name,
          staff_color: staff?.color,
          customer_email: editBooking.customer_email || null,
          customer_phone: editBooking.customer_phone || null,
          notes: editBooking.notes || null,
        };

        setBookings((prev) => prev.map((booking) => (booking.id === existing.id ? updated : booking)));
        toast.success('Termin wurde aktualisiert');
        setIsEditingBooking(false);
        return;
      }

      const { data, error } = await supabase
        .from('bookings')
        .update({
          customer_name: editBooking.customer_name,
          customer_email: editBooking.customer_email || '',
          customer_phone: editBooking.customer_phone || null,
          location_id: editBooking.location_id,
          offering_id: editBooking.offering_id || null,
          resource_id: editBooking.staff_id,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          status: editBooking.status,
          notes: editBooking.notes || null,
        })
        .eq('id', existing.id)
        .select('*, offerings(name), resources(id, name)')
        .single();

      if (error) throw error;

      setBookings((prev) => prev.map((booking) => (booking.id === existing.id ? normalizeCalendarBooking(data, staffMembers) : booking)));
      toast.success('Termin wurde aktualisiert');
      setIsEditingBooking(false);
    } catch (error) {
      console.error('Booking update error:', error);
      toast.error('Termin konnte nicht aktualisiert werden');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-8 sm:p-12 text-center shadow-sm">
        <CalendarIcon className="h-8 w-8 text-gray-400 dark:text-slate-600 mx-auto mb-2 animate-pulse" />
        <p className="text-gray-600 dark:text-slate-400">Kalender wird geladen...</p>
      </div>
    );
  }

  return (
    <>
      <CalendarContainer
        view={viewMode}
        onViewChange={setViewMode}
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        bookings={filteredBookings}
        blocks={filteredBlocks}
        openingHours={locations.flatMap((location) => location.settings?.openingHours || [])}
        selectedStaff={selectedStaff}
        onStaffChange={setSelectedStaff}
        staffMembers={staffMembers}
        onTimeSlotClick={handleQuickCreate}
        onBookingMove={handleBookingMove}
        onBookingClick={(id) => setDetailBookingId(id)}
        onBlockClick={(id) => setDetailBlockId(id)}
      />

      {/* Booking detail modal (shows customer contact incl. phone) */}
      <Dialog
        open={!!detailBooking}
        onOpenChange={(open) => {
          if (!open) {
            setDetailBookingId(null);
            setIsEditingBooking(false);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{isEditingBooking ? 'Termin bearbeiten' : (detailBooking?.guest_name || 'Termin')}</DialogTitle>
            {!isEditingBooking && (
              <DialogDescription>
                {detailBooking &&
                  formatDateInTimeZone(detailBooking.start_time)}
              </DialogDescription>
            )}
          </DialogHeader>

          {detailBooking && !isEditingBooking && (
            <div className="space-y-3 py-2 text-sm">
              <div className="flex items-center gap-2 text-gray-700 dark:text-slate-300">
                <Clock className="h-4 w-4 flex-shrink-0 text-gray-400" />
                {formatTimeInTimeZone(detailBooking.start_time)}
                {' – '}
                {formatTimeInTimeZone(detailBooking.end_time)} Uhr
              </div>

              {detailBooking.service && (
                <div className="flex items-center gap-2 text-gray-700 dark:text-slate-300">
                  <Briefcase className="h-4 w-4 flex-shrink-0 text-gray-400" />
                  {detailBooking.service}
                </div>
              )}

              {detailBooking.staff_name && (
                <div className="flex items-center gap-2 text-gray-700 dark:text-slate-300">
                  <User className="h-4 w-4 flex-shrink-0 text-gray-400" />
                  {detailBooking.staff_name}
                </div>
              )}

              <div className="border-t border-gray-100 pt-3 dark:border-slate-800">
                {detailBooking.customer_phone ? (
                  <a
                    href={`tel:${detailBooking.customer_phone}`}
                    className="flex items-center gap-2 py-1 text-gray-700 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
                  >
                    <Phone className="h-4 w-4 flex-shrink-0 text-gray-400" />
                    {detailBooking.customer_phone}
                  </a>
                ) : (
                  <div className="flex items-center gap-2 py-1 text-gray-400 dark:text-slate-500">
                    <Phone className="h-4 w-4 flex-shrink-0" />
                    Keine Telefonnummer angegeben
                  </div>
                )}

                {detailBooking.customer_email && (
                  <a
                    href={`mailto:${detailBooking.customer_email}`}
                    className="flex items-center gap-2 py-1 text-gray-700 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
                  >
                    <Mail className="h-4 w-4 flex-shrink-0 text-gray-400" />
                    {detailBooking.customer_email}
                  </a>
                )}
              </div>

              {detailBooking.notes && (
                <div className="rounded-md bg-gray-50 p-3 text-gray-600 dark:bg-slate-800/60 dark:text-slate-400">
                  {detailBooking.notes}
                </div>
              )}

              {customerHistory.loading ? (
                <div className="rounded-md bg-gray-50 p-3 text-gray-500 dark:bg-slate-800/60 dark:text-slate-400">
                  Kundenhistorie wird geladen…
                </div>
              ) : customerHistory.noShowCount > 0 ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  Bereits {customerHistory.noShowCount}-mal nicht erschienen.
                </div>
              ) : null}

              {customerHistory.isBlocked && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                  Diese E-Mail-Adresse ist salonweit gesperrt.
                </div>
              )}
            </div>
          )}

          {detailBooking && isEditingBooking && (
            <div className="space-y-4 py-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Kunde *
                </label>
                <Input
                  placeholder="Name des Kunden"
                  value={editBooking.customer_name}
                  onChange={(e) => setEditBooking((prev) => ({ ...prev, customer_name: e.target.value }))}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Datum *
                  </label>
                  <Input
                    type="date"
                    value={editBooking.date}
                    onChange={(e) => setEditBooking((prev) => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Uhrzeit *
                  </label>
                  <Input
                    type="time"
                    value={editBooking.time}
                    onChange={(e) => setEditBooking((prev) => ({ ...prev, time: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Leistung *
                  </label>
                  {offerings.length > 0 ? (
                    <select
                      value={editBooking.offering_id}
                      onChange={(e) => handleEditOfferingChange(e.target.value)}
                      className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      {!editBooking.offering_id && <option value="">{editBooking.service || 'Leistung wählen...'}</option>}
                      {offerings.map((offering) => (
                        <option key={offering.id} value={offering.id}>
                          {offering.name} ({offering.duration_minutes} Min.)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      placeholder="z.B. Beratung"
                      value={editBooking.service}
                      onChange={(e) => setEditBooking((prev) => ({ ...prev, service: e.target.value }))}
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Dauer
                  </label>
                  <select
                    value={editBooking.duration_minutes}
                    onChange={(e) => setEditBooking((prev) => ({ ...prev, duration_minutes: Number(e.target.value) }))}
                    className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value={30}>30 Min.</option>
                    <option value={45}>45 Min.</option>
                    <option value={60}>60 Min.</option>
                    <option value={90}>90 Min.</option>
                    <option value={120}>120 Min.</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Mitarbeiter *
                  </label>
                  <select
                    value={editBooking.staff_id}
                    onChange={(e) => setEditBooking((prev) => ({ ...prev, staff_id: e.target.value }))}
                    className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="" disabled>Mitarbeiter wählen...</option>
                    {staffMembers.map((staff) => (
                      <option key={staff.id} value={staff.id}>{staff.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Standort *
                  </label>
                  <select
                    value={editBooking.location_id}
                    onChange={(e) => setEditBooking((prev) => ({ ...prev, location_id: e.target.value }))}
                    className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="" disabled>Standort wählen...</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>{location.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    E-Mail
                  </label>
                  <Input
                    type="email"
                    placeholder="optional"
                    value={editBooking.customer_email}
                    onChange={(e) => setEditBooking((prev) => ({ ...prev, customer_email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Telefon
                  </label>
                  <Input
                    type="tel"
                    placeholder="optional"
                    value={editBooking.customer_phone}
                    onChange={(e) => setEditBooking((prev) => ({ ...prev, customer_phone: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={editBooking.status}
                  onChange={(e) => setEditBooking((prev) => ({ ...prev, status: e.target.value }))}
                  className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="confirmed">Bestätigt</option>
                  <option value="pending">Ausstehend</option>
                  <option value="cancelled">Storniert</option>
                  <option value="completed">Abgeschlossen</option>
                  <option value="no_show">Nicht erschienen</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Notizen
                </label>
                <textarea
                  value={editBooking.notes}
                  onChange={(e) => setEditBooking((prev) => ({ ...prev, notes: e.target.value }))}
                  className="block min-h-20 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="optional"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {!isEditingBooking ? (
              <>
                {detailBooking && !['cancelled', 'completed', 'no_show'].includes(detailBooking.status) && (
                  <Button
                    variant="outline"
                    className="w-full gap-2 text-amber-700 hover:text-amber-800 dark:text-amber-300 sm:w-auto"
                    onClick={handleMarkNoShow}
                    disabled={submitting}
                  >
                    <UserX className="h-4 w-4" />
                    Nicht erschienen
                  </Button>
                )}
                {detailBooking?.customer_email &&
                  customerHistory.noShowCount >= 1 &&
                  customerHistory.canManageBlock &&
                  !customerHistory.isBlocked && (
                    <Button
                      variant="outline"
                      className="w-full gap-2 text-red-600 hover:text-red-700 dark:text-red-400 sm:w-auto"
                      onClick={handleBlockCustomer}
                      disabled={submitting}
                    >
                      <Lock className="h-4 w-4" />
                      Kunde sperren
                    </Button>
                  )}
                {detailBooking && detailBooking.status !== 'cancelled' && (
                  <Button
                    variant="outline"
                    className="w-full gap-2 text-red-600 hover:text-red-700 dark:text-red-400 sm:w-auto"
                    onClick={() => detailBooking && handleCancelBooking(detailBooking.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Absagen
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full gap-2 sm:w-auto"
                  onClick={handleStartEdit}
                >
                  <Edit2 className="h-4 w-4" />
                  Bearbeiten
                </Button>
                <Button className="w-full sm:w-auto" onClick={() => setDetailBookingId(null)}>
                  Schließen
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsEditingBooking(false)}>
                  Abbrechen
                </Button>
                <Button className="w-full sm:w-auto" onClick={handleSaveBookingEdit} disabled={submitting}>
                  {submitting ? 'Speichert...' : 'Speichern'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{createMode === 'block' ? 'Neuer Blocker' : 'Neue Buchung'}</DialogTitle>
            <DialogDescription>
              {quickCreateData && (
                <>
                  {createMode === 'block' ? 'Zeit blockieren am' : 'Termin am'} {quickCreateData.date.toLocaleDateString('de-DE')} um {String(quickCreateData.hour).padStart(2, '0')}:{String(quickCreateData.minute).padStart(2, '0')} Uhr
                  {quickCreateData.staffId && (
                    <> bei {staffMembers.find((staff) => staff.id === quickCreateData.staffId)?.name}</>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Mode toggle: Termin vs. Blocker */}
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setCreateMode('booking')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                createMode === 'booking'
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
              }`}
            >
              Termin
            </button>
            <button
              type="button"
              onClick={() => setCreateMode('block')}
              className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                createMode === 'block'
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
              }`}
            >
              <Lock className="h-3.5 w-3.5" />
              Blocker
            </button>
          </div>

          {createMode === 'block' && (
            <div className="space-y-4 py-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Mitarbeiter *
                </label>
                <select
                  value={newBlock.staff_id}
                  onChange={(e) => setNewBlock((prev) => ({ ...prev, staff_id: e.target.value }))}
                  className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="" disabled>Mitarbeiter wählen...</option>
                  {staffMembers.map((staff) => (
                    <option key={staff.id} value={staff.id}>{staff.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Datum *
                  </label>
                  <Input
                    type="date"
                    value={newBlock.date}
                    onChange={(e) => setNewBlock((prev) => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Von *
                  </label>
                  <Input
                    type="time"
                    value={newBlock.time}
                    onChange={(e) => setNewBlock((prev) => ({ ...prev, time: e.target.value }))}
                    disabled={newBlock.duration_minutes >= 1440}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Dauer
                  </label>
                  <select
                    value={newBlock.duration_minutes}
                    onChange={(e) => setNewBlock((prev) => ({ ...prev, duration_minutes: Number(e.target.value) }))}
                    className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value={30}>30 Min.</option>
                    <option value={60}>1 Std.</option>
                    <option value={90}>1,5 Std.</option>
                    <option value={120}>2 Std.</option>
                    <option value={180}>3 Std.</option>
                    <option value={240}>4 Std.</option>
                    <option value={360}>6 Std.</option>
                    <option value={480}>8 Std.</option>
                    <option value={1440}>Ganzer Tag</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Typ
                  </label>
                  <select
                    value={newBlock.type}
                    onChange={(e) => setNewBlock((prev) => ({ ...prev, type: e.target.value }))}
                    className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="other">Blocker</option>
                    <option value="break">Pause</option>
                    <option value="vacation">Urlaub</option>
                    <option value="sick">Krankheit</option>
                    <option value="maintenance">Wartung</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Grund / Notiz
                </label>
                <Input
                  placeholder="z.B. Mittagspause, Arzttermin (optional)"
                  value={newBlock.reason}
                  onChange={(e) => setNewBlock((prev) => ({ ...prev, reason: e.target.value }))}
                />
              </div>
            </div>
          )}

          {createMode === 'booking' && (
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Kunde *
              </label>
              <Input
                placeholder="Name des Kunden"
                value={newBooking.customer_name}
                onChange={(e) => setNewBooking((prev) => ({ ...prev, customer_name: e.target.value }))}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Datum *
                </label>
                <Input
                  type="date"
                  value={newBooking.date}
                  onChange={(e) => setNewBooking((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Uhrzeit *
                </label>
                <Input
                  type="time"
                  value={newBooking.time}
                  onChange={(e) => setNewBooking((prev) => ({ ...prev, time: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Leistung *
                </label>
                {offerings.length > 0 ? (
                  <select
                    value={newBooking.offering_id}
                    onChange={(e) => handleOfferingChange(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {offerings.map((offering) => (
                      <option key={offering.id} value={offering.id}>
                        {offering.name} ({offering.duration_minutes} Min.)
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    placeholder="z.B. Beratung"
                    value={newBooking.service}
                    onChange={(e) => setNewBooking((prev) => ({ ...prev, service: e.target.value }))}
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Dauer
                </label>
                <select
                  value={newBooking.duration_minutes}
                  onChange={(e) => setNewBooking((prev) => ({ ...prev, duration_minutes: Number(e.target.value) }))}
                  className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value={30}>30 Min.</option>
                  <option value={45}>45 Min.</option>
                  <option value={60}>60 Min.</option>
                  <option value={90}>90 Min.</option>
                  <option value={120}>120 Min.</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Mitarbeiter *
                </label>
                <select
                  value={newBooking.staff_id}
                  onChange={(e) => setNewBooking((prev) => ({ ...prev, staff_id: e.target.value }))}
                  className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="" disabled>Mitarbeiter wählen...</option>
                  {staffMembers.map((staff) => (
                    <option key={staff.id} value={staff.id}>{staff.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Standort *
                </label>
                <select
                  value={newBooking.location_id}
                  onChange={(e) => setNewBooking((prev) => ({ ...prev, location_id: e.target.value }))}
                  className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="" disabled>Standort wählen...</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>{location.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  E-Mail
                </label>
                <Input
                  type="email"
                  placeholder="optional"
                  value={newBooking.customer_email}
                  onChange={(e) => setNewBooking((prev) => ({ ...prev, customer_email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Telefon
                </label>
                <Input
                  type="tel"
                  placeholder="optional"
                  value={newBooking.customer_phone}
                  onChange={(e) => setNewBooking((prev) => ({ ...prev, customer_phone: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Notizen
              </label>
              <textarea
                value={newBooking.notes}
                onChange={(e) => setNewBooking((prev) => ({ ...prev, notes: e.target.value }))}
                className="block min-h-20 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="optional"
              />
            </div>
          </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsModalOpen(false)}>
              Abbrechen
            </Button>
            {createMode === 'block' ? (
              <Button className="w-full gap-2 sm:w-auto" onClick={handleSaveQuickBlock} disabled={submitting || staffMembers.length === 0}>
                <Lock className="h-4 w-4" />
                {submitting ? 'Speichert...' : 'Blocker speichern'}
              </Button>
            ) : (
              <Button className="w-full sm:w-auto" onClick={handleSaveQuickBooking} disabled={submitting || staffMembers.length === 0}>
                {submitting ? 'Speichert...' : 'Termin speichern'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block detail modal */}
      <Dialog
        open={!!detailBlock}
        onOpenChange={(open) => {
          if (!open) setDetailBlockId(null);
        }}
      >
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              {detailBlock ? (blockTypeLabels[detailBlock.type] || 'Blocker') : 'Blocker'}
            </DialogTitle>
            <DialogDescription>
              {detailBlock &&
                formatDateInTimeZone(detailBlock.start_time)}
            </DialogDescription>
          </DialogHeader>

          {detailBlock && (
            <div className="space-y-3 py-2 text-sm">
              <div className="flex items-center gap-2 text-gray-700 dark:text-slate-300">
                <Clock className="h-4 w-4 flex-shrink-0 text-gray-400" />
                {formatTimeInTimeZone(detailBlock.start_time)}
                {' – '}
                {formatTimeInTimeZone(detailBlock.end_time)} Uhr
              </div>

              {detailBlock.staff_name && (
                <div className="flex items-center gap-2 text-gray-700 dark:text-slate-300">
                  <User className="h-4 w-4 flex-shrink-0 text-gray-400" />
                  {detailBlock.staff_name}
                </div>
              )}

              {detailBlock.reason && (
                <div className="rounded-md bg-gray-50 p-3 text-gray-600 dark:bg-slate-800/60 dark:text-slate-400">
                  {detailBlock.reason}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="w-full gap-2 text-red-600 hover:text-red-700 dark:text-red-400 sm:w-auto"
              onClick={() => detailBlock && handleDeleteBlock(detailBlock.id)}
            >
              <Trash2 className="h-4 w-4" />
              Entfernen
            </Button>
            <Button className="w-full sm:w-auto" onClick={() => setDetailBlockId(null)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
