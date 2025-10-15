import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || 'public'
  }
});

/**
 * API endpoint to cleanup event DMs for events that have ended
 * This should be called by a cron job at the end of each night
 *
 * Security: Only allow requests with a valid API key
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify API key for security
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.CLEANUP_API_KEY;

  if (!validApiKey || apiKey !== validApiKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Delete DM threads for events that ended before today
    // This will cascade delete all messages in those threads
    const { data: deletedThreads, error } = await supabase
      .from('event_dm_threads')
      .delete()
      .lte('event_id', supabase
        .from('events')
        .select('id')
        .lt('date', today.toISOString().split('T')[0])
      )
      .select('id');

    if (error) {
      console.error('Error deleting DM threads:', error);

      // Try alternative approach using raw SQL function
      const { data: result, error: funcError } = await supabase
        .rpc('cleanup_event_dms');

      if (funcError) {
        console.error('Error calling cleanup function:', funcError);
        return res.status(500).json({
          error: 'Failed to cleanup DM threads',
          details: funcError.message
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Event DMs cleaned up successfully',
        deletedCount: result || 0,
        method: 'function'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Event DMs cleaned up successfully',
      deletedCount: deletedThreads?.length || 0,
      method: 'direct'
    });
  } catch (error) {
    console.error('Cleanup API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
