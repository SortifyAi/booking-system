ALTER TABLE resources ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE offerings ADD COLUMN IF NOT EXISTS image_url TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resource-images',
  'resource-images',
  true,
  1048576,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'resource images insert for org managers'
  ) THEN
    CREATE POLICY "resource images insert for org managers"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'resource-images'
      AND EXISTS (
        SELECT 1
        FROM public.user_organizations uo
        WHERE uo.user_id = auth.uid()
          AND uo.organization_id::text = (storage.foldername(name))[1]
          AND uo.role IN ('owner', 'admin', 'manager')
      )
    );
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'offering-images',
  'offering-images',
  true,
  1048576,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'offering images insert for org managers'
  ) THEN
    CREATE POLICY "offering images insert for org managers"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'offering-images'
      AND EXISTS (
        SELECT 1
        FROM public.user_organizations uo
        WHERE uo.user_id = auth.uid()
          AND uo.organization_id::text = (storage.foldername(name))[1]
          AND uo.role IN ('owner', 'admin', 'manager')
      )
    );
  END IF;
END $$;
