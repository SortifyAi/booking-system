// @ts-nocheck
'use client';

import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { BookingCard } from '@/components/BookingCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Filter, BookOpen, Search } from 'lucide-react';
import { toast } from 'sonner';
import { isMockMode } from '@/lib/utils/mock';
import { mockBookings, mockLocations, mockOfferings, mockResources } from '@/lib/mock-data';

interface Booking {
  id: string;
  start_time: string;
  end_time: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  guest_name?: string;
  customer_name?: string;
  customer_email?: string;
  notes?: string;
  location?: {
    name: string;
  } | null;
  location_id: string;
}

interface Location {
  id: string;
  name: string;
}

interface Offering {
  id: string;
  name: string;
  duration_minutes: number;
}

interface Resource {
  id: string;
  name: string;
  type: string;
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  
  // Form state
  const [formLocation, setFormLocation] = useState('');
  const [formOffering, setFormOffering] = useState('');
  const [formResource, setFormResource] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerEmail, setFormCustomerEmail] = useState('');
  const [formCustomerPhone, setFormCustomerPhone] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formStatus, setFormStatus] = useState<'pending' | 'confirmed' | 'cancelled'>('pending');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editStatus, setEditStatus] = useState<'pending' | 'confirmed' | 'cancelled'>('pending');
  const [editNotes, setEditNotes] = useState('');
  const [editDurationMinutes, setEditDurationMinutes] = useState(60);

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      if (isMockMode()) {
        setLocations(mockLocations.map(({ id, name }) => ({ id, name })));
        setOfferings(mockOfferings.map(({ id, name, duration_minutes }) => ({ id, name, duration_minutes })));
        setResources(mockResources.map(({ id, name, type }) => ({ id, name, type })));
        
        const enriched = mockBookings.map((booking) => {
          const location = mockLocations.find((loc) => loc.id === booking.location_id);
          return {
            ...booking,
            location: location ? { name: location.name } : null,
          } as Booking;
        });
        setBookings(enriched);
        return;
      }

      const [locationsData, offeringsData, resourcesData, bookingsData] = await Promise.all([
        supabase.from('locations').select('id, name'),
        supabase.from('offerings').select('id, name, duration_minutes').eq('is_active', true),
        supabase.from('resources').select('id, name, type'),
        supabase.from('bookings').select('*').order('start_time', { ascending: false })
      ]);

      if (locationsData.error) throw locationsData.error;
      setLocations(locationsData.data || []);

      if (offeringsData.error) throw offeringsData.error;
      setOfferings(offeringsData.data || []);

      if (resourcesData.error) throw resourcesData.error;
      setResources(resourcesData.data || []);

      if (bookingsData.error) throw bookingsData.error;

      const enrichedBookings = (bookingsData.data || []).map((booking) => {
        const location = locationsData.data?.find((loc) => loc.id === booking.location_id);
        return {
          ...booking,
          guest_name: booking.customer_name,
          location: location ? { name: location.name } : null,
        };
      });

      setBookings(enrichedBookings as Booking[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Buchungen konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-set form defaults when locations/offerings are loaded
  useEffect(() => {
    if (locations.length > 0 && !formLocation) {
      setFormLocation(locations[0].id);
    }
    if (offerings.length > 0 && !formOffering) {
      setFormOffering(offerings[0].id);
    }
    // Default Zeit: jetzt + 1 Stunde
    if (!formDate || !formTime) {
      const now = new Date();
      now.setHours(now.getHours() + 1, 0, 0, 0);
      setFormDate(format(now, 'yyyy-MM-dd'));
      setFormTime(now.toTimeString().slice(0, 5));
    }
  }, [locations, offerings]);

  const handleCreate = async () => {
    // NUR Name und Datum sind Pflicht!
    if (!formDate || !formTime || !formCustomerName) {
      toast.error('Bitte Name und Datum eingeben');
      return;
    }

    setSubmitting(true);
    try {
      const startTime = new Date(`${formDate}T${formTime}`);
      
      // Default: 60 Minuten wenn keine Offering angegeben
      const offering = offerings.find(o => o.id === formOffering);
      const durationMinutes = offering?.duration_minutes || 60;
      const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

      // Auto-select first location if none selected
      let finalLocationId = formLocation;
      let finalOfferingId = formOffering;
      
      if (!finalLocationId && locations.length > 0) {
        finalLocationId = locations[0].id;
      }
      if (!finalOfferingId && offerings.length > 0) {
        finalOfferingId = offerings[0].id;
      }

      if (isMockMode()) {
        const newBooking = {
          id: `booking-${Date.now()}`,
          location_id: finalLocationId,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          status: formStatus,
          guest_name: formCustomerName,
          location: locations.find(l => l.id === finalLocationId)
        };
        setBookings([newBooking, ...bookings]);
        toast.success('Buchung erstellt');
        closeModal();
        return;
      }

      const { error } = await supabase.from('bookings').insert({
        location_id: finalLocationId,
        offering_id: finalOfferingId || null,
        resource_id: formResource || null,
        customer_name: formCustomerName,
        customer_email: formCustomerEmail || null,
        customer_phone: formCustomerPhone || null,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: formStatus,
        notes: formNotes || null
      });

      if (error) throw error;

      toast.success('Buchung erstellt');
      fetchData();
      closeModal();
    } catch (error) {
      console.error('Error creating booking:', error);
      toast.error('Buchung konnte nicht erstellt werden');
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setShowCreateModal(false);
    // Reset with smart defaults
    setFormLocation(locations[0]?.id || '');
    setFormOffering(offerings[0]?.id || '');
    setFormResource('');
    // Default: heute + 1 Stunde
    const now = new Date();
    now.setHours(now.getHours() + 1, 0, 0, 0);
    setFormDate(format(now, 'yyyy-MM-dd'));
    setFormTime(now.toTimeString().slice(0, 5));
    setFormCustomerName('');
    setFormCustomerEmail('');
    setFormCustomerPhone('');
    setFormNotes('');
    setFormStatus('pending');
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditBooking(null);
    setEditDate('');
    setEditTime('');
    setEditStatus('pending');
    setEditNotes('');
    setEditDurationMinutes(60);
  };

  const openEditModal = (booking: Booking) => {
    const startDate = new Date(booking.start_time);
    const endDate = new Date(booking.end_time);
    const durationMinutes = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 60000));

    setEditBooking(booking);
    setEditDate(format(startDate, 'yyyy-MM-dd'));
    setEditTime(format(startDate, 'HH:mm'));
    setEditStatus(booking.status || 'pending');
    setEditNotes(booking.notes || '');
    setEditDurationMinutes(durationMinutes);
    setShowEditModal(true);
  };

  const handleEdit = async () => {
    if (!editBooking) return;
    if (!editDate || !editTime) {
      toast.error('Bitte Datum und Uhrzeit auswählen');
      return;
    }

    setEditSubmitting(true);
    try {
      const startTime = new Date(`${editDate}T${editTime}`);
      const endTime = new Date(startTime.getTime() + editDurationMinutes * 60000);

      if (isMockMode()) {
        setBookings(bookings.map((booking) => {
          if (booking.id !== editBooking.id) return booking;
          return {
            ...booking,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            status: editStatus,
            notes: editNotes || undefined,
          };
        }));
        toast.success('Buchung aktualisiert');
        closeEditModal();
        return;
      }

      const { error } = await supabase
        .from('bookings')
        .update({
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          status: editStatus,
          notes: editNotes || null,
        })
        .eq('id', editBooking.id);

      if (error) throw error;

      toast.success('Buchung aktualisiert');
      fetchData();
      closeEditModal();
    } catch (error) {
      console.error('Error updating booking:', error);
      toast.error('Buchung konnte nicht aktualisiert werden');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bist du sicher, dass du diese Buchung löschen möchtest?')) return;

    try {
      if (isMockMode()) {
        setBookings(bookings.filter((b) => b.id !== id));
        toast.success('Buchung erfolgreich gelöscht');
        return;
      }

      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setBookings(bookings.filter((b) => b.id !== id));
      toast.success('Buchung erfolgreich gelöscht');
    } catch (error) {
      toast.error('Buchung konnte nicht gelöscht werden');
    }
  };

  const filteredBookings = bookings.filter((booking) => {
    // Status filter
    if (filterStatus !== 'all' && booking.status !== filterStatus) return false;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = (booking.guest_name || booking.customer_name || '').toLowerCase().includes(query);
      const matchesLocation = booking.location?.name?.toLowerCase().includes(query);
      const matchesEmail = (booking as any).customer_email?.toLowerCase().includes(query);
      if (!matchesName && !matchesLocation && !matchesEmail) return false;
    }
    
    return true;
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100">Buchungen</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
            Verwalte alle deine Buchungen
          </p>
        </div>
        <Button 
          className="flex items-center gap-2 w-full sm:w-auto"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus className="h-4 w-4" />
          Neue Buchung
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400 dark:text-slate-500" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="all">Alle Buchungen</option>
            <option value="confirmed">Bestätigt</option>
            <option value="pending">Ausstehend</option>
            <option value="cancelled">Storniert</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm space-y-3 animate-pulse dark:border-slate-800 dark:bg-slate-900">
              <div className="h-4 w-24 bg-gray-200 rounded dark:bg-slate-700" />
              <div className="h-4 w-32 bg-gray-200 rounded dark:bg-slate-700" />
              <div className="h-8 w-full bg-gray-200 rounded dark:bg-slate-700" />
            </div>
          ))}
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 sm:p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <div className="text-gray-400 mb-4 dark:text-slate-500">
            <BookOpen className="h-12 w-12 mx-auto" />
          </div>
          <p className="text-gray-900 font-medium dark:text-slate-100">Keine Buchungen gefunden</p>
          <p className="text-gray-600 text-sm mt-1 dark:text-slate-400">
            {searchQuery ? 'Versuchen Sie einen anderen Suchbegriff' : 'Erstelle eine neue Buchung, um zu starten'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBookings.map((booking) => (
            <BookingCard
              key={booking.id}
              id={booking.id}
              locationName={booking.location?.name || 'Unbekannt'}
              startTime={booking.start_time}
              endTime={booking.end_time}
              status={booking.status}
              guestName={booking.guest_name || booking.customer_name}
              onEdit={() => openEditModal(booking)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Create Booking Modal */}
      <Dialog open={showCreateModal} onOpenChange={closeModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Neue Buchung</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Name - PFICHTFELD */}
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <Input
                value={formCustomerName}
                onChange={(e) => setFormCustomerName(e.target.value)}
                placeholder="Max Mustermann"
                autoFocus
              />
            </div>

            {/* Datum & Zeit - PFICHTFELD */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Datum *</label>
                <Input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Uhrzeit *</label>
                <Input
                  type="time"
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                />
              </div>
            </div>

            {/* Optional: Location (auto-select first) */}
            <div>
              <label className="block text-sm font-medium mb-1">Standort</label>
              <select
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Auto (erster)</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>

            {/* Optional: Leistung */}
            <div>
              <label className="block text-sm font-medium mb-1">Leistung</label>
              <select
                value={formOffering}
                onChange={(e) => setFormOffering(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Standard (60 Min)</option>
                {offerings.map(off => (
                  <option key={off.id} value={off.id}>{off.name} ({off.duration_minutes} Min.)</option>
                ))}
              </select>
            </div>

            {/* Optional: Kontakt */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">E-Mail</label>
                <Input
                  type="email"
                  value={formCustomerEmail}
                  onChange={(e) => setFormCustomerEmail(e.target.value)}
                  placeholder="optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Telefon</label>
                <Input
                  type="tel"
                  value={formCustomerPhone}
                  onChange={(e) => setFormCustomerPhone(e.target.value)}
                  placeholder="optional"
                />
              </div>
            </div>

            {/* Notizen */}
            <div>
              <label className="block text-sm font-medium mb-1">Notizen</label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                rows={2}
                placeholder="Optional..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={closeModal} className="flex-1">
                Abbrechen
              </Button>
              <Button 
                onClick={handleCreate} 
                disabled={submitting}
                className="flex-1"
              >
                {submitting ? '...' : 'Erstellen'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Booking Modal */}
      <Dialog open={showEditModal} onOpenChange={closeEditModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Buchung bearbeiten</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Datum *</label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Uhrzeit *</label>
                <Input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as any)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="pending">Ausstehend</option>
                <option value="confirmed">Bestätigt</option>
                <option value="cancelled">Storniert</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-1">Notizen</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                rows={2}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={closeEditModal} className="flex-1">
                Abbrechen
              </Button>
              <Button
                onClick={handleEdit}
                disabled={editSubmitting}
                className="flex-1"
              >
                {editSubmitting ? 'Wird gespeichert...' : 'Änderungen speichern'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
