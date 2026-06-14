// @ts-nocheck
'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { uploadCompressedOfferingImage } from '@/lib/resource-image-upload.mjs';
import { isMockMode } from '@/lib/utils/mock';

interface OfferingImageUploadControlProps {
  offering: {
    id: string;
    name: string;
    organization_id?: string;
    organizationId?: string;
    image_url?: string | null;
  };
  onUpdated?: (offering: unknown) => void;
}

export function OfferingImageUploadControl({
  offering,
  onUpdated,
}: OfferingImageUploadControlProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const organizationId = offering.organization_id ?? offering.organizationId;
  const hasImage = Boolean(offering.image_url);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!organizationId) {
      toast.error('Organisation konnte nicht ermittelt werden');
      return;
    }

    try {
      setUploading(true);
      if (isMockMode()) {
        onUpdated?.({ ...offering, image_url: URL.createObjectURL(file) });
        toast.success('Leistungsbild aktualisiert');
        return;
      }

      const supabase = createClient();
      const imageUrl = await uploadCompressedOfferingImage({
        supabase,
        file,
        organizationId,
        offeringId: offering.id,
      });

      const response = await fetch(`/api/offerings/${offering.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Bild konnte nicht gespeichert werden');
      }

      const updated = await response.json();
      toast.success('Leistungsbild aktualisiert');
      onUpdated?.(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bild konnte nicht hochgeladen werden';
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="w-full gap-2"
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ImagePlus className="h-4 w-4" />
        )}
        {uploading ? 'Bild wird optimiert...' : hasImage ? 'Bild ändern' : 'Bild hinzufügen'}
      </Button>
      <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
        JPEG, PNG oder WebP. Wird automatisch komprimiert.
      </p>
    </div>
  );
}
