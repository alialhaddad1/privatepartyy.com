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

interface SignedUrlRequestBody {
  filename: string;
  contentType: string;
  eventId: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { filename, contentType, eventId } = req.body as SignedUrlRequestBody;

    if (!filename || !contentType || !eventId) {
      return res.status(400).json({
        error: 'Missing required fields: filename, contentType, eventId'
      });
    }

    // Validate content type is an image
    if (!contentType.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image uploads are allowed' });
    }

    // Generate a unique file key
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const fileExtension = filename.split('.').pop() || 'jpg';
    const fileKey = `events/${eventId}/${timestamp}-${randomId}.${fileExtension}`;

    // Get signed URL from Supabase Storage
    const { data: signedUrlData, error: signedUrlError } = await supabase
      .storage
      .from('event-images')
      .createSignedUploadUrl(fileKey);

    if (signedUrlError || !signedUrlData) {
      console.error('Error creating signed URL:', signedUrlError);
      return res.status(500).json({
        error: 'Failed to generate upload URL',
        details: signedUrlError?.message
      });
    }

    // Generate public URL (it won't be accessible until the file is uploaded)
    const { data: publicUrlData } = supabase
      .storage
      .from('event-images')
      .getPublicUrl(fileKey);

    return res.status(200).json({
      signedUrl: signedUrlData.signedUrl,
      token: signedUrlData.token,
      fileKey,
      publicUrl: publicUrlData.publicUrl
    });

  } catch (error) {
    console.error('Upload API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
