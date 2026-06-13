// @ts-nocheck
'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { LocationCard } from '@/components/LocationCard';
import { LocationForm, LocationFormData } from '@/components/LocationForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, MapPin, Search, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonGrid } from '@/components/ui/skeleton';
import { isMockMode } from '@/lib/utils/mock';
import { mockLocations } from '@/lib/mock-data';
import { getPrimaryOrganizationId } from '@/lib/utils/supabase-helpers';

interface Location {
  id: string;
  name: string;
  address: string | null;
  timezone: string;
  organization_id: string;
  settings?: { openingHours?: any[]; bundesland?: string; exceptions?: any[] };
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const supabase = createClient();

  const fetchLocations = useCallback(async () => {
    try {
      setLoading(true);

      if (isMockMode()) {
        setLocations(mockLocations as Location[]);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error('Benutzer konnte nicht geladen werden');
        return;
      }

      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLocations((data || []) as Location[]);
    } catch (error) {
      toast.error('Standorte konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const handleCreateLocation = async (formData: LocationFormData) => {
    setSubmitting(true);
    try {
      if (isMockMode()) {
        const newLocation = {
          id: `mock-loc-${Date.now()}`,
          name: formData.name,
          address: formData.address || null,
          timezone: formData.timezone || 'Europe/Berlin',
          organization_id: 'org-1',
        } as Location;
        setLocations([newLocation, ...locations]);
        toast.success('Standort erfolgreich erstellt');
        closeModal();
        return;
      }

      const organizationId = await getPrimaryOrganizationId(supabase);
      if (!organizationId) {
        toast.error('Keine Organisation gefunden');
        return;
      }

      const { error } = await supabase.from('locations').insert({
        name: formData.name,
        address: formData.address,
        timezone: formData.timezone || 'UTC',
        organization_id: organizationId,
        settings: {
          openingHours: formData.openingHours ?? [],
          bundesland: formData.bundesland || '',
          exceptions: formData.exceptions ?? [],
        },
      });

      if (error) throw error;

      toast.success('Standort erfolgreich erstellt');
      closeModal();
      fetchLocations();
    } catch (error: any) {
      console.error('Error creating location:', error);
      toast.error(error?.message || 'Standort konnte nicht erstellt werden');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditLocation = async (formData: LocationFormData) => {
    if (!editingLocation) return;
    
    setSubmitting(true);
    try {
      if (isMockMode()) {
        setLocations(locations.map(loc => 
          loc.id === editingLocation.id 
            ? { ...loc, ...formData }
            : loc
        ));
        toast.success('Standort erfolgreich aktualisiert');
        closeModal();
        return;
      }

      const { error } = await supabase.from('locations').update({
        name: formData.name,
        address: formData.address,
        timezone: formData.timezone,
        settings: {
          ...(editingLocation.settings ?? {}),
          openingHours: formData.openingHours ?? [],
          bundesland: formData.bundesland || '',
          exceptions: formData.exceptions ?? [],
        },
      }).eq('id', editingLocation.id);

      if (error) throw error;

      toast.success('Standort erfolgreich aktualisiert');
      closeModal();
      fetchLocations();
    } catch (error) {
      console.error('Error updating location:', error);
      toast.error('Standort konnte nicht aktualisiert werden');
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingLocation(null);
  };

  const openEditModal = (location: Location) => {
    setEditingLocation(location);
    setShowModal(true);
  };

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const handleDelete = async (id: string) => {
    if (!confirm('Bist du sicher, dass du diesen Standort löschen möchtest?')) return;

    try {
      if (isMockMode()) {
        setLocations(locations.filter((loc) => loc.id !== id));
        toast.success('Standort erfolgreich gelöscht');
        return;
      }

      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setLocations(locations.filter((loc) => loc.id !== id));
      toast.success('Standort erfolgreich gelöscht');
    } catch (error) {
      toast.error('Standort konnte nicht gelöscht werden');
    }
  };

  // Filter locations by search query
  const filteredLocations = locations.filter(loc => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      loc.name.toLowerCase().includes(query) ||
      (loc.address?.toLowerCase().includes(query) ?? false)
    );
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100">Standorte</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
            Verwalte alle deine Buchungsstandorte
          </p>
        </div>
        <Button onClick={() => setShowModal(true)} className="flex items-center gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Standort hinzufügen
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Standorte suchen..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <SkeletonGrid count={3} />
      ) : filteredLocations.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-12 w-12" />}
          title={searchQuery ? "Keine Standorte gefunden" : "Noch keine Standorte"}
          description={searchQuery ? "Versuchen Sie einen anderen Suchbegriff" : "Erstelle deinen ersten Standort, um Buchungen zu verwalten"}
          action={{
            label: searchQuery ? 'Suche zurücksetzen' : 'Standort erstellen',
            onClick: searchQuery ? () => setSearchQuery('') : () => setShowModal(true),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredLocations.map((location) => (
            <LocationCard
              key={location.id}
              id={location.id}
              name={location.name}
              address={location.address || undefined}
              timezone={location.timezone}
              onEdit={(id) => {
                const loc = locations.find(l => l.id === id);
                if (loc) openEditModal(loc);
              }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={closeModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingLocation ? 'Standort bearbeiten' : 'Neuen Standort erstellen'}
            </DialogTitle>
          </DialogHeader>
          <LocationForm
            onSubmit={editingLocation ? handleEditLocation : handleCreateLocation}
            onCancel={closeModal}
            loading={submitting}
            initialData={editingLocation ? {
              name: editingLocation.name,
              address: editingLocation.address || '',
              timezone: editingLocation.timezone,
              openingHours: editingLocation.settings?.openingHours,
              bundesland: editingLocation.settings?.bundesland,
              exceptions: editingLocation.settings?.exceptions,
            } : undefined}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
