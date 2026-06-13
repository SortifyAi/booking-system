'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { mockTimezones } from '@/lib/mock-data';
import { GERMAN_STATES, type ScheduleException } from '@/lib/holidays';

interface LocationFormProps {
  onSubmit?: (data: LocationFormData) => Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
  initialData?: LocationFormData;
}

export interface LocationFormData {
  name: string;
  address?: string;
  timezone?: string;
  openingHours?: OpeningHours[];
  bundesland?: string;
  exceptions?: ScheduleException[];
}

export interface OpeningHours {
  day: number; // 0 = Sunday, 1 = Monday, etc.
  open: string; // HH:mm format
  close: string; // HH:mm format
  closed?: boolean;
}

const DAYS = [
  { value: 1, label: 'Montag' },
  { value: 2, label: 'Dienstag' },
  { value: 3, label: 'Mittwoch' },
  { value: 4, label: 'Donnerstag' },
  { value: 5, label: 'Freitag' },
  { value: 6, label: 'Samstag' },
  { value: 0, label: 'Sonntag' },
];

const timezones = [
  'UTC',
  ...mockTimezones,
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
];

export function LocationForm({
  onSubmit,
  onCancel,
  loading,
  initialData,
}: LocationFormProps) {
  const defaultOpeningHours: OpeningHours[] = [
    { day: 1, open: '09:00', close: '18:00', closed: false },
    { day: 2, open: '09:00', close: '18:00', closed: false },
    { day: 3, open: '09:00', close: '18:00', closed: false },
    { day: 4, open: '09:00', close: '18:00', closed: false },
    { day: 5, open: '09:00', close: '18:00', closed: false },
    { day: 6, open: '10:00', close: '14:00', closed: false },
    { day: 0, open: '', close: '', closed: true },
  ];

  const [formData, setFormData] = useState<LocationFormData>({
    name: initialData?.name || '',
    address: initialData?.address || '',
    timezone: initialData?.timezone || 'Europe/Berlin',
    openingHours: initialData?.openingHours || defaultOpeningHours,
    bundesland: initialData?.bundesland || '',
    exceptions: initialData?.exceptions || [],
  });

  // Draft for the "add exception" row.
  const [draftDate, setDraftDate] = useState('');
  const [draftClosed, setDraftClosed] = useState(true);
  const [draftOpen, setDraftOpen] = useState('09:00');
  const [draftClose, setDraftClose] = useState('13:00');
  const [draftNote, setDraftNote] = useState('');

  // Read-only preview of the upcoming public holidays for the chosen Bundesland.
  const [holidays, setHolidays] = useState<{ date: string; name: string }[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(false);

  useEffect(() => {
    const land = formData.bundesland;
    if (!land) {
      setHolidays([]);
      return;
    }
    let cancelled = false;
    setHolidaysLoading(true);
    const year = new Date().getFullYear();
    // Fetch this year and next so the list stays useful at year's end.
    Promise.all(
      [year, year + 1].map((y) =>
        fetch(`/api/holidays?land=${land}&year=${y}`)
          .then((r) => r.json())
          .catch(() => ({ holidays: [] }))
      )
    )
      .then((results) => {
        if (cancelled) return;
        const today = new Date().toISOString().slice(0, 10);
        const merged = results
          .flatMap((r: any) => r.holidays || [])
          .filter((h: any) => h.date >= today)
          .sort((a: any, b: any) => a.date.localeCompare(b.date))
          .slice(0, 12);
        setHolidays(merged);
      })
      .finally(() => {
        if (!cancelled) setHolidaysLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [formData.bundesland]);

  // Add or replace the exception for a date (one exception per date).
  const upsertException = (ex: ScheduleException) => {
    setFormData((prev) => {
      const others = (prev.exceptions || []).filter((e) => e.date !== ex.date);
      return {
        ...prev,
        exceptions: [...others, ex].sort((a, b) => a.date.localeCompare(b.date)),
      };
    });
  };

  const removeException = (date: string) => {
    setFormData((prev) => ({
      ...prev,
      exceptions: (prev.exceptions || []).filter((e) => e.date !== date),
    }));
  };

  const handleAddException = () => {
    if (!draftDate) {
      toast.error('Bitte ein Datum wählen');
      return;
    }
    if (!draftClosed) {
      if (!draftOpen || !draftClose) {
        toast.error('Bitte Öffnungs- und Schließzeit angeben');
        return;
      }
      if (draftOpen >= draftClose) {
        toast.error('Öffnungszeit muss vor der Schließzeit liegen');
        return;
      }
    }
    upsertException(
      draftClosed
        ? { date: draftDate, closed: true, note: draftNote.trim() || undefined }
        : {
            date: draftDate,
            closed: false,
            open: draftOpen,
            close: draftClose,
            note: draftNote.trim() || undefined,
          }
    );
    setDraftDate('');
    setDraftClosed(true);
    setDraftOpen('09:00');
    setDraftClose('13:00');
    setDraftNote('');
  };

  const formatExceptionDate = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleOpeningHoursChange = (day: number, field: keyof OpeningHours, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      openingHours: (prev.openingHours || defaultOpeningHours).map((hours) =>
        hours.day === day ? { ...hours, [field]: value } : hours
      ),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Standortname ist erforderlich');
      return;
    }

    try {
      if (onSubmit) {
        await onSubmit(formData);
      }
    } catch (error) {
      toast.error('Formular konnte nicht eingereicht werden');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-700 dark:text-slate-300"
        >
          Standortname
        </label>
        <Input
          id="name"
          name="name"
          type="text"
          placeholder="z.B. Hauptbüro"
          value={formData.name}
          onChange={handleChange}
          required
          className="mt-1"
        />
      </div>

      <div>
        <label
          htmlFor="address"
          className="block text-sm font-medium text-gray-700 dark:text-slate-300"
        >
          Adresse
        </label>
        <Input
          id="address"
          name="address"
          type="text"
          placeholder="z.B. Musterstraße 123, 12345 Stadt"
          value={formData.address}
          onChange={handleChange}
          className="mt-1"
        />
      </div>

      <div>
        <label
          htmlFor="timezone"
          className="block text-sm font-medium text-gray-700 dark:text-slate-300"
        >
          Zeitzone
        </label>
        <select
          id="timezone"
          name="timezone"
          value={formData.timezone}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          {timezones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
      </div>

      {/* Opening Hours */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
          Öffnungszeiten
        </label>
        <div className="space-y-2 bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">
          {(formData.openingHours || defaultOpeningHours).map((hours) => (
            <div key={hours.day} className="flex items-center gap-2">
              <span className="w-24 text-sm text-gray-600 dark:text-slate-400">
                {DAYS.find(d => d.value === hours.day)?.label}
              </span>
              <input
                type="checkbox"
                checked={!hours.closed}
                onChange={(e) => handleOpeningHoursChange(hours.day, 'closed', !e.target.checked)}
                className="w-4 h-4"
              />
              {!hours.closed && (
                <>
                  <input
                    type="time"
                    value={hours.open}
                    onChange={(e) => handleOpeningHoursChange(hours.day, 'open', e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1 text-sm dark:bg-slate-900"
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="time"
                    value={hours.close}
                    onChange={(e) => handleOpeningHoursChange(hours.day, 'close', e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1 text-sm dark:bg-slate-900"
                  />
                </>
              )}
              {hours.closed && (
                <span className="text-sm text-gray-400">Geschlossen</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bundesland (für gesetzliche Feiertage) */}
      <div>
        <label
          htmlFor="bundesland"
          className="block text-sm font-medium text-gray-700 dark:text-slate-300"
        >
          Bundesland (für gesetzliche Feiertage)
        </label>
        <select
          id="bundesland"
          name="bundesland"
          value={formData.bundesland || ''}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="">Kein automatisches Feiertags-Handling</option>
          {GERMAN_STATES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
          An gesetzlichen Feiertagen ist automatisch geschlossen. Einzelne Tage kannst du unten überschreiben.
        </p>
      </div>

      {/* Feiertage-Vorschau */}
      {formData.bundesland && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            Kommende Feiertage (automatisch geschlossen)
          </label>
          <div className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg max-h-40 overflow-y-auto text-sm">
            {holidaysLoading ? (
              <p className="text-gray-400">Lädt…</p>
            ) : holidays.length === 0 ? (
              <p className="text-gray-400">Keine Feiertage gefunden.</p>
            ) : (
              <ul className="space-y-1">
                {holidays.map((h) => (
                  <li
                    key={h.date}
                    className="flex justify-between gap-2 text-gray-600 dark:text-slate-300"
                  >
                    <span>{h.name}</span>
                    <span className="text-gray-400 shrink-0">{formatExceptionDate(h.date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Ausnahmen (einzelne Tage) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
          Ausnahmen (einzelne Tage)
        </label>
        <div className="space-y-2 bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">
          {(formData.exceptions || []).length > 0 && (
            <ul className="space-y-1">
              {(formData.exceptions || []).map((ex) => (
                <li key={ex.date} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-gray-700 dark:text-slate-200">
                    <span className="font-medium">{formatExceptionDate(ex.date)}</span>
                    {' – '}
                    {ex.closed ? 'Geschlossen' : `${ex.open}–${ex.close} Uhr`}
                    {ex.note ? ` (${ex.note})` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeException(ex.date)}
                    className="text-red-500 hover:text-red-700 text-xs shrink-0"
                  >
                    Entfernen
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Neue Ausnahme */}
          <div className="flex flex-col gap-2 border-t border-gray-200 dark:border-slate-700 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1 text-sm dark:bg-slate-900"
              />
              <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={draftClosed}
                  onChange={(e) => setDraftClosed(e.target.checked)}
                  className="w-4 h-4"
                />
                Geschlossen
              </label>
              {!draftClosed && (
                <>
                  <input
                    type="time"
                    value={draftOpen}
                    onChange={(e) => setDraftOpen(e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1 text-sm dark:bg-slate-900"
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="time"
                    value={draftClose}
                    onChange={(e) => setDraftClose(e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1 text-sm dark:bg-slate-900"
                  />
                </>
              )}
            </div>
            <Input
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              placeholder="Grund (optional, z.B. Betriebsausflug)"
              className="text-sm"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleAddException}
              className="self-start"
            >
              Ausnahme hinzufügen
            </Button>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? 'Speichern...' : 'Standort speichern'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
