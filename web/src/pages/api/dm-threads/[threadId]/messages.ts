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

const MESSAGE_LIMIT = 10;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { threadId } = req.query;
  const { method } = req;

  if (!threadId || typeof threadId !== 'string') {
    console.error('❌ [DM Messages API] Invalid thread ID:', threadId);
    return res.status(400).json({ error: 'Thread ID is required', received: threadId });
  }

  console.log(`💬 [DM Messages API] ${method} request for thread ${threadId}`);

  try {
    switch (method) {
      case 'GET': {
        // Get all messages in a thread
        const { userId } = req.query;

        if (!userId || typeof userId !== 'string') {
          console.error('❌ [DM Messages API] Missing userId in query:', req.query);
          return res.status(400).json({ error: 'User ID is required', received: userId });
        }

        console.log(`📥 [DM Messages API] Fetching messages for user ${userId}`);

        // Verify user is participant in this thread - try both schemas
        const threadResult = await tryBothSchemas<any>((client) =>
          client
            .from('event_dm_threads')
            .select('*')
            .eq('id', threadId)
            .single()
        );

        const { data: thread, error: threadError } = threadResult;

        if (threadError || !thread) {
          console.error('❌ [DM Messages API] Thread not found:', threadError);
          return res.status(404).json({ error: 'Thread not found' });
        }

        console.log(`✅ [DM Messages API] Found thread in ${threadResult.schema} schema`);

        // Check if user is a participant
        if (thread.participant1_id !== userId && thread.participant2_id !== userId) {
          console.error(`❌ [DM Messages API] User ${userId} is not a participant. Thread has ${thread.participant1_id} and ${thread.participant2_id}`);
          return res.status(403).json({ error: 'You are not a participant in this thread' });
        }

        // Determine which client to use based on where thread was found
        const supabase = threadResult.schema === 'api' ? supabaseApi : supabasePublic;

        // Fetch messages
        const { data: messages, error } = await supabase
          .from('event_dm_messages')
          .select('*')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('❌ [DM Messages API] Error fetching messages:', error);
          return res.status(500).json({ error: 'Failed to fetch messages' });
        }

        console.log(`✅ [DM Messages API] Found ${messages?.length || 0} messages`);

        // Transform to camelCase
        const transformedMessages = (messages || []).map(msg => ({
          id: msg.id,
          threadId: msg.thread_id,
          senderId: msg.sender_id,
          senderName: msg.sender_name,
          senderAvatar: msg.sender_avatar,
          content: msg.content,
          createdAt: msg.created_at
        }));

        return res.status(200).json({
          messages: transformedMessages,
          messageCount: thread.message_count,
          limit: MESSAGE_LIMIT,
          remaining: Math.max(0, MESSAGE_LIMIT - thread.message_count)
        });
      }

      case 'POST': {
        // Send a new message
        const {
          senderId,
          senderName,
          senderAvatar,
          content
        } = req.body;

        if (!senderId || !senderName || !content) {
          return res.status(400).json({
            error: 'Missing required fields'
          });
        }

        // Validate content
        const trimmedContent = content.trim();
        if (trimmedContent.length === 0) {
          return res.status(400).json({ error: 'Message cannot be empty' });
        }

        if (trimmedContent.length > 1000) {
          return res.status(400).json({ error: 'Message is too long (max 1000 characters)' });
        }

        // Verify thread exists and user is a participant - try both schemas
        const threadResult = await tryBothSchemas<any>((client) =>
          client
            .from('event_dm_threads')
            .select('*')
            .eq('id', threadId)
            .single()
        );

        const { data: thread, error: threadError } = threadResult;

        if (threadError || !thread) {
          return res.status(404).json({ error: 'Thread not found' });
        }

        // Check if user is a participant
        if (thread.participant1_id !== senderId && thread.participant2_id !== senderId) {
          return res.status(403).json({ error: 'You are not a participant in this thread' });
        }

        // Check message limit
        if (thread.message_count >= MESSAGE_LIMIT) {
          return res.status(429).json({
            error: 'Message limit reached',
            message: `You've reached the ${MESSAGE_LIMIT} message limit for this conversation. Exchange contact info to continue chatting!`,
            limit: MESSAGE_LIMIT,
            count: thread.message_count
          });
        }

        // Determine which client to use based on where thread was found
        const supabase = threadResult.schema === 'api' ? supabaseApi : supabasePublic;

        // Create message
        const { data: newMessage, error } = await supabase
          .from('event_dm_messages')
          .insert({
            thread_id: threadId,
            sender_id: senderId,
            sender_name: senderName,
            sender_avatar: senderAvatar || '👤',
            content: trimmedContent,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating message:', error);
          return res.status(500).json({ error: 'Failed to send message' });
        }

        // The trigger will automatically update the thread's message_count and last_message_at
        // Fetch updated thread to get new count
        const { data: updatedThread } = await supabase
          .from('event_dm_threads')
          .select('message_count')
          .eq('id', threadId)
          .single();

        const newCount = updatedThread?.message_count || thread.message_count + 1;

        return res.status(201).json({
          message: {
            id: newMessage.id,
            threadId: newMessage.thread_id,
            senderId: newMessage.sender_id,
            senderName: newMessage.sender_name,
            senderAvatar: newMessage.sender_avatar,
            content: newMessage.content,
            createdAt: newMessage.created_at
          },
          messageCount: newCount,
          limit: MESSAGE_LIMIT,
          remaining: Math.max(0, MESSAGE_LIMIT - newCount)
        });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('DM messages API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
