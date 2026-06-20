// @ts-nocheck
'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonGrid } from '@/components/ui/skeleton';
import { isMockMode } from '@/lib/utils/mock';
import { mockResources } from '@/lib/mock-data';
import { getPrimaryLocationId, getPrimaryOrganizationId } from '@/lib/utils/supabase-helpers';
import { ResourceForm } from '@/components/ResourceForm';
import { ResourceAvatar } from '@/components/ResourceAvatar';
import { ResourceImageUploadControl } from '@/components/ResourceImageUploadControl';
import { CalendarShareLinks } from '@/components/CalendarShareLinks';

interface Resource {
  id: string;
  name: string;
  type: string;
  organization_id?: string;
  organizationId?: string;
  image_url?: string | null;
  imageUrl?: string | null;
}

export default function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const supabase = createClient();

  const fetchResources = useCallback(async () => {
    try {
      setLoading(true);

      if (isMockMode()) {
        const mapped = mockResources.map((resource) => ({
          id: resource.id,
          name: resource.name,
          type: resource.type,
          organization_id: resource.organization_id,
          image_url: resource.image_url ?? null,
        }));
        setResources(mapped);
        return;
      }

      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setResources((data || []) as Resource[]);
    } catch (error) {
      toast.error('Personal konnte nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const handleCreated = (resource: unknown) => {
    if (isMockMode()) {
      const mapped = (resource as any) as Resource;
      setResources((prev) => [mapped, ...prev]);
      return;
    }

    fetchResources();
  };

  const handleUpdated = (updatedResource: unknown) => {
    const updated = updatedResource as Resource;
    setResources((prev) =>
      prev.map((resource) => (resource.id === updated.id ? { ...resource, ...updated } : resource))
    );
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bist du sicher, dass du diesen Personaleintrag löschen möchtest?')) return;

    try {
      if (isMockMode()) {
        setResources(resources.filter((r) => r.id !== id));
        toast.success('Personal erfolgreich gelöscht');
        return;
      }

      const { error } = await supabase
        .from('resources')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setResources(resources.filter((r) => r.id !== id));
      toast.success('Personal erfolgreich gelöscht');
    } catch (error) {
      toast.error('Personal konnte nicht gelöscht werden');
    }
  };

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const typeLabels: Record<string, string> = {
    staff: 'Mitarbeiter',
    room: 'Raum',
    equipment: 'Ausrüstung',
    table: 'Tisch',
  };
  const staffResources = resources.filter((resource) => resource.type === 'staff');

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100">Personal</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
            Verwalte dein Personal und Ressourcen
          </p>
        </div>
        <Button onClick={() => setShowModal(true)} className="flex items-center gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Personal hinzufügen
        </Button>
      </div>

      {loading ? (
        <SkeletonGrid count={3} />
      ) : resources.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12" />}
          title="Noch kein Personal"
          description="Füge dein Team oder deine Ressourcen hinzu, um Buchungen zu verwalten"
          action={{
            label: 'Personal erstellen',
            onClick: () => setShowModal(true),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {resources.map((resource) => (
            <div
              key={resource.id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <ResourceAvatar
                    name={resource.name}
                    imageUrl={resource.image_url ?? resource.imageUrl}
                    className="h-12 w-12"
                  />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 truncate dark:text-slate-100">{resource.name}</h3>
                    <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                      Typ: {typeLabels[resource.type] || resource.type}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(resource.id)}
                  className="text-red-600 hover:text-red-900 flex-shrink-0 dark:text-red-400 dark:hover:text-red-300"
                  title="Löschen"
                >
                  ✕
                </button>
              </div>
              {resource.type === 'staff' && (
                <ResourceImageUploadControl resource={resource} onUpdated={handleUpdated} />
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && <CalendarShareLinks resources={staffResources} />}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Neuen Personaleintrag erstellen</DialogTitle>
          </DialogHeader>
          <ResourceForm onCreated={handleCreated} onCancel={() => setShowModal(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
