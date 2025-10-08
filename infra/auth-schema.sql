-- PrivatePartyy Authentication and Attendees Schema
-- Run this in your Supabase SQL Editor AFTER setting up Supabase Auth

-- Create user_profiles table to extend Supabase Auth users
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255),
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create event_attendees table to track who's going to which event
CREATE TABLE IF NOT EXISTS event_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'going' CHECK (status IN ('going', 'maybe', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_event_attendees_event_id ON event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user_id ON event_attendees(user_id);

-- Grant permissions
GRANT ALL ON user_profiles TO anon, authenticated, service_role;
GRANT ALL ON event_attendees TO anon, authenticated, service_role;

-- Create function to automatically create user profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to call the function when a new user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to get event attendees count
CREATE OR REPLACE FUNCTION get_event_attendees_count(event_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM event_attendees
    WHERE event_id = event_uuid AND status = 'going'
  );
END;
$$ LANGUAGE plpgsql;

-- Create function to check if user is attending an event
CREATE OR REPLACE FUNCTION is_user_attending(event_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM event_attendees
    WHERE event_id = event_uuid AND user_id = user_uuid AND status = 'going'
  );
END;
$$ LANGUAGE plpgsql;

-- Update events table to link host_id to auth.users (if not already done)
-- Note: For backward compatibility, we'll keep host_id as VARCHAR but add a new column
ALTER TABLE events ADD COLUMN IF NOT EXISTS host_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_events_host_user_id ON events(host_user_id);

COMMENT ON TABLE user_profiles IS 'Extended user profile information beyond Supabase Auth';
COMMENT ON TABLE event_attendees IS 'Tracks which users are attending which events';
COMMENT ON COLUMN events.host_id IS 'Legacy host identifier (string)';
COMMENT ON COLUMN events.host_user_id IS 'Reference to authenticated user who created the event';
