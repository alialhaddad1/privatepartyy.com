-- Allow standalone user profiles (not requiring auth.users)
-- This enables anonymous/unauthenticated users to create profiles

-- Drop the existing foreign key constraint
ALTER TABLE user_profiles
DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;

-- The id column is still UUID and PRIMARY KEY, but no longer requires auth.users
-- This allows us to create profiles for both:
-- 1. Authenticated users (with Supabase Auth)
-- 2. Unauthenticated users (with client-generated UUIDs)

-- Add a comment to document this change
COMMENT ON TABLE user_profiles IS 'User profiles that can exist independently of auth.users for anonymous event participants';
