-- Create likes table for event_posts
CREATE TABLE IF NOT EXISTS event_post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES event_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT,
  user_avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Create comments table for event_posts
CREATE TABLE IF NOT EXISTS event_post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES event_posts(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_avatar TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for likes
CREATE INDEX IF NOT EXISTS idx_event_post_likes_post_id ON event_post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_event_post_likes_user_id ON event_post_likes(user_id);

-- Create indexes for comments
CREATE INDEX IF NOT EXISTS idx_event_post_comments_post_id ON event_post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_event_post_comments_created_at ON event_post_comments(created_at DESC);

-- Enable Row Level Security
ALTER TABLE event_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_post_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for likes - Allow anyone (including anonymous users) to interact
CREATE POLICY "Allow anyone to view likes" ON event_post_likes
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow anyone to like posts" ON event_post_likes
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow users to unlike their own likes" ON event_post_likes
  FOR DELETE
  TO public
  USING (true);

-- RLS Policies for comments - Allow anyone (including anonymous users) to interact
CREATE POLICY "Allow anyone to view comments" ON event_post_comments
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow anyone to comment on posts" ON event_post_comments
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow anyone to update their own comments" ON event_post_comments
  FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Allow anyone to delete their own comments" ON event_post_comments
  FOR DELETE
  TO public
  USING (true);

-- Create function to update comment updated_at timestamp
CREATE OR REPLACE FUNCTION update_event_post_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for comments updated_at
DROP TRIGGER IF EXISTS event_post_comments_updated_at ON event_post_comments;
CREATE TRIGGER event_post_comments_updated_at
  BEFORE UPDATE ON event_post_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_event_post_comments_updated_at();

-- Create function to update likes count on event_posts
CREATE OR REPLACE FUNCTION update_event_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE event_posts SET likes = likes + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE event_posts SET likes = GREATEST(likes - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update likes count
DROP TRIGGER IF EXISTS event_post_likes_count ON event_post_likes;
CREATE TRIGGER event_post_likes_count
  AFTER INSERT OR DELETE ON event_post_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_event_post_likes_count();

-- Create function to update comments count on event_posts
CREATE OR REPLACE FUNCTION update_event_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE event_posts SET comments = comments + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE event_posts SET comments = GREATEST(comments - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update comments count
DROP TRIGGER IF EXISTS event_post_comments_count ON event_post_comments;
CREATE TRIGGER event_post_comments_count
  AFTER INSERT OR DELETE ON event_post_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_event_post_comments_count();
