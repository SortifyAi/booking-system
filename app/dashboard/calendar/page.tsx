// @ts-nocheck
'use client';

import * as React from 'react';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { CalendarContainer } from '@/components/CalendarContainer';
import { isMockMode } from '@/lib/utils/mock';
import { mockBookings, mockLocations, mockOfferings, mockStaff } from '@/lib/mock-data';
import { Calendar as CalendarIcon } from 'lucide-react';
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
  const [quickCreateData, setQuickCreateData] = useState<{
    date: Date;
    hour: number;
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

  const handleQuickCreate = (date: Date, hour: number) => {
    const selectedDate = new Date(date);
    selectedDate.setHours(hour, 0, 0, 0);

    const defaultOffering = offerings[0];
    const defaultLocationId = defaultOffering?.location_id || locations[0]?.id || '';
    const defaultStaffId = selectedStaff !== 'all' ? selectedStaff : staffMembers[0]?.id || '';

    setQuickCreateData({ date: selectedDate, hour });
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
      duration_minutes: defaultOffering?.duration_minutes || 60,
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
      />

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Neue Buchung</DialogTitle>
            <DialogDescription>
              {quickCreateData && (
                <>Termin am {quickCreateData.date.toLocaleDateString('de-DE')} um {String(quickCreateData.hour).padStart(2, '0')}:00 Uhr</>
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
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSaveQuickBooking} disabled={submitting || staffMembers.length === 0}>
              {submitting ? 'Speichert...' : 'Termin speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
