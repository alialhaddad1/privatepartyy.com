-- Create event_dm_threads table for managing DM conversations within events
CREATE TABLE IF NOT EXISTS event_dm_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  participant1_id TEXT NOT NULL,
  participant1_name TEXT NOT NULL,
  participant1_avatar TEXT,
  participant2_id TEXT NOT NULL,
  participant2_name TEXT NOT NULL,
  participant2_avatar TEXT,
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure unique thread per event per participant pair
  UNIQUE(event_id, participant1_id, participant2_id),

  -- Ensure participant1_id is always "less than" participant2_id for consistency
  CONSTRAINT ordered_participants CHECK (participant1_id < participant2_id)
);

-- Create event_dm_messages table for storing individual messages
CREATE TABLE IF NOT EXISTS event_dm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES event_dm_threads(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_avatar TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT content_not_empty CHECK (LENGTH(TRIM(content)) > 0),
  CONSTRAINT content_max_length CHECK (LENGTH(content) <= 1000)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_event_dm_threads_event_id ON event_dm_threads(event_id);
CREATE INDEX IF NOT EXISTS idx_event_dm_threads_participant1 ON event_dm_threads(participant1_id);
CREATE INDEX IF NOT EXISTS idx_event_dm_threads_participant2 ON event_dm_threads(participant2_id);
CREATE INDEX IF NOT EXISTS idx_event_dm_messages_thread_id ON event_dm_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_event_dm_messages_created_at ON event_dm_messages(created_at);

-- Create function to update message_count and last_message_at
CREATE OR REPLACE FUNCTION update_dm_thread_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE event_dm_threads
  SET
    message_count = message_count + 1,
    last_message_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.thread_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update thread metadata
CREATE TRIGGER trigger_update_dm_thread
  AFTER INSERT ON event_dm_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_dm_thread_on_message();

-- Create function to cleanup old DM threads (for events that have ended)
CREATE OR REPLACE FUNCTION cleanup_event_dms()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete DM threads for events that ended more than 24 hours ago
  -- This assumes events have a 'date' field
  WITH deleted AS (
    DELETE FROM event_dm_threads
    WHERE event_id IN (
      SELECT id FROM events
      WHERE date < CURRENT_DATE - INTERVAL '1 day'
    )
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add RLS (Row Level Security) policies
ALTER TABLE event_dm_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_dm_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view threads they are part of
CREATE POLICY "Users can view their own DM threads"
  ON event_dm_threads
  FOR SELECT
  USING (true); -- Allow all reads for now (we'll validate in API layer)

-- Policy: Users can create DM threads
CREATE POLICY "Users can create DM threads"
  ON event_dm_threads
  FOR INSERT
  WITH CHECK (true); -- Allow all creates (we'll validate in API layer)

-- Policy: Users can view messages in their threads
CREATE POLICY "Users can view DM messages"
  ON event_dm_messages
  FOR SELECT
  USING (true); -- Allow all reads (we'll validate in API layer)

-- Policy: Users can send messages
CREATE POLICY "Users can send DM messages"
  ON event_dm_messages
  FOR INSERT
  WITH CHECK (true); -- Allow all creates (we'll validate in API layer)

-- Add comment for documentation
COMMENT ON TABLE event_dm_threads IS 'Event-specific DM threads with 10 message limit, auto-deleted after event ends';
COMMENT ON TABLE event_dm_messages IS 'Individual messages within event DM threads';
