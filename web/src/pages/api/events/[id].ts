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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id: eventIdOrToken } = req.query;
  const { method } = req;

  if (!eventIdOrToken || typeof eventIdOrToken !== 'string') {
    return res.status(400).json({ error: 'Event ID or token is required' });
  }

  if (method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token } = req.query;

    // Helper function to resolve event ID from token or UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    let event;
    let error;

    if (uuidRegex.test(eventIdOrToken)) {
      // It's a UUID, fetch by ID
      const result = await supabase
        .from('events')
        .select('*')
        .eq('id', eventIdOrToken)
        .single();

      event = result.data;
      error = result.error;
    } else {
      // It's a token, fetch by token
      const result = await supabase
        .from('events')
        .select('*')
        .eq('token', eventIdOrToken)
        .single();

      event = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Error fetching event:', error);
      return res.status(404).json({ error: 'Event not found' });
    }

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Verify token if provided separately (for UUID-based lookups)
    if (token && event.token !== token) {
      return res.status(403).json({ error: 'Invalid event token' });
    }

    // Return event data
    return res.status(200).json({
      id: event.id,
      name: event.title, // Map 'title' to 'name' for frontend compatibility
      title: event.title,
      description: event.description,
      date: event.date,
      time: event.time,
      location: event.location,
      max_attendees: event.max_attendees,
      current_attendees: event.current_attendees,
      is_public: event.is_public,
      is_active: true, // Default to true if not in database
      host_id: event.host_id,
      host_name: event.host_name,
      host_email: event.host_email,
      tags: event.tags,
      image_url: event.image_url,
      token: event.token,
      created_at: event.created_at,
      updated_at: event.updated_at
    });
  } catch (error) {
    console.error('Event API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
