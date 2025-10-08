COMMENT ON TABLE user_profiles IS 'Extended user profile information beyond Supabase Auth';
COMMENT ON TABLE event_attendees IS 'Tracks which users are attending which events';
COMMENT ON COLUMN events.host_id IS 'Legacy host identifier (string)';
COMMENT ON COLUMN events.host_user_id IS 'Reference to authenticated user who created the event';