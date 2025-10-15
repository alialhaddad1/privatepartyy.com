-- Create event_posts table for storing posts in events
CREATE TABLE IF NOT EXISTS event_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'image')),
  content TEXT,
  image_url TEXT,
  file_key TEXT,
  original_filename TEXT,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_avatar TEXT,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on event_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_event_posts_event_id ON event_posts(event_id);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_event_posts_created_at ON event_posts(created_at DESC);

-- Create index on author_id for user queries
CREATE INDEX IF NOT EXISTS idx_event_posts_author_id ON event_posts(author_id);

-- Enable Row Level Security
ALTER TABLE event_posts ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to read posts
CREATE POLICY "Allow public read access" ON event_posts
  FOR SELECT
  TO public
  USING (true);

-- Create policy to allow anyone to create posts (adjust based on your auth requirements)
CREATE POLICY "Allow public insert" ON event_posts
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Create policy to allow users to update their own posts
CREATE POLICY "Allow users to update own posts" ON event_posts
  FOR UPDATE
  TO public
  USING (author_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Create policy to allow users to delete their own posts
CREATE POLICY "Allow users to delete own posts" ON event_posts
  FOR DELETE
  TO public
  USING (author_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_event_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS event_posts_updated_at ON event_posts;
CREATE TRIGGER event_posts_updated_at
  BEFORE UPDATE ON event_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_event_posts_updated_at();
