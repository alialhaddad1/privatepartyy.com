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

// Helper function to try both schemas
async function tryBothSchemas<T>(
  operation: (client: any) => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any; schema?: string }> {
  // Try api schema first
  let result = await operation(supabaseApi);
  if (result.data && !result.error) {
    return { ...result, schema: 'api' };
  }

  // Try public schema
  result = await operation(supabasePublic);
  return { ...result, schema: 'public' };
}

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
    const resolveEventId = async (eventIdOrToken: string): Promise<{ id: string; schema: string } | null> => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (uuidRegex.test(eventIdOrToken)) {
        // It's a UUID, check which schema has it
        const eventResult = await tryBothSchemas<{ id: string }>((client) =>
          client.from('events').select('id').eq('id', eventIdOrToken).single()
        );

        if (eventResult.error || !eventResult.data) {
          return null;
        }

        return { id: eventIdOrToken, schema: eventResult.schema || 'public' };
      } else {
        // It's a token, look up the event in both schemas
        const eventResult = await tryBothSchemas<{ id: string }>((client) =>
          client.from('events').select('id').eq('token', eventIdOrToken).single()
        );

        if (eventResult.error || !eventResult.data) {
          console.error('Error fetching event:', eventResult.error);
          return null;
        }

        return { id: eventResult.data.id, schema: eventResult.schema || 'public' };
      }
    };

    // Resolve the event ID
    const eventResult = await resolveEventId(eventIdOrToken);
    if (!eventResult) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const eventId = eventResult.id;
    const supabase = eventResult.schema === 'api' ? supabaseApi : supabasePublic;

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

        console.log(`💬 [DM Threads] Creating/finding DM thread for event ${eventId}`);
        console.log(`   Current user: ${currentUserId} (${currentUserName})`);
        console.log(`   Other user: ${otherUserId} (${otherUserName})`);

        if (!currentUserId || !currentUserName || !otherUserId || !otherUserName) {
          console.error('❌ [DM Threads] Missing required fields:', { currentUserId, currentUserName, otherUserId, otherUserName });
          return res.status(400).json({
            error: 'Missing required fields'
          });
        }

        // Prevent self-DM
        if (currentUserId === otherUserId) {
          console.error('❌ [DM Threads] User attempting to DM themselves');
          return res.status(400).json({ error: 'Cannot DM yourself' });
        }

        // TODO: RE-ENABLE DM PREFERENCE CHECKING
        // Check if the recipient (otherUserId) allows DMs for this event using the
        // event_user_preferences table and check_user_allows_dms() function.
        // The preference is set when users join an event via the checkbox at join/[id].tsx:431-447
        // Example code to re-enable:
        //
        // const { data: recipientAllowsDMs } = await supabase
        //   .rpc('check_user_allows_dms', {
        //     p_event_id: eventId,
        //     p_user_id: otherUserId
        //   });
        //
        // if (!recipientAllowsDMs) {
        //   return res.status(403).json({
        //     error: 'This user has disabled direct messages for this event'
        //   });
        // }
        //
        // TEMPORARILY DISABLED - allowing all DMs for now
        console.log(`⚠️ [DM Threads] DM preference check DISABLED - allowing all DMs (TODO: re-enable)`);

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
          console.log(`✅ [DM Threads] Found existing thread ${existingThread.id}`);
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
        console.log(`🆕 [DM Threads] Creating new thread between ${participant1Id} and ${participant2Id}`);
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
          console.error('❌ [DM Threads] Error creating DM thread:', error);
          return res.status(500).json({ error: 'Failed to create DM thread', details: error.message });
        }

        console.log(`✅ [DM Threads] Created new thread ${newThread.id}`);

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
