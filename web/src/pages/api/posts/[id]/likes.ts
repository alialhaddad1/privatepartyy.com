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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id: postId } = req.query;
  const { method } = req;

  if (!postId || typeof postId !== 'string') {
    return res.status(400).json({ error: 'Post ID is required' });
  }

  try {
    switch (method) {
      case 'GET': {
        // Get all likes for a post
        const { data: likes, error } = await supabase
          .from('event_post_likes')
          .select('*')
          .eq('post_id', postId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching likes:', error);
          return res.status(500).json({ error: 'Failed to fetch likes' });
        }

        return res.status(200).json({
          likes: (likes || []).map(like => ({
            id: like.id,
            userId: like.user_id,
            userName: like.user_name,
            userAvatar: like.user_avatar,
            createdAt: like.created_at
          }))
        });
      }

      case 'POST': {
        // Add a like to a post
        const { userId, userName, userAvatar } = req.body;

        if (!userId) {
          return res.status(400).json({ error: 'User ID is required' });
        }

        // Check if user already liked this post
        const { data: existingLike } = await supabase
          .from('event_post_likes')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', userId)
          .single();

        if (existingLike) {
          return res.status(409).json({ error: 'Post already liked by this user' });
        }

        const { data: like, error } = await supabase
          .from('event_post_likes')
          .insert({
            post_id: postId,
            user_id: userId,
            user_name: userName || 'Anonymous',
            user_avatar: userAvatar || '👤'
          })
          .select()
          .single();

        if (error) {
          console.error('Error adding like:', error);
          return res.status(500).json({ error: 'Failed to add like' });
        }

        return res.status(201).json({
          like: {
            id: like.id,
            userId: like.user_id,
            userName: like.user_name,
            userAvatar: like.user_avatar,
            createdAt: like.created_at
          }
        });
      }

      case 'DELETE': {
        // Remove a like from a post
        const { userId } = req.body;

        if (!userId) {
          return res.status(400).json({ error: 'User ID is required' });
        }

        const { error } = await supabase
          .from('event_post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId);

        if (error) {
          console.error('Error removing like:', error);
          return res.status(500).json({ error: 'Failed to remove like' });
        }

        return res.status(200).json({ success: true });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Likes API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
