-- PrivatePartyy Database Schema
-- Run this in your Supabase SQL Editor to set up the database

-- Create events table
CREATE TABLE IF NOT EXISTS events (
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

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_events_token ON events(token);
CREATE INDEX IF NOT EXISTS idx_events_is_public ON events(is_public);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_host_id ON events(host_id);

-- Create posts table for event feed
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
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

-- Create indexes for posts
CREATE INDEX IF NOT EXISTS idx_posts_event_id ON posts(event_id);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);

-- Create likes table
CREATE TABLE IF NOT EXISTS post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Create comments table
CREATE TABLE IF NOT EXISTS post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id VARCHAR(255) NOT NULL,
  author_name VARCHAR(255) NOT NULL,
  author_avatar TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for comments
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON post_comments(created_at DESC);

-- Enable Row Level Security (RLS) - OPTIONAL but recommended
-- ALTER TABLE events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (uncomment if you want to enable RLS)
-- For now, we'll keep tables open for testing
-- You can add more restrictive policies later

-- Grant permissions
GRANT ALL ON events TO anon, authenticated, service_role;
GRANT ALL ON posts TO anon, authenticated, service_role;
GRANT ALL ON post_likes TO anon, authenticated, service_role;
GRANT ALL ON post_comments TO anon, authenticated, service_role;

-- Insert sample data for testing
INSERT INTO events (title, description, date, time, is_public, host_id, host_name, token)
VALUES
  ('Welcome Party', 'Join us for our first PrivatePartyy event!', '2025-10-15', '18:00', TRUE, 'host-1', 'John Doe', 'sample-token-public-1'),
  ('Private Gathering', 'An intimate gathering for close friends', '2025-10-20', '19:00', FALSE, 'host-2', 'Jane Smith', 'sample-token-private-1')
ON CONFLICT (token) DO NOTHING;
