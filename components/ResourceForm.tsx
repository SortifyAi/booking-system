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
import { useCreateResource } from '@/lib/hooks/use-resources';
import { useOrgLocationOptions } from '@/lib/hooks/use-org-location-options';
import { uploadCompressedResourceImage } from '@/lib/resource-image-upload.mjs';
import { CreateResourceSchema } from '@/lib/validations/schemas';
import { isMockMode } from '@/lib/utils/mock';
import { z } from 'zod';

interface ResourceFormProps {
  onCreated?: (resource: unknown) => void;
  onCancel?: () => void;
}

const resourceTypeLabels: Record<string, string> = {
  staff: 'Mitarbeiter',
  room: 'Raum',
  equipment: 'Ausrüstung',
  table: 'Tisch',
};

export function ResourceForm({ onCreated, onCancel }: ResourceFormProps) {
  const { mutateAsync, isPending } = useCreateResource();
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
    type: 'staff',
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

    const payload = {
      organizationId: selectedOrganizationId,
      locationId: selectedLocationId,
      name: formData.name.trim(),
      type: formData.type as 'staff' | 'room' | 'equipment' | 'table',
      capacity: 1,
    };

    const schema = isMockMode()
      ? CreateResourceSchema.extend({
          organizationId: z.string().min(1, 'Organisation ist erforderlich'),
          locationId: z.string().min(1, 'Standort ist erforderlich'),
        })
      : CreateResourceSchema;

    const validation = schema.safeParse(payload);
    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message || 'Bitte alle Pflichtfelder ausfüllen');
      return;
    }

    try {
      let created = await mutateAsync(validation.data) as any;

      if (imageFile && formData.type === 'staff') {
        if (isMockMode()) {
          created = { ...created, image_url: URL.createObjectURL(imageFile) };
        } else {
          setUploadingImage(true);
          const supabase = createClient();
          const imageUrl = await uploadCompressedResourceImage({
            supabase,
            file: imageFile,
            organizationId: selectedOrganizationId,
            resourceId: created.id,
          });

          const response = await fetch(`/api/resources/${created.id}`, {
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

      toast.success('Personal erfolgreich erstellt');
      setFormData({ name: '', type: 'staff' });
      setImageFile(null);
      onCreated?.(created);
      onCancel?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Personal konnte nicht erstellt werden';
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
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Name</label>
        <Input
          type="text"
          placeholder="z.B. Max Mustermann"
          value={formData.name}
          onChange={(event) => setFormData({ ...formData, name: event.target.value })}
          className="mt-1"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
          Mitarbeiterbild
        </label>
        <Input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
          className="mt-1"
          disabled={formData.type !== 'staff'}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
          Optional. JPEG, PNG oder WebP. Wird automatisch komprimiert gespeichert.
        </p>
        {imageFile && (
          <p className="mt-1 text-xs font-medium text-gray-700 dark:text-slate-300">
            Ausgewählt: {imageFile.name}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Typ</label>
        <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Typ auswählen" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(resourceTypeLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
