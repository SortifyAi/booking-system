// @ts-nocheck
'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { CalendarContainer } from '@/components/CalendarContainer';
import { Switch } from '@/components/ui/switch';
import { isMockMode } from '@/lib/utils/mock';
import { mockBookings, mockStaff } from '@/lib/mock-data';
import { Calendar as CalendarIcon, Plus } from 'lucide-react';
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

interface Booking {
  id: string;
  start_time: string;
  end_time: string;
  guest_name: string;
  service: string;
  status: string;
  location_id: string;
  staff_id?: string;
}

interface Staff {
  id: string;
  name: string;
  color: string;
}

export default function CalendarPage() {
  const [viewMode, setViewMode] = React.useState<'week'|'day'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [quickCreateData, setQuickCreateData] = useState<{
    date: Date;
    hour: number;
  } | null>(null);
  const [newBooking, setNewBooking] = useState({
    guest_name: '',
    service: '',
    staff_id: '',
  });
  const supabase = createClient();

  const staffMembers: Staff[] = mockStaff;

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);

      if (isMockMode()) {
        setBookings(mockBookings);
        return;
      }

      const { data, error } = await supabase
        .from('bookings')
        .select('*');

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      toast.error('Buchungen konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Filter bookings by selected staff
  const filteredBookings = selectedStaff === 'all'
    ? bookings
    : bookings.filter(booking => booking.staff_id === selectedStaff);

  const handleQuickCreate = (date: Date, hour: number) => {
    const selectedDate = new Date(date);
    selectedDate.setHours(hour, 0, 0, 0);
    setQuickCreateData({ date: selectedDate, hour });
    setNewBooking({
      guest_name: '',
      service: '',
      staff_id: selectedStaff !== 'all' ? selectedStaff : '',
    });
    setIsModalOpen(true);
  };

  const handleSaveQuickBooking = () => {
    if (!newBooking.guest_name || !newBooking.service) {
      toast.error('Bitte Name und Service ausfüllen');
      return;
    }

    if (!quickCreateData) return;

    const startTime = new Date(quickCreateData.date);
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1);

    const newBookingEntry: Booking = {
      id: `book-${Date.now()}`,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      guest_name: newBooking.guest_name,
      service: newBooking.service,
      status: 'pending',
      location_id: 'loc-berlin',
      staff_id: newBooking.staff_id || undefined,
    };

    setBookings(prev => [...prev, newBookingEntry]);
    toast.success('Termin wurde erstellt');
    setIsModalOpen(false);
    setQuickCreateData(null);
    setNewBooking({ guest_name: '', service: '', staff_id: '' });
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
      <div className="flex items-center mb-4">
        <span className="mr-2 font-medium">Ansicht:</span>
        <button
          className={`px-3 py-1 rounded ${viewMode==='week'?"bg-blue-500 text-white":"bg-gray-200"}`}
          onClick={()=>setViewMode('week')}
        >Wochenansicht</button>
        <button
          className={`ml-2 px-3 py-1 rounded ${viewMode==='day'?"bg-blue-500 text-white":"bg-gray-200"}`}
          onClick={()=>setViewMode('day')}
        >Tagesansicht</button>
      </div>
      <CalendarContainer viewMode={viewMode}
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

      {/* Quick Create Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Neuer Termin</DialogTitle>
            <DialogDescription>
              {quickCreateData && (
                <>Termin am {quickCreateData.date.toLocaleDateString('de-DE')} um {String(quickCreateData.hour).padStart(2, '0')}:00 Uhr</>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Kunde *
              </label>
              <Input
                placeholder="Name des Kunden"
                value={newBooking.guest_name}
                onChange={(e) => setNewBooking(prev => ({ ...prev, guest_name: e.target.value }))}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Service *
              </label>
              <Input
                placeholder="z.B. Haircut, Massage"
                value={newBooking.service}
                onChange={(e) => setNewBooking(prev => ({ ...prev, service: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Mitarbeiter (optional)
              </label>
              <select
                value={newBooking.staff_id}
                onChange={(e) => setNewBooking(prev => ({ ...prev, staff_id: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Keine Auswahl</option>
                {staffMembers.map(staff => (
                  <option key={staff.id} value={staff.id}>{staff.name}</option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSaveQuickBooking}>
              Termin speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}