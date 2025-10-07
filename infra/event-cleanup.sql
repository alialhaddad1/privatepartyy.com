-- Event Auto-Cleanup Script
-- This script provides two options for automatic event cleanup:
-- 1. A function that can be called manually or via API
-- 2. A pg_cron job that runs daily (requires pg_cron extension)

-- ============================================
-- Option 1: Function for cleaning up events
-- ============================================

-- Create a function to delete events that are older than today
CREATE OR REPLACE FUNCTION cleanup_expired_events()
RETURNS TABLE(deleted_count bigint) AS $$
DECLARE
  del_count bigint;
BEGIN
  -- Delete events where the date is before today (start of current day)
  DELETE FROM events
  WHERE date < CURRENT_DATE;

  -- Get the count of deleted rows
  GET DIAGNOSTICS del_count = ROW_COUNT;

  -- Log the cleanup action (optional)
  RAISE NOTICE 'Cleaned up % expired event(s)', del_count;

  RETURN QUERY SELECT del_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION cleanup_expired_events() TO authenticated, service_role, anon;

-- ============================================
-- Option 2: Automated daily cleanup with pg_cron
-- ============================================

-- First, enable the pg_cron extension (run this in Supabase SQL Editor as superuser)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the cleanup function to run daily at 2 AM UTC
-- Uncomment the following line after enabling pg_cron:
-- SELECT cron.schedule(
--   'cleanup-expired-events',           -- Job name
--   '0 2 * * *',                        -- Cron schedule (2 AM UTC daily)
--   $$SELECT cleanup_expired_events()$$ -- Command to run
-- );

-- ============================================
-- Option 3: Vercel Cron Job (Recommended)
-- ============================================

-- Instead of database cron, you can use Vercel Cron Jobs:
-- 1. Create a file: /api/cron/cleanup-events.ts
-- 2. Add to vercel.json:
--    {
--      "crons": [{
--        "path": "/api/cron/cleanup-events",
--        "schedule": "0 2 * * *"
--      }]
--    }
-- 3. The API endpoint will call this function

-- ============================================
-- Manual Testing
-- ============================================

-- To manually test the cleanup function:
-- SELECT * FROM cleanup_expired_events();

-- To check which events would be deleted:
-- SELECT id, title, date FROM events WHERE date < CURRENT_DATE;

-- To manually delete expired events:
-- DELETE FROM events WHERE date < CURRENT_DATE;
