import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Create clients for both schemas
const supabasePublic = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const supabaseApi = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'api'
  }
});

/**
 * API endpoint to cleanup event DMs at the end of each night
 * Deletes DM threads for ALL events from today and earlier
 * This should be called by a cron job every night (runs at 3 AM UTC)
 *
 * Security: Only allow requests with a valid API key or CLEANUP_CRON_SECRET
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify API key for security (support both auth methods)
  const apiKey = req.headers['x-api-key'];
  const authToken = req.headers.authorization;
  const validApiKey = process.env.CLEANUP_API_KEY;
  const expectedToken = process.env.CLEANUP_CRON_SECRET;

  const isAuthorized =
    (validApiKey && apiKey === validApiKey) ||
    (expectedToken && authToken === `Bearer ${expectedToken}`);

  if (!isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🧹 [DM Cleanup] Starting event DM cleanup...');

    // Get the start of the next day (tomorrow at midnight)
    // This ensures we delete ALL DMs from events created today and earlier
    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 0, 0); // Set to midnight of next day
    const tomorrowString = tomorrow.toISOString().split('T')[0];

    console.log(`🧹 [DM Cleanup] Deleting DM threads for events before ${tomorrowString} (including today's events)`);

    let totalDeleted = 0;
    const deletionResults = [];

    // First get event IDs from both schemas that need cleanup
    const { data: apiEvents } = await supabaseApi
      .from('events')
      .select('id')
      .lt('date', tomorrowString);

    const { data: publicEvents } = await supabasePublic
      .from('events')
      .select('id')
      .lt('date', tomorrowString);

    const eventIdsToCleanup = [
      ...(apiEvents || []).map(e => e.id),
      ...(publicEvents || []).map(e => e.id)
    ];

    if (eventIdsToCleanup.length === 0) {
      console.log('🧹 [DM Cleanup] No events found to cleanup');
      return res.status(200).json({
        success: true,
        totalDeleted: 0,
        message: 'No DM threads to delete'
      });
    }

    console.log(`🧹 [DM Cleanup] Found ${eventIdsToCleanup.length} events to cleanup`);

    // Delete DM threads from api schema
    const { data: apiDmData, error: apiDmError } = await supabaseApi
      .from('event_dm_threads')
      .delete()
      .in('event_id', eventIdsToCleanup)
      .select('id');

    if (apiDmError) {
      console.warn('⚠️ [DM Cleanup] Error deleting from api schema:', apiDmError.message);
      deletionResults.push({ schema: 'api', status: 'error', error: apiDmError.message });
    } else {
      const apiDeletedCount = apiDmData?.length || 0;
      totalDeleted += apiDeletedCount;
      console.log(`✅ [DM Cleanup] Deleted ${apiDeletedCount} DM threads from api schema`);
      deletionResults.push({ schema: 'api', status: 'success', count: apiDeletedCount });
    }

    // Delete DM threads from public schema
    const { data: publicDmData, error: publicDmError } = await supabasePublic
      .from('event_dm_threads')
      .delete()
      .in('event_id', eventIdsToCleanup)
      .select('id');

    if (publicDmError) {
      console.warn('⚠️ [DM Cleanup] Error deleting from public schema:', publicDmError.message);
      deletionResults.push({ schema: 'public', status: 'error', error: publicDmError.message });
    } else {
      const publicDeletedCount = publicDmData?.length || 0;
      totalDeleted += publicDeletedCount;
      console.log(`✅ [DM Cleanup] Deleted ${publicDeletedCount} DM threads from public schema`);
      deletionResults.push({ schema: 'public', status: 'success', count: publicDeletedCount });
    }

    console.log(`✅ [DM Cleanup] Successfully deleted ${totalDeleted} total DM threads across both schemas`);

    return res.status(200).json({
      success: true,
      totalDeleted,
      deletionResults,
      message: `Deleted ${totalDeleted} DM thread(s) from both schemas`
    });
  } catch (error) {
    console.error('❌ [DM Cleanup] Unexpected error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
