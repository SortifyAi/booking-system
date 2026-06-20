-- Login-free, token-based staff calendar sharing.
-- Public visitors never read this table directly; public access goes through
-- the server-side token API, which uses the service role and serializes a
-- reduced booking payload.

CREATE TABLE IF NOT EXISTS calendar_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  token TEXT NOT NULL UNIQUE CHECK (length(token) >= 32),
  allowed_resource_ids UUID[] NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT calendar_share_links_allowed_resources_nonempty
    CHECK (cardinality(allowed_resource_ids) > 0)
);

CREATE INDEX IF NOT EXISTS idx_calendar_share_links_org_id
  ON calendar_share_links(organization_id);

CREATE INDEX IF NOT EXISTS idx_calendar_share_links_active_token
  ON calendar_share_links(token)
  WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS calendar_share_links_updated_at ON calendar_share_links;
CREATE TRIGGER calendar_share_links_updated_at BEFORE UPDATE ON calendar_share_links
FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE calendar_share_links ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE calendar_share_links FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE calendar_share_links TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE calendar_share_links TO service_role;

DROP POLICY IF EXISTS "calendar_share_links_select" ON calendar_share_links;
DROP POLICY IF EXISTS "calendar_share_links_insert" ON calendar_share_links;
DROP POLICY IF EXISTS "calendar_share_links_update" ON calendar_share_links;
DROP POLICY IF EXISTS "calendar_share_links_delete" ON calendar_share_links;

CREATE POLICY "calendar_share_links_select" ON calendar_share_links
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "calendar_share_links_insert" ON calendar_share_links
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "calendar_share_links_update" ON calendar_share_links
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('owner', 'admin', 'manager')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "calendar_share_links_delete" ON calendar_share_links
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('owner', 'admin', 'manager')
    )
  );
