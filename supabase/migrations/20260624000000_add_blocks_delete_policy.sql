-- Add missing DELETE policy for blocks table.
-- Without this, RLS silently rejects deletions (no error returned, but row stays in DB).
-- Only owners and admins can delete blocks, matching the API-level permission check.
CREATE POLICY delete_blocks ON blocks FOR DELETE
USING (organization_id IN (
  SELECT organization_id FROM user_organizations
  WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
));
