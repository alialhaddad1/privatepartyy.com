-- Script to verify the user profile creation trigger is working
-- Run this in your Supabase SQL Editor

-- Check if the function exists
SELECT
  'Function Status' as check_type,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_proc
      WHERE proname = 'handle_new_user'
    )
    THEN '✅ handle_new_user() function exists'
    ELSE '❌ handle_new_user() function MISSING - Run migrations!'
  END as status;

-- Check if the trigger exists
SELECT
  'Trigger Status' as check_type,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'on_auth_user_created'
    )
    THEN '✅ on_auth_user_created trigger exists'
    ELSE '❌ on_auth_user_created trigger MISSING - Run migrations!'
  END as status;

-- Show trigger details
SELECT
  t.tgname as trigger_name,
  c.relname as table_name,
  p.proname as function_name,
  CASE t.tgtype::integer & 1
    WHEN 1 THEN 'ROW'
    ELSE 'STATEMENT'
  END as level,
  CASE t.tgtype::integer & 66
    WHEN 2 THEN 'BEFORE'
    WHEN 64 THEN 'INSTEAD OF'
    ELSE 'AFTER'
  END as timing,
  CASE
    WHEN t.tgtype::integer & 4 = 4 THEN 'INSERT'
    WHEN t.tgtype::integer & 8 = 8 THEN 'DELETE'
    WHEN t.tgtype::integer & 16 = 16 THEN 'UPDATE'
  END as event
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgname = 'on_auth_user_created';

-- Show the function definition
SELECT
  'Function Definition' as info,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'handle_new_user';
