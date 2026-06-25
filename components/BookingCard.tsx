import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { MapPin, Clock, Edit2, Trash2, Phone, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BookingCardProps {
  id: string;
  locationName: string;
  startTime: string;
  endTime: string;
  status?: 'confirmed' | 'pending' | 'cancelled' | 'completed' | 'no_show';
  guestName?: string;
  guestPhone?: string | null;
  guestEmail?: string | null;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const statusLabels: Record<string, string> = {
  confirmed: 'Bestätigt',
  pending: 'Ausstehend',
  cancelled: 'Storniert',
  completed: 'Abgeschlossen',
  no_show: 'Nicht erschienen',
};

export function BookingCard({
  id,
  locationName,
  startTime,
  endTime,
  status = 'pending',
  guestName,
  guestPhone,
  guestEmail,
  onEdit,
  onDelete,
}: BookingCardProps) {
  const statusColors: Record<string, string> = {
    confirmed: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30',
    pending: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-500/30',
    cancelled: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30',
    completed: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30',
    no_show: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30',
  };

  const startDate = new Date(startTime);
  const endDate = new Date(endTime);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow dark:border-slate-800 dark:bg-slate-900">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 truncate dark:text-slate-100">
              {guestName || 'Gast'}
            </h3>
            <p className="mt-1 flex items-center gap-1 text-xs text-gray-600 truncate dark:text-slate-400">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              {locationName}
            </p>
          </div>
          <div className={`rounded px-2 py-1 text-xs font-medium border whitespace-nowrap flex-shrink-0 ${statusColors[status] || statusColors.pending}`}>
            {statusLabels[status] || status}
          </div>
        </div>

        <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-slate-400">
          <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="truncate">{format(startDate, 'dd.MM.yyyy', { locale: de })}</p>
            <p className="text-xs whitespace-nowrap">
              {format(startDate, 'HH:mm', { locale: de })} - {format(endDate, 'HH:mm', { locale: de })} Uhr
            </p>
          </div>
        </div>

        {(guestPhone || guestEmail) && (
          <div className="space-y-1.5 text-sm text-gray-600 dark:text-slate-400">
            {guestPhone && (
              <a
                href={`tel:${guestPhone}`}
                className="flex items-center gap-2 hover:text-blue-600 dark:hover:text-blue-400"
                title="Anrufen"
              >
                <Phone className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{guestPhone}</span>
              </a>
            )}
            {guestEmail && (
              <a
                href={`mailto:${guestEmail}`}
                className="flex items-center gap-2 hover:text-blue-600 dark:hover:text-blue-400"
                title="E-Mail senden"
              >
                <Mail className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{guestEmail}</span>
              </a>
            )}
          </div>
        )}

        <div className="flex gap-2 border-t border-gray-100 pt-3 dark:border-slate-800">
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(id)}
              className="flex-1 text-gray-600 hover:text-gray-900 dark:text-slate-300 dark:hover:text-white"
              title="Bearbeiten"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(id)}
              className="flex-1 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
              title="Löschen"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
