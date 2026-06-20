ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS phone TEXT;

UPDATE public.bookings
SET customer_email = lower(btrim(customer_email))
WHERE customer_email IS DISTINCT FROM lower(btrim(customer_email));

CREATE OR REPLACE FUNCTION public.normalize_booking_customer_email()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.customer_email := lower(btrim(NEW.customer_email));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_booking_customer_email ON public.bookings;
CREATE TRIGGER normalize_booking_customer_email
BEFORE INSERT OR UPDATE OF customer_email ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.normalize_booking_customer_email();

CREATE TABLE public.customer_email_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  normalized_email TEXT NOT NULL,
  reason TEXT,
  source_booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  blocked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unblocked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  unblocked_at TIMESTAMPTZ,
  CONSTRAINT customer_email_blocks_normalized
    CHECK (normalized_email = lower(btrim(normalized_email)))
);

CREATE UNIQUE INDEX customer_email_blocks_one_active
  ON public.customer_email_blocks (organization_id, normalized_email)
  WHERE unblocked_at IS NULL;

CREATE INDEX customer_email_blocks_org_lookup
  ON public.customer_email_blocks (organization_id, normalized_email, unblocked_at);

ALTER TABLE public.customer_email_blocks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.customer_email_blocks FROM anon;
GRANT SELECT, INSERT ON TABLE public.customer_email_blocks TO authenticated;
GRANT UPDATE (unblocked_at, unblocked_by) ON TABLE public.customer_email_blocks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.customer_email_blocks TO service_role;
REVOKE EXECUTE ON FUNCTION public.normalize_booking_customer_email() FROM anon, authenticated;

CREATE POLICY "customer_email_blocks_member_select"
ON public.customer_email_blocks FOR SELECT TO authenticated
USING (
  organization_id IN (
    SELECT organization_id
    FROM public.user_organizations
    WHERE user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "customer_email_blocks_admin_insert"
ON public.customer_email_blocks FOR INSERT TO authenticated
WITH CHECK (
  blocked_by = (SELECT auth.uid())
  AND organization_id IN (
    SELECT organization_id
    FROM public.user_organizations
    WHERE user_id = (SELECT auth.uid())
      AND role IN ('owner', 'admin')
  )
);

CREATE POLICY "customer_email_blocks_admin_update"
ON public.customer_email_blocks FOR UPDATE TO authenticated
USING (
  organization_id IN (
    SELECT organization_id
    FROM public.user_organizations
    WHERE user_id = (SELECT auth.uid())
      AND role IN ('owner', 'admin')
  )
)
WITH CHECK (
  unblocked_at IS NOT NULL
  AND unblocked_by = (SELECT auth.uid())
  AND organization_id IN (
    SELECT organization_id
    FROM public.user_organizations
    WHERE user_id = (SELECT auth.uid())
      AND role IN ('owner', 'admin')
  )
);
