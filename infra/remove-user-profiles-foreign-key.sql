-- Allow standalone user profiles (not requiring auth.users)
-- This enables anonymous/unauthenticated users to create profiles
--
-- Run this SQL in the Supabase SQL Editor or via a migration

-- Drop the existing foreign key constraint
ALTER TABLE user_profiles
DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;

-- Add a comment to document this change
COMMENT ON TABLE user_profiles IS 'User profiles that can exist independently of auth.users for anonymous event participants';
