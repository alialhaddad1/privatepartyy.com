import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * API endpoint to clean up events that have ended (past their date + end of day)
 * This should be called by a cron job daily or can be manually triggered
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

    // Get today's date at the start of the current day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayString = today.toISOString().split('T')[0];

    console.log(`🧹 [Cleanup] Deleting events before ${todayString}`);

    // Delete events where the date is before today
    const { data, error, count } = await supabase
      .from('events')
      .delete()
      .lt('date', todayString)
      .select();

    if (error) {
      console.error('❌ [Cleanup] Error deleting events:', error);
      return res.status(500).json({
        error: 'Failed to clean up events',
        details: error.message
      });
    }

    const deletedCount = data?.length || 0;
    console.log(`✅ [Cleanup] Successfully deleted ${deletedCount} expired events`);

    return res.status(200).json({
      success: true,
      deletedCount,
      message: `Deleted ${deletedCount} expired event(s)`
    });
  } catch (error) {
    console.error('❌ [Cleanup] Unexpected error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
