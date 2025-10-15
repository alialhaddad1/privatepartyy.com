import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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
  const { method } = req;

  try {
    // Helper function to resolve event ID from token or UUID
    const resolveEventId = async (eventIdOrToken: string): Promise<string | null> => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (uuidRegex.test(eventIdOrToken)) {
        // It's a UUID, use directly
        return eventIdOrToken;
      } else {
        // It's a token, look up the event
        const { data: eventByToken, error: tokenError } = await supabase
          .from('events')
          .select('id')
          .eq('token', eventIdOrToken)
          .single();

        if (tokenError || !eventByToken) {
          console.error('Error creating user preferences:', tokenError);
          return null;
        }

        return eventByToken.id;
      }
    };

    switch (method) {
      case 'POST': {
        // Create or update user preferences for an event
        const { eventId: eventIdOrToken, userId, userEmail, allowDMs } = req.body;

        if (!eventIdOrToken || !userId) {
          return res.status(400).json({
            error: 'Missing required fields: eventId and userId are required'
          });
        }

        // Resolve the event ID
        const eventId = await resolveEventId(eventIdOrToken);
        if (!eventId) {
          return res.status(404).json({ error: 'Event not found' });
        }

        // Check if preference already exists
        const { data: existing } = await supabase
          .from('event_user_preferences')
          .select('id')
          .eq('event_id', eventId)
          .eq('user_id', userId)
          .single();

        let result;

        if (existing) {
          // Update existing preference
          const { data, error } = await supabase
            .from('event_user_preferences')
            .update({
              allow_dms: allowDMs ?? true,
              user_email: userEmail,
              updated_at: new Date().toISOString()
            })
            .eq('event_id', eventId)
            .eq('user_id', userId)
            .select()
            .single();

          if (error) {
            console.error('Error updating user preferences:', error);
            return res.status(500).json({ error: 'Failed to update preferences' });
          }

          result = data;
        } else {
          // Create new preference
          const { data, error } = await supabase
            .from('event_user_preferences')
            .insert({
              event_id: eventId,
              user_id: userId,
              user_email: userEmail,
              allow_dms: allowDMs ?? true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single();

          if (error) {
            console.error('Error creating user preferences:', error);
            return res.status(500).json({ error: 'Failed to create preferences' });
          }

          result = data;
        }

        return res.status(200).json({
          success: true,
          preferences: {
            id: result.id,
            eventId: result.event_id,
            userId: result.user_id,
            userEmail: result.user_email,
            allowDMs: result.allow_dms,
            createdAt: result.created_at,
            updatedAt: result.updated_at
          }
        });
      }

      case 'GET': {
        // Get user preferences for an event
        const { eventId: eventIdOrToken, userId } = req.query;

        if (!eventIdOrToken || typeof eventIdOrToken !== 'string' || !userId || typeof userId !== 'string') {
          return res.status(400).json({
            error: 'Missing required query parameters: eventId and userId'
          });
        }

        // Resolve the event ID
        const eventId = await resolveEventId(eventIdOrToken);
        if (!eventId) {
          return res.status(404).json({ error: 'Event not found' });
        }

        const { data, error } = await supabase
          .from('event_user_preferences')
          .select('*')
          .eq('event_id', eventId)
          .eq('user_id', userId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // No preferences found - return default
            return res.status(200).json({
              preferences: {
                eventId,
                userId,
                allowDMs: true, // Default to allowing DMs
                createdAt: null,
                updatedAt: null
              }
            });
          }

          console.error('Error fetching user preferences:', error);
          return res.status(500).json({ error: 'Failed to fetch preferences' });
        }

        return res.status(200).json({
          preferences: {
            id: data.id,
            eventId: data.event_id,
            userId: data.user_id,
            userEmail: data.user_email,
            allowDMs: data.allow_dms,
            createdAt: data.created_at,
            updatedAt: data.updated_at
          }
        });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('User preferences API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
