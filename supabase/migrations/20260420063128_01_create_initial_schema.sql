/*
  # Create NotionClone Database Schema

  1. New Tables
    - `profiles` - User profile data linked to auth.users
      - `id` (uuid, primary key, references auth.users)
      - `email` (text)
      - `name` (text)
      - `avatar_color` (text, for avatar background)
      - `theme` (text, 'light' or 'dark')
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `pages` - Main notes/pages table with hierarchical structure
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `title` (text)
      - `content` (jsonb, array of blocks)
      - `parent_id` (uuid, self-referencing for nesting)
      - `icon` (text, emoji)
      - `color` (text, hex color for icon background)
      - `cover_image_url` (text)
      - `is_starred` (boolean)
      - `is_deleted` (boolean)
      - `position` (integer, for sorting siblings)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Users can only read/write/delete their own data
    - Row level security policies enforce user_id ownership

  3. Indexes
    - Index on pages(user_id) for fast queries
    - Index on pages(parent_id) for hierarchy traversal
    - Index on pages(updated_at) for ordering
    - Index on pages(is_deleted, user_id) for trash view
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text DEFAULT 'Untitled',
  avatar_color text DEFAULT '#3B82F6',
  theme text DEFAULT 'light',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE TABLE IF NOT EXISTS pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text DEFAULT 'Untitled',
  content jsonb DEFAULT '[]'::jsonb,
  parent_id uuid REFERENCES pages(id) ON DELETE CASCADE,
  icon text DEFAULT '📄',
  color text DEFAULT 'bg-slate-100',
  cover_image_url text,
  is_starred boolean DEFAULT false,
  is_deleted boolean DEFAULT false,
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pages"
  ON pages FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own pages"
  ON pages FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own pages"
  ON pages FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own pages"
  ON pages FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_pages_user_id ON pages(user_id);
CREATE INDEX IF NOT EXISTS idx_pages_parent_id ON pages(parent_id);
CREATE INDEX IF NOT EXISTS idx_pages_updated_at ON pages(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_pages_deleted_user ON pages(is_deleted, user_id);
CREATE INDEX IF NOT EXISTS idx_pages_starred_user ON pages(is_starred, user_id);
