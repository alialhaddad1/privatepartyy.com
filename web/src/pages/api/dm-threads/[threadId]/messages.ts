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

const MESSAGE_LIMIT = 10;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { threadId } = req.query;
  const { method } = req;

  if (!threadId || typeof threadId !== 'string') {
    return res.status(400).json({ error: 'Thread ID is required' });
  }

  try {
    switch (method) {
      case 'GET': {
        // Get all messages in a thread
        const { userId } = req.query;

        if (!userId || typeof userId !== 'string') {
          return res.status(400).json({ error: 'User ID is required' });
        }

        // Verify user is participant in this thread
        const { data: thread, error: threadError } = await supabase
          .from('event_dm_threads')
          .select('*')
          .eq('id', threadId)
          .single();

        if (threadError || !thread) {
          return res.status(404).json({ error: 'Thread not found' });
        }

        // Check if user is a participant
        if (thread.participant1_id !== userId && thread.participant2_id !== userId) {
          return res.status(403).json({ error: 'You are not a participant in this thread' });
        }

        // Fetch messages
        const { data: messages, error } = await supabase
          .from('event_dm_messages')
          .select('*')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error fetching messages:', error);
          return res.status(500).json({ error: 'Failed to fetch messages' });
        }

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

        // Verify thread exists and user is a participant
        const { data: thread, error: threadError } = await supabase
          .from('event_dm_threads')
          .select('*')
          .eq('id', threadId)
          .single();

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
