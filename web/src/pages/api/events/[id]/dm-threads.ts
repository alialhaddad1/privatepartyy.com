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
  const { id: eventIdOrToken } = req.query;
  const { method } = req;

  if (!eventIdOrToken || typeof eventIdOrToken !== 'string') {
    return res.status(400).json({ error: 'Event ID or token is required' });
  }

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
          console.error('Error fetching event:', tokenError);
          return null;
        }

        return eventByToken.id;
      }
    };

    // Resolve the event ID
    const eventId = await resolveEventId(eventIdOrToken);
    if (!eventId) {
      return res.status(404).json({ error: 'Event not found' });
    }

    switch (method) {
      case 'GET': {
        // Get all DM threads for a user in this event
        const { userId } = req.query;

        if (!userId || typeof userId !== 'string') {
          return res.status(400).json({ error: 'User ID is required' });
        }

        // Fetch threads where user is either participant1 or participant2
        const { data: threads, error } = await supabase
          .from('event_dm_threads')
          .select('*')
          .eq('event_id', eventId)
          .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
          .order('last_message_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching DM threads:', error);
          return res.status(500).json({ error: 'Failed to fetch DM threads' });
        }

        // Transform to camelCase for frontend
        const transformedThreads = (threads || []).map(thread => ({
          id: thread.id,
          eventId: thread.event_id,
          participant1Id: thread.participant1_id,
          participant1Name: thread.participant1_name,
          participant1Avatar: thread.participant1_avatar,
          participant2Id: thread.participant2_id,
          participant2Name: thread.participant2_name,
          participant2Avatar: thread.participant2_avatar,
          messageCount: thread.message_count,
          lastMessageAt: thread.last_message_at,
          createdAt: thread.created_at,
          updatedAt: thread.updated_at
        }));

        return res.status(200).json({ threads: transformedThreads });
      }

      case 'POST': {
        // Create or find existing DM thread
        const {
          currentUserId,
          currentUserName,
          currentUserAvatar,
          otherUserId,
          otherUserName,
          otherUserAvatar
        } = req.body;

        if (!currentUserId || !currentUserName || !otherUserId || !otherUserName) {
          return res.status(400).json({
            error: 'Missing required fields'
          });
        }

        // Prevent self-DM
        if (currentUserId === otherUserId) {
          return res.status(400).json({ error: 'Cannot DM yourself' });
        }

        // Check if the recipient allows DMs for this event
        const { data: recipientPrefs } = await supabase
          .from('event_user_preferences')
          .select('allow_dms')
          .eq('event_id', eventId)
          .eq('user_id', otherUserId)
          .single();

        const allowsDMs = recipientPrefs?.allow_dms ?? true; // Default to true if no preference set

        if (!allowsDMs) {
          return res.status(403).json({
            error: 'This user has disabled direct messages for this event',
            allowsDMs: false
          });
        }

        // Ensure participant order for unique constraint (participant1 < participant2)
        const [participant1Id, participant1Name, participant1Avatar] =
          currentUserId < otherUserId
            ? [currentUserId, currentUserName, currentUserAvatar || '👤']
            : [otherUserId, otherUserName, otherUserAvatar || '👤'];

        const [participant2Id, participant2Name, participant2Avatar] =
          currentUserId < otherUserId
            ? [otherUserId, otherUserName, otherUserAvatar || '👤']
            : [currentUserId, currentUserName, currentUserAvatar || '👤'];

        // Try to find existing thread first
        const { data: existingThread } = await supabase
          .from('event_dm_threads')
          .select('*')
          .eq('event_id', eventId)
          .eq('participant1_id', participant1Id)
          .eq('participant2_id', participant2Id)
          .single();

        if (existingThread) {
          // Thread already exists, return it
          return res.status(200).json({
            thread: {
              id: existingThread.id,
              eventId: existingThread.event_id,
              participant1Id: existingThread.participant1_id,
              participant1Name: existingThread.participant1_name,
              participant1Avatar: existingThread.participant1_avatar,
              participant2Id: existingThread.participant2_id,
              participant2Name: existingThread.participant2_name,
              participant2Avatar: existingThread.participant2_avatar,
              messageCount: existingThread.message_count,
              lastMessageAt: existingThread.last_message_at,
              createdAt: existingThread.created_at,
              updatedAt: existingThread.updated_at
            }
          });
        }

        // Create new thread
        const { data: newThread, error } = await supabase
          .from('event_dm_threads')
          .insert({
            event_id: eventId,
            participant1_id: participant1Id,
            participant1_name: participant1Name,
            participant1_avatar: participant1Avatar,
            participant2_id: participant2Id,
            participant2_name: participant2Name,
            participant2_avatar: participant2Avatar,
            message_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating DM thread:', error);
          return res.status(500).json({ error: 'Failed to create DM thread' });
        }

        return res.status(201).json({
          thread: {
            id: newThread.id,
            eventId: newThread.event_id,
            participant1Id: newThread.participant1_id,
            participant1Name: newThread.participant1_name,
            participant1Avatar: newThread.participant1_avatar,
            participant2Id: newThread.participant2_id,
            participant2Name: newThread.participant2_name,
            participant2Avatar: newThread.participant2_avatar,
            messageCount: newThread.message_count,
            lastMessageAt: newThread.last_message_at,
            createdAt: newThread.created_at,
            updatedAt: newThread.updated_at
          }
        });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('DM threads API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
