-- Script to check which schema your tables are in
-- Run this in your Supabase SQL Editor to find your tables

-- Check for user_profiles in all schemas
SELECT
  schemaname as schema,
  tablename as table_name,
  'user_profiles exists here' as status
FROM pg_tables
WHERE tablename = 'user_profiles'
ORDER BY schemaname;

-- Check for events table
SELECT
  schemaname as schema,
  tablename as table_name,
  'events exists here' as status
FROM pg_tables
WHERE tablename = 'events'
ORDER BY schemaname;

-- Check for event_attendees table
SELECT
  schemaname as schema,
  tablename as table_name,
  'event_attendees exists here' as status
FROM pg_tables
WHERE tablename = 'event_attendees'
ORDER BY schemaname;

-- Show all application tables and their schemas
SELECT
  schemaname as schema,
  tablename as table_name,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname IN ('public', 'api')
  AND tablename NOT LIKE 'pg_%'
  AND tablename NOT LIKE 'sql_%'
ORDER BY schemaname, tablename;

-- Count rows in user_profiles (try both schemas)
SELECT 'public.user_profiles' as table_name, COUNT(*) as row_count
FROM public.user_profiles
UNION ALL
SELECT 'api.user_profiles' as table_name, COUNT(*) as row_count
FROM api.user_profiles;
