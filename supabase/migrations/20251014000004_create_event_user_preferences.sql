-- Create event_user_preferences table for storing per-event user settings
CREATE TABLE IF NOT EXISTS event_user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_email TEXT,
  allow_dms BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure one preference record per user per event
  UNIQUE(event_id, user_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_event_user_prefs_event_id ON event_user_preferences(event_id);
CREATE INDEX IF NOT EXISTS idx_event_user_prefs_user_id ON event_user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_event_user_prefs_email ON event_user_preferences(user_email);

-- Add RLS (Row Level Security) policies
ALTER TABLE event_user_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own preferences
CREATE POLICY "Users can view their own preferences"
  ON event_user_preferences
  FOR SELECT
  USING (true); -- Allow all reads (we'll validate in API layer)

-- Policy: Users can create/update their own preferences
CREATE POLICY "Users can manage their own preferences"
  ON event_user_preferences
  FOR ALL
  USING (true)
  WITH CHECK (true); -- Allow all operations (we'll validate in API layer)

-- Create function to check if user allows DMs for an event
CREATE OR REPLACE FUNCTION check_user_allows_dms(
  p_event_id UUID,
  p_user_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  allows_dms BOOLEAN;
BEGIN
  SELECT allow_dms INTO allows_dms
  FROM event_user_preferences
  WHERE event_id = p_event_id AND user_id = p_user_id;

  -- If no preference record exists, default to true (allow DMs)
  RETURN COALESCE(allows_dms, true);
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment for documentation
COMMENT ON TABLE event_user_preferences IS 'Per-event user preferences including DM opt-in/out';
COMMENT ON FUNCTION check_user_allows_dms IS 'Checks if a user allows DMs for a specific event';
