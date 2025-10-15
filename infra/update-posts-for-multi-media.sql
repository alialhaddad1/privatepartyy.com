-- Update event_posts table to support captions and multiple media items
-- Add caption field to event_posts
ALTER TABLE event_posts ADD COLUMN IF NOT EXISTS caption TEXT;

-- Update the type check to include 'media' type for multi-media posts
ALTER TABLE event_posts DROP CONSTRAINT IF EXISTS event_posts_type_check;
ALTER TABLE event_posts ADD CONSTRAINT event_posts_type_check
  CHECK (type IN ('text', 'image', 'media'));

-- Create event_post_media table for storing multiple media items per post
CREATE TABLE IF NOT EXISTS event_post_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES event_posts(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  media_url TEXT NOT NULL,
  file_key TEXT NOT NULL,
  thumbnail_url TEXT,
  original_filename TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on post_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_event_post_media_post_id ON event_post_media(post_id);

-- Create index on display_order for sorting
CREATE INDEX IF NOT EXISTS idx_event_post_media_order ON event_post_media(post_id, display_order);

-- Enable Row Level Security
ALTER TABLE event_post_media ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to read media
CREATE POLICY "Allow public read access" ON event_post_media
  FOR SELECT
  TO public
  USING (true);

-- Create policy to allow anyone to insert media
CREATE POLICY "Allow public insert" ON event_post_media
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Create policy to allow users to delete media from their own posts
CREATE POLICY "Allow users to delete own media" ON event_post_media
  FOR DELETE
  TO public
  USING (
    post_id IN (
      SELECT id FROM event_posts
      WHERE author_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );
