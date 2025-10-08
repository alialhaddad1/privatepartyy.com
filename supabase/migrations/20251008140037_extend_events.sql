-- Update events table to link host_id to auth.users (if not already done)
ALTER TABLE events 
  ADD COLUMN IF NOT EXISTS host_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_host_user_id ON events(host_user_id);