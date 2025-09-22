-- Seed script for Supabase PostgreSQL database to support the event photo feed prototype

-- Insert sample event
INSERT INTO api.events (id, name, date, location, created_at)
VALUES (
  'test_event',
  'PrivatePartyy Prototype Launch',
  '2025-09-30T19:00:00Z',
  'San Francisco, CA',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Insert sample posts
INSERT INTO api.posts (event_id, uploader_name, image_url, created_at)
VALUES 
  (
    'test_event',
    'Alice',
    'https://placekitten.com/400/300',
    NOW()
  ),
  (
    'test_event',
    'Bob',
    'https://placekitten.com/401/301',
    NOW()
  ),
  (
    'test_event',
    'Charlie',
    'https://placekitten.com/402/302',
    NOW()
  )
ON CONFLICT DO NOTHING;