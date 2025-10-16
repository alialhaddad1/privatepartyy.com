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
    // First, try to resolve the event ID from token or UUID
    let eventId: string;
    let supabase: any; // The client for the schema where data was found
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (uuidRegex.test(eventIdOrToken)) {
      // It's a UUID, use directly
      eventId = eventIdOrToken;
      // Determine which schema has the event
      const eventResult = await tryBothSchemas<{ id: string }>((client) =>
        client.from('events').select('id').eq('id', eventIdOrToken).single()
      );
      supabase = eventResult.schema === 'api' ? supabaseApi : supabasePublic;
    } else {
      // It's a token, look up the event in both schemas
      const eventResult = await tryBothSchemas<{ id: string }>((client) =>
        client.from('events').select('id').eq('token', eventIdOrToken).single()
      );

      if (eventResult.error || !eventResult.data) {
        console.error('Error fetching event:', eventResult.error);
        return res.status(404).json({ error: 'Event not found' });
      }

      eventId = eventResult.data.id;
      supabase = eventResult.schema === 'api' ? supabaseApi : supabasePublic;
    }

    switch (method) {
      case 'GET': {
        // Get optional userId from query to check like status
        const { userId } = req.query;

        console.log(`📬 [Posts API] Fetching posts for event ${eventId} using ${supabase === supabaseApi ? 'api' : 'public'} schema`);

        // Fetch event to get host_id
        const { data: event, error: eventError } = await supabase
          .from('events')
          .select('host_id')
          .eq('id', eventId)
          .single();

        if (eventError) {
          console.error('❌ [Posts API] Error fetching event:', eventError);
          return res.status(500).json({ error: 'Failed to fetch event' });
        }

        const hostId = event?.host_id;

        // Fetch all posts for this event
        const { data: posts, error } = await supabase
          .from('event_posts')
          .select('*')
          .eq('event_id', eventId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('❌ [Posts API] Error fetching posts:', error);
          return res.status(500).json({ error: 'Failed to fetch posts' });
        }

        console.log(`✅ [Posts API] Found ${posts?.length || 0} posts for event ${eventId}`);
        if (posts && posts.length > 0) {
          console.log(`📋 [Posts API] Post IDs: ${posts.map((p: any) => p.id).join(', ')}`);
        }

        // Fetch media items for multi-media posts
        const postIds = (posts || []).map((post: any) => post.id);
        let mediaItemsMap: { [key: string]: any[] } = {};
        let userLikesMap: { [key: string]: boolean } = {};

        if (postIds.length > 0) {
          const { data: mediaItems, error: mediaError } = await supabase
            .from('event_post_media')
            .select('*')
            .in('post_id', postIds)
            .order('display_order', { ascending: true });

          if (!mediaError && mediaItems) {
            mediaItemsMap = mediaItems.reduce((acc: { [key: string]: any[] }, item: any) => {
              if (!acc[item.post_id]) {
                acc[item.post_id] = [];
              }
              acc[item.post_id].push({
                id: item.id,
                mediaType: item.media_type,
                mediaUrl: item.media_url,
                fileKey: item.file_key,
                thumbnailUrl: item.thumbnail_url,
                originalFilename: item.original_filename,
                displayOrder: item.display_order
              });
              return acc;
            }, {} as { [key: string]: any[] });
          }

          // Fetch user's likes if userId is provided
          if (userId && typeof userId === 'string') {
            const { data: userLikes, error: likesError } = await supabase
              .from('event_post_likes')
              .select('post_id')
              .in('post_id', postIds)
              .eq('user_id', userId);

            if (!likesError && userLikes) {
              userLikesMap = userLikes.reduce((acc: { [key: string]: boolean }, like: any) => {
                acc[like.post_id] = true;
                return acc;
              }, {} as { [key: string]: boolean });
            }
          }
        }

        // Transform snake_case to camelCase for frontend
        const transformedPosts = (posts || []).map((post: any) => {
          // Check if this post has multiple media items
          const hasMultipleMedia = mediaItemsMap[post.id] && mediaItemsMap[post.id].length > 0;

          // If post has media items in event_post_media table, it's a 'media' type post
          const postType = hasMultipleMedia ? 'media' : post.type;

          // For image/media posts with content, treat it as a caption
          const isImagePost = post.type === 'image' || post.type === 'media';

          return {
            id: post.id,
            type: postType,
            content: isImagePost ? null : post.content, // Only show content for text posts
            caption: isImagePost ? post.content : null, // Show content as caption for image posts
            imageUrl: post.image_url,
            fileKey: post.file_key,
            originalFilename: post.original_filename,
            mediaItems: mediaItemsMap[post.id] || [],
            authorId: post.author_id,
            authorName: post.author_name,
            authorAvatar: post.author_avatar,
            isHost: hostId ? post.author_id === hostId : false,
            likes: post.likes || 0,
            comments: post.comments || 0,
            isLiked: userLikesMap[post.id] || false,
            createdAt: post.created_at,
            updatedAt: post.updated_at
          };
        });

        console.log(`🎉 [Posts API] Returning ${transformedPosts.length} transformed posts`);

        return res.status(200).json({ posts: transformedPosts });
      }

      case 'POST': {
        // Create a new post
        const {
          type,
          content,
          caption,
          imageUrl,
          fileKey,
          originalFilename,
          mediaItems,
          authorId,
          authorName,
          authorAvatar
        } = req.body;

        if (!type || (type === 'image' && !imageUrl) || (type === 'text' && !content) || (type === 'media' && (!mediaItems || mediaItems.length === 0))) {
          return res.status(400).json({
            error: 'Missing required fields for post creation'
          });
        }

        // For 'media' type posts, store as 'image' in the database since the constraint only allows 'text' or 'image'
        // The actual media items will be stored in the event_post_media table
        const dbType = type === 'media' ? 'image' : type;

        // Store caption in content field if no content provided
        // This is a workaround until we add a caption column to the database
        const postContent = content || caption || null;

        // Create post in database
        const postData: any = {
          event_id: eventId,
          type: dbType,
          content: postContent,
          image_url: imageUrl || null,
          file_key: fileKey || null,
          original_filename: originalFilename || null,
          author_id: authorId || 'anonymous',
          author_name: authorName || 'Anonymous',
          author_avatar: authorAvatar || '👤',
          likes: 0,
          comments: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { data: post, error } = await supabase
          .from('event_posts')
          .insert(postData)
          .select()
          .single();

        if (error) {
          console.error('Error creating post:', error);
          return res.status(500).json({
            error: 'Failed to create post',
            details: error.message
          });
        }

        // If this is a multi-media post, insert media items
        if (type === 'media' && mediaItems && mediaItems.length > 0) {
          const mediaData = mediaItems.map((item: any, index: number) => ({
            post_id: post.id,
            media_type: item.type,
            media_url: item.url,
            file_key: item.fileKey,
            original_filename: item.filename,
            display_order: index
          }));

          const { error: mediaError } = await supabase
            .from('event_post_media')
            .insert(mediaData);

          if (mediaError) {
            console.error('Error creating media items:', mediaError);
            // Don't fail the whole operation, but log the error
          }
        }

        return res.status(201).json({
          postId: post.id,
          post
        });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Posts API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
