// @ts-nocheck
'use client';

import * as React from 'react';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { CalendarContainer } from '@/components/CalendarContainer';
import { isMockMode } from '@/lib/utils/mock';
import { mockBookings, mockLocations, mockOfferings, mockStaff } from '@/lib/mock-data';
import { Calendar as CalendarIcon, Phone, Mail, Clock, User, Briefcase, Trash2, Edit2 } from 'lucide-react';
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
  CalendarStaffMember,
  normalizeCalendarBooking,
} from '@/lib/calendar-admin';

interface Location {
  id: string;
  name: string;
  organization_id?: string;
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

export default function CalendarPage() {
  const [viewMode, setViewMode] = React.useState<'week' | 'day'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<CalendarBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailBookingId, setDetailBookingId] = useState<string | null>(null);
  const [isEditingBooking, setIsEditingBooking] = useState(false);
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
        setLocations(mockLocations.map(({ id, name, organization_id }) => ({ id, name, organization_id })));
        setOfferings(mockOfferings.map(({ id, name, duration_minutes, location_id }) => ({
          id,
          name,
          duration_minutes,
          location_id,
        })));
        setBookings(mockBookings.map((booking) => normalizeCalendarBooking(booking, mockCalendarStaff)));
        return;
      }

      const [staffData, locationsData, offeringsData, bookingsData] = await Promise.all([
        supabase
          .from('resources')
          .select('id, name, type')
          .eq('type', 'staff')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('locations')
          .select('id, name, organization_id')
          .order('name'),
        supabase
          .from('offerings')
          .select('id, name, duration_minutes, location_id')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('bookings')
          .select('*, offerings(name), resources(id, name)')
          .order('start_time', { ascending: true }),
      ]);

      if (staffData.error) throw staffData.error;
      if (locationsData.error) throw locationsData.error;
      if (offeringsData.error) throw offeringsData.error;
      if (bookingsData.error) throw bookingsData.error;

      const calendarStaff = (staffData.data || []).map((resource, idx) => ({
        id: resource.id,
        name: resource.name,
        color: staffColorPalette[idx % staffColorPalette.length],
      }));

      setStaffMembers(calendarStaff);
      setLocations(locationsData.data || []);
      setOfferings(offeringsData.data || []);
      setBookings((bookingsData.data || []).map((booking) => normalizeCalendarBooking(booking, calendarStaff)));
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

  const handleQuickCreate = (date: Date, hour: number, staffId?: string) => {
    const selectedDate = new Date(date);
    selectedDate.setHours(hour, 0, 0, 0);

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

    setQuickCreateData({ date: selectedDate, hour, staffId: defaultStaffId });
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

    const startTime = new Date(`${newBooking.date}T${newBooking.time}`);
    const endTime = new Date(startTime.getTime() + newBooking.duration_minutes * 60000);
    const staff = staffMembers.find((member) => member.id === newBooking.staff_id);
    const offering = offerings.find((item) => item.id === newBooking.offering_id);
    const location = locations.find((item) => item.id === newBooking.location_id);

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

    setBookings((prev) =>
      prev.map((booking) =>
        booking.id === bookingId ? { ...booking, status: 'cancelled' } : booking,
      ),
    );
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
      setBookings((prev) => prev.map((booking) => (booking.id === bookingId ? existing : booking)));
      toast.error('Termin konnte nicht abgesagt werden');
    }
  };

  const detailBooking = bookings.find((booking) => booking.id === detailBookingId) || null;

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

    const startTime = new Date(`${editBooking.date}T${editBooking.time}`);
    const endTime = new Date(startTime.getTime() + editBooking.duration_minutes * 60000);
    const staff = staffMembers.find((member) => member.id === editBooking.staff_id);
    const offering = offerings.find((item) => item.id === editBooking.offering_id);
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
        startHour={7}
        endHour={20}
        selectedStaff={selectedStaff}
        onStaffChange={setSelectedStaff}
        staffMembers={staffMembers}
        onTimeSlotClick={handleQuickCreate}
        onBookingMove={handleBookingMove}
        onBookingClick={(id) => setDetailBookingId(id)}
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
                  new Date(detailBooking.start_time).toLocaleDateString('de-DE', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
              </DialogDescription>
            )}
          </DialogHeader>

          {detailBooking && !isEditingBooking && (
            <div className="space-y-3 py-2 text-sm">
              <div className="flex items-center gap-2 text-gray-700 dark:text-slate-300">
                <Clock className="h-4 w-4 flex-shrink-0 text-gray-400" />
                {new Date(detailBooking.start_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                {' – '}
                {new Date(detailBooking.end_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
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
            <DialogTitle>Neue Buchung</DialogTitle>
            <DialogDescription>
              {quickCreateData && (
                <>
                  Termin am {quickCreateData.date.toLocaleDateString('de-DE')} um {String(quickCreateData.hour).padStart(2, '0')}:00 Uhr
                  {quickCreateData.staffId && (
                    <> bei {staffMembers.find((staff) => staff.id === quickCreateData.staffId)?.name}</>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

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

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsModalOpen(false)}>
              Abbrechen
            </Button>
            <Button className="w-full sm:w-auto" onClick={handleSaveQuickBooking} disabled={submitting || staffMembers.length === 0}>
              {submitting ? 'Speichert...' : 'Termin speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
