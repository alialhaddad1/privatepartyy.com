-- Create tables in the api schema (since that's what PostgREST is using)
-- Run this in your Supabase SQL Editor

-- ============================================
-- STEP 1: Create api schema if it doesn't exist
-- ============================================

CREATE SCHEMA IF NOT EXISTS api;

-- ============================================
-- STEP 2: Create tables in api schema
-- ============================================

-- Drop existing if any
DROP TABLE IF EXISTS api.post_comments CASCADE;
DROP TABLE IF EXISTS api.post_likes CASCADE;
DROP TABLE IF EXISTS api.posts CASCADE;
DROP TABLE IF EXISTS api.events CASCADE;

-- Create events table
CREATE TABLE api.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  time VARCHAR(5) NOT NULL,
  location VARCHAR(500),
  max_attendees INTEGER,
  current_attendees INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT TRUE,
  host_id VARCHAR(255) NOT NULL,
  host_name VARCHAR(255),
  host_email VARCHAR(255),
  tags TEXT[],
  image_url TEXT,
  token VARCHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create posts table
CREATE TABLE api.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES api.events(id) ON DELETE CASCADE,
  author_id VARCHAR(255) NOT NULL,
  author_name VARCHAR(255) NOT NULL,
  author_avatar TEXT,
  content TEXT,
  image_url TEXT,
  type VARCHAR(20) DEFAULT 'image' CHECK (type IN ('text', 'image')),
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create post_likes table
CREATE TABLE api.post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES api.posts(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Create post_comments table
CREATE TABLE api.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES api.posts(id) ON DELETE CASCADE,
  author_id VARCHAR(255) NOT NULL,
  author_name VARCHAR(255) NOT NULL,
  author_avatar TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- STEP 3: Create indexes
-- ============================================

CREATE INDEX idx_events_token ON api.events(token);
CREATE INDEX idx_events_is_public ON api.events(is_public);
CREATE INDEX idx_events_date ON api.events(date);
CREATE INDEX idx_events_host_id ON api.events(host_id);

CREATE INDEX idx_posts_event_id ON api.posts(event_id);
CREATE INDEX idx_posts_author_id ON api.posts(author_id);
CREATE INDEX idx_posts_created_at ON api.posts(created_at DESC);

CREATE INDEX idx_comments_post_id ON api.post_comments(post_id);
CREATE INDEX idx_comments_created_at ON api.post_comments(created_at DESC);

-- ============================================
-- STEP 4: DISABLE RLS (for now, to get it working)
-- ============================================

ALTER TABLE api.events DISABLE ROW LEVEL SECURITY;
ALTER TABLE api.posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE api.post_likes DISABLE ROW LEVEL SECURITY;
ALTER TABLE api.post_comments DISABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 5: Grant permissions
-- ============================================

GRANT USAGE ON SCHEMA api TO anon, authenticated, service_role;

GRANT ALL ON api.events TO anon, authenticated, service_role;
GRANT ALL ON api.posts TO anon, authenticated, service_role;
GRANT ALL ON api.post_likes TO anon, authenticated, service_role;
GRANT ALL ON api.post_comments TO anon, authenticated, service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA api TO anon, authenticated, service_role;

-- ============================================
-- STEP 6: Copy data from public schema if any exists
-- ============================================

INSERT INTO api.events
SELECT * FROM public.events
ON CONFLICT (token) DO NOTHING;

INSERT INTO api.posts
SELECT * FROM public.posts
WHERE event_id IN (SELECT id FROM api.events)
ON CONFLICT DO NOTHING;

-- ============================================
-- STEP 7: Insert sample data
-- ============================================

INSERT INTO api.events (title, description, date, time, is_public, host_id, host_name, token)
VALUES
  ('Welcome Party', 'Join us for our first PrivatePartyy event!', '2025-10-15', '18:00', TRUE, 'host-1', 'John Doe', 'sample-token-public-1'),
  ('Private Gathering', 'An intimate gathering for close friends', '2025-10-20', '19:00', FALSE, 'host-2', 'Jane Smith', 'sample-token-private-1')
ON CONFLICT (token) DO NOTHING;

-- ============================================
-- STEP 8: Reload schema cache
-- ============================================

NOTIFY pgrst, 'reload schema';

-- ============================================
-- STEP 9: Verify
-- ============================================

SELECT '✅ Tables created in api schema with RLS OFF' as status;

SELECT 'Tables in api schema:' as info;
SELECT schemaname, tablename, rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'api'
AND tablename IN ('events', 'posts', 'post_likes', 'post_comments')
ORDER BY tablename;

SELECT 'Row count:' as info;
SELECT 'events' as table_name, COUNT(*) as count FROM api.events
UNION ALL
SELECT 'posts', COUNT(*) FROM api.posts
UNION ALL
SELECT 'post_likes', COUNT(*) FROM api.post_likes
UNION ALL
SELECT 'post_comments', COUNT(*) FROM api.post_comments;
