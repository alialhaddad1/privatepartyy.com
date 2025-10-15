import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  db: { schema: 'public' }, // Attendees are in public schema
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id: eventId } = req.query;

  if (!eventId || typeof eventId !== 'string') {
    return res.status(400).json({ error: 'Event ID is required' });
  }

  // For GET requests, we don't require authentication
  if (req.method === 'GET') {
    try {
      // Get attendees list with profiles
      const { data, error } = await supabase
        .from('event_attendees')
        .select(`
          id,
          user_id,
          created_at,
          user_profiles (
            display_name,
            avatar_url
          )
        `)
        .eq('event_id', eventId)
        .eq('status', 'going');

      if (error) {
        console.error('Error fetching attendees:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ attendees: data || [] });
    } catch (error) {
      console.error('Unexpected error fetching attendees:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // For POST and DELETE, require authentication
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized - no token provided' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return res.status(401).json({ error: 'Unauthorized - invalid token' });
    }

    if (req.method === 'POST') {
      // Add user as attendee
      const { error } = await supabase
        .from('event_attendees')
        .upsert({
          event_id: eventId,
          user_id: user.id,
          status: 'going',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'event_id,user_id'
        });

      if (error) {
        console.error('Error adding attendee:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ success: true, message: 'Successfully marked as going' });
    }

    if (req.method === 'DELETE') {
      // Remove user from attendees
      const { error } = await supabase
        .from('event_attendees')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error removing attendee:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ success: true, message: 'Successfully removed from event' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
