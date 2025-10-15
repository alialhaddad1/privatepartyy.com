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
        // Get all comments for a post
        const { data: comments, error } = await supabase
          .from('event_post_comments')
          .select('*')
          .eq('post_id', postId)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error fetching comments:', error);
          return res.status(500).json({ error: 'Failed to fetch comments' });
        }

        return res.status(200).json({
          comments: (comments || []).map(comment => ({
            id: comment.id,
            postId: comment.post_id,
            authorId: comment.author_id,
            authorName: comment.author_name,
            authorAvatar: comment.author_avatar,
            content: comment.content,
            createdAt: comment.created_at,
            updatedAt: comment.updated_at
          }))
        });
      }

      case 'POST': {
        // Add a comment to a post
        const { authorId, authorName, authorAvatar, content } = req.body;

        if (!authorId || !content) {
          return res.status(400).json({ error: 'Author ID and content are required' });
        }

        if (content.trim().length === 0) {
          return res.status(400).json({ error: 'Comment content cannot be empty' });
        }

        const { data: comment, error } = await supabase
          .from('event_post_comments')
          .insert({
            post_id: postId,
            author_id: authorId,
            author_name: authorName || 'Anonymous',
            author_avatar: authorAvatar || '👤',
            content: content.trim()
          })
          .select()
          .single();

        if (error) {
          console.error('Error adding comment:', error);
          return res.status(500).json({ error: 'Failed to add comment' });
        }

        return res.status(201).json({
          comment: {
            id: comment.id,
            postId: comment.post_id,
            authorId: comment.author_id,
            authorName: comment.author_name,
            authorAvatar: comment.author_avatar,
            content: comment.content,
            createdAt: comment.created_at,
            updatedAt: comment.updated_at
          }
        });
      }

      case 'PUT': {
        // Update a comment
        const { commentId, content, authorId } = req.body;

        if (!commentId || !content || !authorId) {
          return res.status(400).json({ error: 'Comment ID, content, and author ID are required' });
        }

        if (content.trim().length === 0) {
          return res.status(400).json({ error: 'Comment content cannot be empty' });
        }

        const { data: comment, error } = await supabase
          .from('event_post_comments')
          .update({
            content: content.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', commentId)
          .eq('author_id', authorId) // Ensure user can only update their own comments
          .select()
          .single();

        if (error) {
          console.error('Error updating comment:', error);
          return res.status(500).json({ error: 'Failed to update comment' });
        }

        if (!comment) {
          return res.status(404).json({ error: 'Comment not found or unauthorized' });
        }

        return res.status(200).json({
          comment: {
            id: comment.id,
            postId: comment.post_id,
            authorId: comment.author_id,
            authorName: comment.author_name,
            authorAvatar: comment.author_avatar,
            content: comment.content,
            createdAt: comment.created_at,
            updatedAt: comment.updated_at
          }
        });
      }

      case 'DELETE': {
        // Delete a comment
        const { commentId, authorId } = req.body;

        if (!commentId || !authorId) {
          return res.status(400).json({ error: 'Comment ID and author ID are required' });
        }

        const { error } = await supabase
          .from('event_post_comments')
          .delete()
          .eq('id', commentId)
          .eq('author_id', authorId); // Ensure user can only delete their own comments

        if (error) {
          console.error('Error deleting comment:', error);
          return res.status(500).json({ error: 'Failed to delete comment' });
        }

        return res.status(200).json({ success: true });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Comments API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
