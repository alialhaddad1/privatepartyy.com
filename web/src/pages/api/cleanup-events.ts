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
 * API endpoint to clean up events at the end of each night
 * Deletes ALL events that were created on or before the current day
 * This should be called by a cron job every night (runs at 2 AM UTC)
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional: Add authentication/authorization here
  // For example, check for a secret token in headers
  const authToken = req.headers.authorization;
  const expectedToken = process.env.CLEANUP_CRON_SECRET;

  if (expectedToken && authToken !== `Bearer ${expectedToken}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🧹 [Cleanup] Starting event cleanup...');

    // Get the start of the next day (tomorrow at midnight)
    // This ensures we delete ALL events from today and earlier
    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 0, 0); // Set to midnight of next day
    const tomorrowString = tomorrow.toISOString().split('T')[0];

    console.log(`🧹 [Cleanup] Deleting all events before ${tomorrowString} (including today's events)`);

    let totalDeleted = 0;
    const deletionResults = [];

    // Delete from api schema
    const { data: apiData, error: apiError } = await supabaseApi
      .from('events')
      .delete()
      .lt('date', tomorrowString)
      .select();

    if (apiError) {
      console.warn('⚠️ [Cleanup] Error deleting from api schema:', apiError.message);
      deletionResults.push({ schema: 'api', status: 'error', error: apiError.message });
    } else {
      const apiDeletedCount = apiData?.length || 0;
      totalDeleted += apiDeletedCount;
      console.log(`✅ [Cleanup] Deleted ${apiDeletedCount} events from api schema`);
      deletionResults.push({ schema: 'api', status: 'success', count: apiDeletedCount });
    }

    // Delete from public schema
    const { data: publicData, error: publicError } = await supabasePublic
      .from('events')
      .delete()
      .lt('date', tomorrowString)
      .select();

    if (publicError) {
      console.warn('⚠️ [Cleanup] Error deleting from public schema:', publicError.message);
      deletionResults.push({ schema: 'public', status: 'error', error: publicError.message });
    } else {
      const publicDeletedCount = publicData?.length || 0;
      totalDeleted += publicDeletedCount;
      console.log(`✅ [Cleanup] Deleted ${publicDeletedCount} events from public schema`);
      deletionResults.push({ schema: 'public', status: 'success', count: publicDeletedCount });
    }

    console.log(`✅ [Cleanup] Successfully deleted ${totalDeleted} total expired events across both schemas`);

    return res.status(200).json({
      success: true,
      totalDeleted,
      deletionResults,
      message: `Deleted ${totalDeleted} expired event(s) from both schemas`
    });
  } catch (error) {
    console.error('❌ [Cleanup] Unexpected error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
