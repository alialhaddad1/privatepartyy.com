-- Add generation field to user_profiles table
-- Run this in your Supabase SQL Editor

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS generation VARCHAR(50);

COMMENT ON COLUMN user_profiles.generation IS 'User generation group (gen-z, millennial, gen-x, boomer, silent)';
