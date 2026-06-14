// @ts-nocheck
'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus, Briefcase } from 'lucide-react';
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
import { mockOfferings } from '@/lib/mock-data';
import { OfferingForm } from '@/components/OfferingForm';
import { OfferingImageUploadControl } from '@/components/OfferingImageUploadControl';

interface Service {
  id: string;
  name: string;
  description?: string;
  duration: number;
  price?: number;
  organization_id?: string;
  organizationId?: string;
  image_url?: string | null;
  imageUrl?: string | null;
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const supabase = createClient();

  const mapOfferingToService = (offering: any): Service => {
    const duration = offering.duration_minutes ?? offering.durationMinutes ?? 0;
    const priceCents = offering.price_cents ?? offering.priceCents ?? null;
    return {
      id: offering.id,
      name: offering.name,
      description: offering.description || undefined,
      duration,
      price: typeof priceCents === 'number' ? priceCents / 100 : undefined,
      organization_id: offering.organization_id,
      organizationId: offering.organizationId,
      image_url: offering.image_url ?? offering.imageUrl ?? null,
      imageUrl: offering.imageUrl ?? offering.image_url ?? null,
    };
  };

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);

      if (isMockMode()) {
        const mapped = mockOfferings.map((offering) => ({
          id: offering.id,
          name: offering.name,
          description: offering.description || undefined,
          duration: offering.duration_minutes,
          price: offering.price_cents ? offering.price_cents / 100 : undefined,
          organization_id: offering.organization_id,
          image_url: offering.image_url ?? null,
        }));
        setServices(mapped);
        return;
      }

      const { data, error } = await supabase
        .from('offerings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const mapped = (data || []).map((offering) => ({
        id: offering.id,
        name: offering.name,
        description: offering.description || undefined,
        duration: offering.duration_minutes,
        price: offering.price_cents ? offering.price_cents / 100 : undefined,
        organization_id: offering.organization_id,
        image_url: offering.image_url ?? null,
      }));
      setServices(mapped);
    } catch (error) {
      toast.error('Leistungen konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const handleCreated = (offering: unknown) => {
    if (isMockMode()) {
      const newService = mapOfferingToService(offering);
      setServices((prev) => [newService, ...prev]);
      return;
    }

    fetchServices();
  };

  const handleUpdated = (updatedOffering: unknown) => {
    const updated = mapOfferingToService(updatedOffering);
    setServices((prev) =>
      prev.map((service) => (service.id === updated.id ? { ...service, ...updated } : service))
    );
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bist du sicher, dass du diese Leistung löschen möchtest?')) return;

    try {
      if (isMockMode()) {
        setServices(services.filter((s) => s.id !== id));
        toast.success('Leistung erfolgreich gelöscht');
        return;
      }

      const { error } = await supabase
        .from('offerings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setServices(services.filter((s) => s.id !== id));
      toast.success('Leistung erfolgreich gelöscht');
    } catch (error) {
      toast.error('Leistung konnte nicht gelöscht werden');
    }
  };

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100">Leistungen</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
            Verwalte deine Buchungsleistungen
          </p>
        </div>
        <Button onClick={() => setShowModal(true)} className="flex items-center gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Leistung hinzufügen
        </Button>
      </div>

      {loading ? (
        <SkeletonGrid count={3} />
      ) : services.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-12 w-12" />}
          title="Noch keine Leistungen"
          description="Erstelle deine erste Leistung, um Buchungen zu verwalten"
          action={{
            label: 'Leistung erstellen',
            onClick: () => setShowModal(true),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <div
              key={service.id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  {(service.image_url ?? service.imageUrl) && (
                    <img
                      src={service.image_url ?? service.imageUrl ?? ''}
                      alt={`${service.name} Bild`}
                      className="h-14 w-14 flex-shrink-0 rounded-lg object-cover ring-1 ring-gray-200 dark:ring-slate-700"
                      loading="lazy"
                    />
                  )}
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 truncate dark:text-slate-100">{service.name}</h3>
                    {service.description && (
                      <p className="mt-1 text-sm text-gray-600 line-clamp-2 dark:text-slate-400">{service.description}</p>
                    )}
                    <div className="mt-2 space-y-1 text-xs text-gray-500 dark:text-slate-400">
                      <p>Dauer: {service.duration} Min</p>
                      {service.price !== undefined && <p>Preis: €{service.price.toFixed(2)}</p>}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(service.id)}
                  className="text-red-600 hover:text-red-900 flex-shrink-0 dark:text-red-400 dark:hover:text-red-300"
                  title="Löschen"
                >
                  ✕
                </button>
              </div>
              <OfferingImageUploadControl offering={service} onUpdated={handleUpdated} />
            </div>
          ))}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Neue Leistung erstellen</DialogTitle>
          </DialogHeader>
          <OfferingForm onCreated={handleCreated} onCancel={() => setShowModal(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
