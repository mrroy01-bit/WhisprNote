/*
  # Add Page Sharing + Public Access

  1. pages
    - Add `is_public` boolean flag
    - Expand SELECT/UPDATE policies to allow shared/public access

  2. page_shares
    - Store email-based sharing entries
    - Support view/edit permissions

  3. Security
    - Owners can manage shares for their pages
    - Recipients can read their own share entries
*/

ALTER TABLE pages
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS page_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  shared_email text NOT NULL,
  permission text NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_page_shares_page_email_unique
  ON page_shares (page_id, lower(shared_email));

CREATE INDEX IF NOT EXISTS idx_page_shares_email
  ON page_shares (lower(shared_email));

ALTER TABLE page_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own pages" ON pages;
DROP POLICY IF EXISTS "Users can update own pages" ON pages;

CREATE POLICY "Users can view accessible pages"
  ON pages FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_public = true
    OR EXISTS (
      SELECT 1
      FROM page_shares ps
      WHERE ps.page_id = pages.id
        AND lower(ps.shared_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

CREATE POLICY "Users can update editable pages"
  ON pages FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM page_shares ps
      WHERE ps.page_id = pages.id
        AND ps.permission = 'edit'
        AND lower(ps.shared_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM page_shares ps
      WHERE ps.page_id = pages.id
        AND ps.permission = 'edit'
        AND lower(ps.shared_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

DROP POLICY IF EXISTS "Owners can manage page shares" ON page_shares;
DROP POLICY IF EXISTS "Recipients can view their page shares" ON page_shares;

CREATE POLICY "Owners can manage page shares"
  ON page_shares
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM pages p
      WHERE p.id = page_shares.page_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM pages p
      WHERE p.id = page_shares.page_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Recipients can view their page shares"
  ON page_shares
  FOR SELECT
  TO authenticated
  USING (
    lower(shared_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
