// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateOffering } from '@/lib/hooks/use-offerings';
import { useOrgLocationOptions } from '@/lib/hooks/use-org-location-options';
import { uploadCompressedOfferingImage } from '@/lib/resource-image-upload.mjs';
import { CreateOfferingSchema } from '@/lib/validations/schemas';
import { isMockMode } from '@/lib/utils/mock';
import { z } from 'zod';

interface OfferingFormProps {
  onCreated?: (offering: unknown) => void;
  onCancel?: () => void;
}

export function OfferingForm({ onCreated, onCancel }: OfferingFormProps) {
  const { mutateAsync, isPending } = useCreateOffering();
  const {
    organizations,
    locations,
    selectedOrganizationId,
    selectedLocationId,
    setSelectedOrganizationId,
    setSelectedLocationId,
    loadingOrganizations,
    loadingLocations,
  } = useOrgLocationOptions();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    durationMinutes: 60,
    price: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const showOrganizationSelect = organizations.length > 1;
  const showLocationSelect = locations.length > 1;

  const organizationPlaceholder = useMemo(() => {
    if (loadingOrganizations) return 'Organisationen laden...';
    if (!organizations.length) return 'Keine Organisationen verfügbar';
    return 'Organisation auswählen';
  }, [loadingOrganizations, organizations.length]);

  const locationPlaceholder = useMemo(() => {
    if (loadingLocations) return 'Standorte laden...';
    if (!locations.length) return 'Keine Standorte verfügbar';
    return 'Standort auswählen';
  }, [loadingLocations, locations.length]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedOrganizationId) {
      toast.error('Bitte eine Organisation auswählen');
      return;
    }

    if (!selectedLocationId) {
      toast.error('Bitte einen Standort auswählen');
      return;
    }

    const priceValue = formData.price.trim();
    const priceNumber = priceValue.length ? Number(priceValue) : null;
    if (priceNumber !== null && Number.isNaN(priceNumber)) {
      toast.error('Bitte einen gültigen Preis eingeben');
      return;
    }

    const payload = {
      organizationId: selectedOrganizationId,
      locationId: selectedLocationId,
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      durationMinutes: formData.durationMinutes,
      capacity: 1,
      priceCents: priceNumber !== null ? Math.round(priceNumber * 100) : undefined,
    };

    const schema = isMockMode()
      ? CreateOfferingSchema.extend({
          organizationId: z.string().min(1, 'Organisation ist erforderlich'),
          locationId: z.string().min(1, 'Standort ist erforderlich'),
        })
      : CreateOfferingSchema;

    const validation = schema.safeParse(payload);
    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message || 'Bitte alle Pflichtfelder ausfüllen');
      return;
    }

    try {
      let created = await mutateAsync(validation.data) as any;

      if (imageFile) {
        if (isMockMode()) {
          created = { ...created, image_url: URL.createObjectURL(imageFile) };
        } else {
          setUploadingImage(true);
          const supabase = createClient();
          const imageUrl = await uploadCompressedOfferingImage({
            supabase,
            file: imageFile,
            organizationId: selectedOrganizationId,
            offeringId: created.id,
          });

          const response = await fetch(`/api/offerings/${created.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl }),
          });

          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Bild konnte nicht gespeichert werden');
          }

          created = await response.json();
        }
      }

      toast.success('Leistung erfolgreich erstellt');
      setFormData({ name: '', description: '', durationMinutes: 60, price: '' });
      setImageFile(null);
      onCreated?.(created);
      onCancel?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Leistung konnte nicht erstellt werden';
      toast.error(message);
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {showOrganizationSelect ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
            Organisation
          </label>
          <Select
            value={selectedOrganizationId ?? undefined}
            onValueChange={(value) => setSelectedOrganizationId(value)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder={organizationPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {showLocationSelect ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
            Standort
          </label>
          <Select
            value={selectedLocationId ?? undefined}
            onValueChange={(value) => setSelectedLocationId(value)}
            disabled={!selectedOrganizationId || loadingLocations}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder={locationPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
          Leistungsname
        </label>
        <Input
          type="text"
          placeholder="z.B. Beratung"
          value={formData.name}
          onChange={(event) => setFormData({ ...formData, name: event.target.value })}
          className="mt-1"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
          Beschreibung
        </label>
        <textarea
          placeholder="Beschreibe die Leistung"
          value={formData.description}
          onChange={(event) => setFormData({ ...formData, description: event.target.value })}
          className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
            Dauer (Min)
          </label>
          <Input
            type="number"
            min={15}
            step={15}
            value={formData.durationMinutes}
            onChange={(event) =>
              setFormData({ ...formData, durationMinutes: Number(event.target.value) })
            }
            className="mt-1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
            Preis (€)
          </label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={formData.price}
            onChange={(event) => setFormData({ ...formData, price: event.target.value })}
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
          Leistungsbild
        </label>
        <Input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
          className="mt-1"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
          Optional. Wird in der Buchung nur angezeigt, wenn ein Bild vorhanden ist.
        </p>
        {imageFile && (
          <p className="mt-1 text-xs font-medium text-gray-700 dark:text-slate-300">
            Ausgewählt: {imageFile.name}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending || uploadingImage} className="flex-1">
          {isPending || uploadingImage ? 'Speichern...' : 'Speichern'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
