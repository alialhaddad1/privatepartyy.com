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

interface CreatePostBody {
  eventId: string;
  eventToken: string;
  userId: string;
  userName?: string;
  imageUrl: string;
  caption?: string;
  tags?: string[];
  metadata?: {
    width?: number;
    height?: number;
    size?: number;
    mimeType?: string;
  };
}

interface CreateCommentBody {
  postId: string;
  userId: string;
  userName?: string;
  content: string;
  parentCommentId?: string;
}

function validatePostData(data: any): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];
  
  if (!data.eventId || typeof data.eventId !== 'string') {
    errors.push('Event ID is required');
  }
  
  if (!data.eventToken || typeof data.eventToken !== 'string') {
    errors.push('Event token is required');
  }
  
  if (!data.userId || typeof data.userId !== 'string') {
    errors.push('User ID is required');
  }
  
  if (!data.imageUrl || typeof data.imageUrl !== 'string') {
    errors.push('Image URL is required');
  }
  
  if (data.imageUrl && !isValidUrl(data.imageUrl)) {
    errors.push('Invalid image URL format');
  }
  
  if (data.caption && typeof data.caption !== 'string') {
    errors.push('Caption must be a string');
  }
  
  if (data.caption && data.caption.length > 2000) {
    errors.push('Caption must be less than 2000 characters');
  }
  
  if (data.tags && !Array.isArray(data.tags)) {
    errors.push('Tags must be an array');
  }
  
  if (data.tags && data.tags.length > 30) {
    errors.push('Maximum 30 tags allowed');
  }
  
  if (data.tags) {
    for (const tag of data.tags) {
      if (typeof tag !== 'string' || tag.length > 50) {
        errors.push('Each tag must be a string with max 50 characters');
        break;
      }
    }
  }
  
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

function validateCommentData(data: any): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];
  
  if (!data.userId || typeof data.userId !== 'string') {
    errors.push('User ID is required');
  }
  
  if (!data.content || typeof data.content !== 'string' || data.content.trim().length === 0) {
    errors.push('Comment content is required');
  }
  
  if (data.content && data.content.length > 1000) {
    errors.push('Comment must be less than 1000 characters');
  }
  
  if (data.parentCommentId && typeof data.parentCommentId !== 'string') {
    errors.push('Parent comment ID must be a string');
  }
  
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

async function validateEventToken(eventId: string, token: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('events')
    .select('id, token')
    .eq('id', eventId)
    .eq('token', token)
    .single();
  
  return !error && data !== null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method, query, body } = req;
  const { action, postId } = query;
  
  try {
    if (method === 'POST' && !action) {
      // Create post
      const postData = body as CreatePostBody;
      
      const validation = validatePostData(postData);
      if (!validation.valid) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: validation.errors 
        });
      }
      
      // Validate event token
      const isValidToken = await validateEventToken(postData.eventId, postData.eventToken);
      if (!isValidToken) {
        return res.status(403).json({ error: 'Invalid event token' });
      }
      
      const postToInsert = {
        event_id: postData.eventId,
        user_id: postData.userId,
        user_name: postData.userName?.trim(),
        image_url: postData.imageUrl.trim(),
        caption: postData.caption?.trim(),
        tags: postData.tags?.map(tag => tag.trim()),
        metadata: postData.metadata,
        likes_count: 0,
        comments_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { data, error } = await supabase
        .from('posts')
        .insert([postToInsert])
        .select()
        .single();
      
      if (error) {
        console.error('Supabase error:', error);
        return res.status(500).json({ error: 'Failed to create post' });
      }
      
      return res.status(201).json({
        id: data.id,
        eventId: data.event_id,
        userId: data.user_id,
        userName: data.user_name,
        imageUrl: data.image_url,
        caption: data.caption,
        tags: data.tags,
        metadata: data.metadata,
        likesCount: data.likes_count,
        commentsCount: data.comments_count,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      });
    }
    
    if (method === 'POST' && action === 'like' && postId) {
      // Like post
      const { userId } = body;
      
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      if (typeof postId !== 'string') {
        return res.status(400).json({ error: 'Post ID must be a string' });
      }
      
      // Check if post exists
      const { data: post, error: postError } = await supabase
        .from('posts')
        .select('id, likes_count')
        .eq('id', postId)
        .single();
      
      if (postError || !post) {
        return res.status(404).json({ error: 'Post not found' });
      }
      
      // Check if user already liked this post
      const { data: existingLike } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .single();
      
      if (existingLike) {
        return res.status(400).json({ error: 'Post already liked by this user' });
      }
      
      // Create like record
      const { error: likeError } = await supabase
        .from('post_likes')
        .insert([{
          post_id: postId,
          user_id: userId,
          created_at: new Date().toISOString()
        }]);
      
      if (likeError) {
        console.error('Like error:', likeError);
        return res.status(500).json({ error: 'Failed to like post' });
      }
      
      // Increment likes count
      const { data: updatedPost, error: updateError } = await supabase
        .from('posts')
        .update({ 
          likes_count: post.likes_count + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', postId)
        .select()
        .single();
      
      if (updateError) {
        console.error('Update error:', updateError);
        return res.status(500).json({ error: 'Failed to update like count' });
      }
      
      return res.status(200).json({
        success: true,
        likesCount: updatedPost.likes_count
      });
    }
    
    if (method === 'POST' && action === 'unlike' && postId) {
      // Unlike post
      const { userId } = body;
      
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      if (typeof postId !== 'string') {
        return res.status(400).json({ error: 'Post ID must be a string' });
      }
      
      // Check if like exists
      const { data: existingLike, error: likeCheckError } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .single();
      
      if (likeCheckError || !existingLike) {
        return res.status(400).json({ error: 'Post not liked by this user' });
      }
      
      // Delete like record
      const { error: deleteError } = await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId);
      
      if (deleteError) {
        console.error('Delete error:', deleteError);
        return res.status(500).json({ error: 'Failed to unlike post' });
      }
      
      // Decrement likes count
      const { data: post } = await supabase
        .from('posts')
        .select('likes_count')
        .eq('id', postId)
        .single();
      
      if (post && post.likes_count > 0) {
        const { data: updatedPost, error: updateError } = await supabase
          .from('posts')
          .update({ 
            likes_count: post.likes_count - 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', postId)
          .select()
          .single();
        
        if (updateError) {
          console.error('Update error:', updateError);
          return res.status(500).json({ error: 'Failed to update like count' });
        }
        
        return res.status(200).json({
          success: true,
          likesCount: updatedPost.likes_count
        });
      }
      
      return res.status(200).json({ success: true, likesCount: 0 });
    }
    
    if (method === 'GET' && action === 'comments' && postId) {
      // Get comments for post
      if (typeof postId !== 'string') {
        return res.status(400).json({ error: 'Post ID must be a string' });
      }
      
      const { 
        limit = 50, 
        offset = 0,
        parentId = null,
        orderBy = 'created_at',
        order = 'asc'
      } = query;
      
      let commentsQuery = supabase
        .from('comments')
        .select('*', { count: 'exact' })
        .eq('post_id', postId);
      
      if (parentId === 'null' || parentId === null) {
        commentsQuery = commentsQuery.is('parent_comment_id', null);
      } else if (parentId && typeof parentId === 'string') {
        commentsQuery = commentsQuery.eq('parent_comment_id', parentId);
      }
      
      const validOrderBy = ['created_at', 'updated_at'];
      const orderByField = validOrderBy.includes(orderBy as string) ? orderBy : 'created_at';
      const orderDirection = order === 'desc' ? false : true;
      
      commentsQuery = commentsQuery.order(orderByField as string, { ascending: orderDirection });
      
      const limitNum = Math.min(Math.max(1, parseInt(limit as string) || 50), 100);
      const offsetNum = Math.max(0, parseInt(offset as string) || 0);
      
      commentsQuery = commentsQuery.range(offsetNum, offsetNum + limitNum - 1);
      
      const { data, error, count } = await commentsQuery;
      
      if (error) {
        console.error('Supabase error:', error);
        return res.status(500).json({ error: 'Failed to fetch comments' });
      }
      
      const comments = data?.map(comment => ({
        id: comment.id,
        postId: comment.post_id,
        userId: comment.user_id,
        userName: comment.user_name,
        content: comment.content,
        parentCommentId: comment.parent_comment_id,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at
      })) || [];
      
      return res.status(200).json({
        comments,
        total: count || 0,
        limit: limitNum,
        offset: offsetNum
      });
    }
    
    if (method === 'POST' && action === 'comment' && postId) {
      // Create comment on post
      if (typeof postId !== 'string') {
        return res.status(400).json({ error: 'Post ID must be a string' });
      }
      
      const commentData = { ...body, postId } as CreateCommentBody;
      
      const validation = validateCommentData(commentData);
      if (!validation.valid) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: validation.errors 
        });
      }
      
      // Check if post exists
      const { data: post, error: postError } = await supabase
        .from('posts')
        .select('id, comments_count')
        .eq('id', postId)
        .single();
      
      if (postError || !post) {
        return res.status(404).json({ error: 'Post not found' });
      }
      
      // Check if parent comment exists (if specified)
      if (commentData.parentCommentId) {
        const { data: parentComment, error: parentError } = await supabase
          .from('comments')
          .select('id')
          .eq('id', commentData.parentCommentId)
          .eq('post_id', postId)
          .single();
        
        if (parentError || !parentComment) {
          return res.status(404).json({ error: 'Parent comment not found' });
        }
      }
      
      const commentToInsert = {
        post_id: postId,
        user_id: commentData.userId,
        user_name: commentData.userName?.trim(),
        content: commentData.content.trim(),
        parent_comment_id: commentData.parentCommentId || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { data, error } = await supabase
        .from('comments')
        .insert([commentToInsert])
        .select()
        .single();
      
      if (error) {
        console.error('Supabase error:', error);
        return res.status(500).json({ error: 'Failed to create comment' });
      }
      
      // Increment comments count on post
      await supabase
        .from('posts')
        .update({ 
          comments_count: post.comments_count + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', postId);
      
      return res.status(201).json({
        id: data.id,
        postId: data.post_id,
        userId: data.user_id,
        userName: data.user_name,
        content: data.content,
        parentCommentId: data.parent_comment_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      });
    }
    
    if (method === 'GET' && !action) {
      // Get posts
      const { 
        eventId,
        userId,
        limit = 50,
        offset = 0,
        orderBy = 'created_at',
        order = 'desc'
      } = query;
      
      let postsQuery = supabase
        .from('posts')
        .select('*', { count: 'exact' });
      
      if (eventId && typeof eventId === 'string') {
        postsQuery = postsQuery.eq('event_id', eventId);
      }
      
      if (userId && typeof userId === 'string') {
        postsQuery = postsQuery.eq('user_id', userId);
      }
      
      const validOrderBy = ['created_at', 'updated_at', 'likes_count', 'comments_count'];
      const orderByField = validOrderBy.includes(orderBy as string) ? orderBy : 'created_at';
      const orderDirection = order === 'asc' ? true : false;
      
      postsQuery = postsQuery.order(orderByField as string, { ascending: orderDirection });
      
      const limitNum = Math.min(Math.max(1, parseInt(limit as string) || 50), 100);
      const offsetNum = Math.max(0, parseInt(offset as string) || 0);
      
      postsQuery = postsQuery.range(offsetNum, offsetNum + limitNum - 1);
      
      const { data, error, count } = await postsQuery;
      
      if (error) {
        console.error('Supabase error:', error);
        return res.status(500).json({ error: 'Failed to fetch posts' });
      }
      
      const posts = data?.map(post => ({
        id: post.id,
        eventId: post.event_id,
        userId: post.user_id,
        userName: post.user_name,
        imageUrl: post.image_url,
        caption: post.caption,
        tags: post.tags,
        metadata: post.metadata,
        likesCount: post.likes_count,
        commentsCount: post.comments_count,
        createdAt: post.created_at,
        updatedAt: post.updated_at
      })) || [];
      
      return res.status(200).json({
        posts,
        total: count || 0,
        limit: limitNum,
        offset: offsetNum
      });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('Posts API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}