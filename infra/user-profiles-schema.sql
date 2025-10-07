-- User Profiles Table
-- This table stores user profiles for cross-event persistence
-- Run this in your Supabase SQL Editor in the `api` schema

-- Create user_profiles table in the api schema
CREATE TABLE IF NOT EXISTS api.user_profiles (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  avatar VARCHAR(10) NOT NULL,
  generation VARCHAR(50),
  is_anonymous BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON api.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON api.user_profiles(created_at DESC);

-- Grant permissions
GRANT ALL ON api.user_profiles TO anon, authenticated, service_role;

-- Add a comment
COMMENT ON TABLE api.user_profiles IS 'Stores user profiles for cross-event persistence';

-- Example queries:

-- Check if table exists and has correct structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'api' AND table_name = 'user_profiles'
ORDER BY ordinal_position;

-- Query sample data
-- SELECT * FROM api.user_profiles LIMIT 10;

-- Count total profiles
-- SELECT COUNT(*) as total_profiles FROM api.user_profiles;

-- Find profile by email
-- SELECT * FROM api.user_profiles WHERE email = 'user@example.com';
