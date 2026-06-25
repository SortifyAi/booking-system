// @ts-nocheck
'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CalendarDays, Clock, Scissors, User, Check, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { isMockMode } from '@/lib/utils/mock';
import { mockBookings } from '@/lib/mock-data';
import { getExceptionWindow, findException } from '@/lib/holidays';
import { BUSINESS_HOURS } from '@/lib/constants';

const SLOT_STEP_MIN = 30;

function formatEuro(cents) {
  if (cents == null) return null;
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

function minutesFromHHMM(value) {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Öffnungsfenster eines Standorts an einem Datum (synchron, ohne Feiertags-API).
 * Reihenfolge wie in der Verfügbarkeits-Route: Ausnahme-Zeiten > Ausnahme
 * geschlossen > reguläre Öffnungszeiten des Wochentags > Fallback BUSINESS_HOURS.
 * Gibt { open, close } in Minuten zurück, oder null wenn geschlossen.
 */
function getDayWindow(settings, dateStr) {
  const exWin = getExceptionWindow(settings || {}, dateStr);
  if (exWin) return { open: minutesFromHHMM(exWin.open), close: minutesFromHHMM(exWin.close) };

  const ex = findException(settings || {}, dateStr);
  if (ex && ex.closed) return null;

  const dayOfWeek = new Date(`${dateStr}T00:00:00`).getDay();
  const oh = (settings?.openingHours || []).find((h) => h.day === dayOfWeek);
  if (oh) {
    if (oh.closed || !oh.open || !oh.close) return null;
    return { open: minutesFromHHMM(oh.open), close: minutesFromHHMM(oh.close) };
  }
  return { open: BUSINESS_HOURS.start * 60, close: BUSINESS_HOURS.end * 60 };
}

export function QuickBookingDialog({
  open,
  onOpenChange,
  locations = [],
  offerings = [],
  resources = [],
  onCreated,
}) {
  const supabase = createClient();

  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState('');
  const [locationId, setLocationId] = useState('');
  const [offeringId, setOfferingId] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dayBookings, setDayBookings] = useState([]);

  const staff = useMemo(
    () => resources.filter((r) => r.type === 'staff' || !r.type),
    [resources],
  );

  // Standort-Vorauswahl
  useEffect(() => {
    if (open && !locationId && locations.length > 0) {
      setLocationId(locations[0].id);
    }
  }, [open, locations, locationId]);

  // Services für den gewählten Standort
  const locationOfferings = useMemo(() => {
    if (!locationId) return offerings;
    const scoped = offerings.filter((o) => o.location_id === locationId);
    return scoped.length ? scoped : offerings;
  }, [offerings, locationId]);

  useEffect(() => {
    if (open && !offeringId && locationOfferings.length > 0) {
      setOfferingId(locationOfferings[0].id);
    }
  }, [open, locationOfferings, offeringId]);

  const selectedOffering = useMemo(
    () => offerings.find((o) => o.id === offeringId),
    [offerings, offeringId],
  );
  const durationMin = selectedOffering?.duration_minutes || 60;

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === locationId),
    [locations, locationId],
  );
  const dayWindow = useMemo(
    () => (date ? getDayWindow(selectedLocation?.settings, date) : null),
    [selectedLocation, date],
  );
  const closedDay = date && dayWindow === null;

  // Bestehende Buchungen des gewählten Tages laden (für freie/belegte Slots)
  useEffect(() => {
    if (!open || !date) return;
    let active = true;

    const load = async () => {
      const dayStart = new Date(`${date}T00:00:00`);
      const dayEnd = new Date(`${date}T23:59:59`);

      if (isMockMode()) {
        const rows = mockBookings.filter((b) => {
          const s = new Date(b.start_time);
          return s >= dayStart && s <= dayEnd && b.status !== 'cancelled';
        });
        if (active) setDayBookings(rows);
        return;
      }

      let query = supabase
        .from('bookings')
        .select('start_time, end_time, status, resource_id, location_id')
        .gte('start_time', dayStart.toISOString())
        .lte('start_time', dayEnd.toISOString())
        .neq('status', 'cancelled');
      if (locationId) query = query.eq('location_id', locationId);

      const { data } = await query;
      if (active) setDayBookings(data || []);
    };

    load();
    return () => {
      active = false;
    };
  }, [open, date, locationId, supabase]);

  // Slots erzeugen (nur innerhalb der echten Öffnungszeiten) + Verfügbarkeit prüfen
  const slots = useMemo(() => {
    if (!dayWindow) return [];
    const now = new Date();
    const isToday = date === format(now, 'yyyy-MM-dd');
    const result = [];

    // Letzter Start, bei dem der Termin noch vor Ladenschluss endet
    const lastStart = dayWindow.close - durationMin;
    for (let mins = dayWindow.open; mins <= lastStart; mins += SLOT_STEP_MIN) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      const slotStart = new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
      const slotEnd = new Date(slotStart.getTime() + durationMin * 60000);

      const past = isToday && slotStart < now;
      const busy = dayBookings.some((b) => {
        if (resourceId && b.resource_id && b.resource_id !== resourceId) return false;
        return overlaps(slotStart, slotEnd, new Date(b.start_time), new Date(b.end_time));
      });

      result.push({
        value: format(slotStart, 'HH:mm'),
        available: !past && !busy,
      });
    }
    return result;
  }, [dayWindow, date, durationMin, dayBookings, resourceId]);

  // Gewählte Zeit verwerfen, wenn sie nicht mehr frei/in den Öffnungszeiten liegt
  useEffect(() => {
    if (time && !slots.some((s) => s.value === time && s.available)) {
      setTime('');
    }
  }, [slots, time]);

  const reset = () => {
    setTime('');
    setCustomerName('');
    setCustomerPhone('');
    setNotes('');
    setResourceId('');
  };

  const close = () => {
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!customerName.trim()) {
      toast.error('Bitte einen Namen eingeben');
      return;
    }
    if (!date || !time) {
      toast.error('Bitte Datum und Uhrzeit wählen');
      return;
    }

    const startTime = new Date(`${date}T${time}`);
    const endTime = new Date(startTime.getTime() + durationMin * 60000);
    const location = locations.find((l) => l.id === locationId);

    setSubmitting(true);
    try {
      if (isMockMode()) {
        toast.success(`Termin für ${customerName} angelegt`);
        reset();
        close();
        onCreated?.();
        return;
      }

      const { error } = await supabase.from('bookings').insert({
        organization_id: location?.organization_id || null,
        location_id: locationId || null,
        offering_id: offeringId || null,
        resource_id: resourceId || null,
        customer_name: customerName.trim(),
        customer_email: null,
        customer_phone: customerPhone.trim() || null,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: 'confirmed',
        notes: notes.trim() || null,
      });

      if (error) throw error;

      toast.success(`Termin für ${customerName} am ${format(startTime, 'dd.MM. HH:mm')} angelegt`);
      reset();
      close();
      onCreated?.();
    } catch (error) {
      console.error('Quick booking failed:', error);
      toast.error('Termin konnte nicht angelegt werden');
    } finally {
      setSubmitting(false);
    }
  };

  const today = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schnell-Termin</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* 1. Datum */}
          <div>
            <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-slate-300">
              <CalendarDays className="h-4 w-4" /> Datum
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setDate(today)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  date === today
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                Heute
              </button>
              <button
                type="button"
                onClick={() => setDate(tomorrow)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  date === tomorrow
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                Morgen
              </button>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-auto"
              />
            </div>
          </div>

          {/* 2. Service (bestimmt Dauer) */}
          <div>
            <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-slate-300">
              <Scissors className="h-4 w-4" /> Leistung
            </label>
            <select
              value={offeringId}
              onChange={(e) => setOfferingId(e.target.value)}
              className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              {locationOfferings.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                  {o.duration_minutes ? ` · ${o.duration_minutes} Min` : ''}
                  {formatEuro(o.price_cents) ? ` · ${formatEuro(o.price_cents)}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Uhrzeit (freie Slots) */}
          <div>
            <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-slate-300">
              <Clock className="h-4 w-4" /> Uhrzeit
              <span className="font-normal text-gray-400">· {durationMin} Min</span>
            </label>
            {closedDay ? (
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 px-3 py-3 text-sm text-gray-500 dark:border-slate-700 dark:text-slate-400">
                <Lock className="h-4 w-4" /> An diesem Tag geschlossen – bitte anderes Datum wählen.
              </div>
            ) : slots.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 px-3 py-3 text-sm text-gray-500 dark:border-slate-700 dark:text-slate-400">
                Heute keine freie Zeit mehr in den Öffnungszeiten.
              </div>
            ) : (
              <div className="grid max-h-40 grid-cols-4 gap-1.5 overflow-y-auto rounded-lg border border-gray-100 p-2 dark:border-slate-800 sm:grid-cols-6">
                {slots.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    disabled={!s.available}
                    onClick={() => setTime(s.value)}
                    className={`rounded-md px-2 py-1.5 text-xs font-medium tabular-nums transition ${
                      time === s.value
                        ? 'bg-blue-600 text-white'
                        : s.available
                          ? 'bg-gray-100 text-gray-700 hover:bg-blue-100 dark:bg-slate-800 dark:text-slate-200'
                          : 'cursor-not-allowed bg-transparent text-gray-300 line-through dark:text-slate-700'
                    }`}
                  >
                    {s.value}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 4. Mitarbeiter (optional) */}
          {staff.length > 0 && (
            <div>
              <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-slate-300">
                <User className="h-4 w-4" /> Mitarbeiter
              </label>
              <select
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Automatisch / egal</option>
                {staff.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 5. Kunde */}
          <div className="space-y-2">
            <Input
              placeholder="Name der Kundin / des Kunden *"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
            <Input
              placeholder="Telefon (optional)"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
            <Input
              placeholder="Notiz (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {locations.length > 1 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                Standort
              </label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={close} disabled={submitting}>
              Abbrechen
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              <Check className="mr-1.5 h-4 w-4" />
              {submitting ? 'Speichern…' : 'Termin anlegen'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
