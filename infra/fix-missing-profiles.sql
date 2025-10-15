-- Script to create missing user profiles for existing auth users
-- Run this in your Supabase SQL Editor to fix users that don't have profiles

-- First, let's check how many users are missing profiles
SELECT
  'Users missing profiles:' as status,
  COUNT(*) as count
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_profiles up WHERE up.id = au.id
);

-- Create profiles for users that don't have them
INSERT INTO public.user_profiles (id, email, display_name, created_at, updated_at)
SELECT
  au.id,
  au.email,
  COALESCE(
    au.raw_user_meta_data->>'display_name',
    split_part(au.email, '@', 1)
  ) as display_name,
  au.created_at,
  NOW()
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_profiles up WHERE up.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- Verify all users now have profiles
SELECT
  'Verification - Users still missing profiles:' as status,
  COUNT(*) as count
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_profiles up WHERE up.id = au.id
);

-- Show created profiles
SELECT
  up.id,
  up.email,
  up.display_name,
  up.created_at
FROM public.user_profiles up
ORDER BY up.created_at DESC
LIMIT 10;
