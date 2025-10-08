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
