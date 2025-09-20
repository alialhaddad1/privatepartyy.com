import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface UploadRequestBody {
  eventId: string;
  eventToken: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
  uploadType?: 'post' | 'event' | 'profile';
  userId?: string;
}

interface UploadResponse {
  uploadUrl: string;
  storagePath: string;
  publicUrl: string;
  expiresIn: number;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml'
];

function validateUploadRequest(data: any): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];
  
  if (!data.eventId || typeof data.eventId !== 'string') {
    errors.push('Event ID is required');
  }
  
  if (!data.eventToken || typeof data.eventToken !== 'string') {
    errors.push('Event token is required');
  }
  
  if (!data.fileName || typeof data.fileName !== 'string') {
    errors.push('File name is required');
  }
  
  if (!data.fileType || typeof data.fileType !== 'string') {
    errors.push('File type is required');
  }
  
  if (!ALLOWED_IMAGE_TYPES.includes(data.fileType)) {
    errors.push(`Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`);
  }
  
  if (data.fileSize !== undefined) {
    if (typeof data.fileSize !== 'number' || data.fileSize <= 0) {
      errors.push('File size must be a positive number');
    }
    
    if (data.fileSize > MAX_FILE_SIZE) {
      errors.push(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }
  }
  
  if (data.uploadType && !['post', 'event', 'profile'].includes(data.uploadType)) {
    errors.push('Invalid upload type. Must be: post, event, or profile');
  }
  
  if (data.fileName.length > 255) {
    errors.push('File name must be less than 255 characters');
  }
  
  // Check for path traversal attempts
  if (data.fileName.includes('..') || data.fileName.includes('/') || data.fileName.includes('\\')) {
    errors.push('Invalid file name format');
  }
  
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
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

function generateStoragePath(
  eventId: string, 
  fileName: string, 
  uploadType: string = 'post',
  userId?: string
): string {
  const timestamp = Date.now();
  const randomId = randomBytes(8).toString('hex');
  const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'jpg';
  const sanitizedFileName = `${randomId}_${timestamp}.${fileExtension}`;
  
  let basePath = '';
  
  switch (uploadType) {
    case 'event':
      basePath = `events/${eventId}/cover`;
      break;
    case 'profile':
      basePath = `events/${eventId}/profiles/${userId || 'anonymous'}`;
      break;
    case 'post':
    default:
      basePath = `events/${eventId}/posts`;
      break;
  }
  
  return `${basePath}/${sanitizedFileName}`;
}

function getContentDisposition(fileName: string): string {
  // Sanitize filename for Content-Disposition header
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `inline; filename="${sanitized}"`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req;
  
  if (method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const uploadRequest = req.body as UploadRequestBody;
    
    // Validate request data
    const validation = validateUploadRequest(uploadRequest);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.errors 
      });
    }
    
    // Validate event token
    const isValidToken = await validateEventToken(uploadRequest.eventId, uploadRequest.eventToken);
    if (!isValidToken) {
      return res.status(403).json({ error: 'Invalid event token' });
    }
    
    // Generate storage path
    const storagePath = generateStoragePath(
      uploadRequest.eventId,
      uploadRequest.fileName,
      uploadRequest.uploadType,
      uploadRequest.userId
    );
    
    // Create signed upload URL
    const { data: signedUrlData, error: signedUrlError } = await supabase
      .storage
      .from('uploads')
      .createSignedUploadUrl(storagePath, {
        upsert: false
      });
    
    if (signedUrlError || !signedUrlData) {
      console.error('Signed URL error:', signedUrlError);
      return res.status(500).json({ error: 'Failed to create upload URL' });
    }
    
    // Get public URL for the file (will be accessible after upload)
    const { data: publicUrlData } = supabase
      .storage
      .from('uploads')
      .getPublicUrl(storagePath);
    
    // Set cache headers for upload URLs
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    
    // Log upload request for monitoring
    const uploadLog = {
      event_id: uploadRequest.eventId,
      storage_path: storagePath,
      file_type: uploadRequest.fileType,
      file_size: uploadRequest.fileSize,
      upload_type: uploadRequest.uploadType || 'post',
      user_id: uploadRequest.userId,
      requested_at: new Date().toISOString()
    };
    
    // Optionally log to uploads_log table for tracking
    try {
      await supabase
        .from('upload_logs')
        .insert([uploadLog])
        .select()
        .single();
    } catch (err: unknown) {
      // Don't fail the request if logging fails
      console.warn('Failed to log upload request:', err);
    }
    
    const response: UploadResponse = {
      uploadUrl: signedUrlData.signedUrl,
      storagePath: storagePath,
      publicUrl: publicUrlData.publicUrl,
      expiresIn: 3600 // 1 hour
    };
    
    return res.status(200).json(response);
    
  } catch (error) {
    console.error('Uploads API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Helper endpoint for batch upload requests (optional)
export async function batchHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req;
  
  if (method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { requests } = req.body as { requests: UploadRequestBody[] };
    
    if (!Array.isArray(requests)) {
      return res.status(400).json({ error: 'Requests must be an array' });
    }
    
    if (requests.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 upload requests allowed per batch' });
    }
    
    const results = await Promise.allSettled(
      requests.map(async (uploadRequest) => {
        // Validate request data
        const validation = validateUploadRequest(uploadRequest);
        if (!validation.valid) {
          throw new Error(`Validation failed: ${validation.errors?.join(', ')}`);
        }
        
        // Validate event token
        const isValidToken = await validateEventToken(uploadRequest.eventId, uploadRequest.eventToken);
        if (!isValidToken) {
          throw new Error('Invalid event token');
        }
        
        // Generate storage path
        const storagePath = generateStoragePath(
          uploadRequest.eventId,
          uploadRequest.fileName,
          uploadRequest.uploadType,
          uploadRequest.userId
        );
        
        // Create signed upload URL
        const { data: signedUrlData, error: signedUrlError } = await supabase
          .storage
          .from('uploads')
          .createSignedUploadUrl(storagePath, {
            upsert: false
          });
        
        if (signedUrlError || !signedUrlData) {
          throw new Error('Failed to create upload URL');
        }
        
        // Get public URL
        const { data: publicUrlData } = supabase
          .storage
          .from('uploads')
          .getPublicUrl(storagePath);
        
        return {
          uploadUrl: signedUrlData.signedUrl,
          storagePath: storagePath,
          publicUrl: publicUrlData.publicUrl,
          expiresIn: 3600
        };
      })
    );
    
    const response = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return {
          index,
          success: true,
          data: result.value
        };
      } else {
        return {
          index,
          success: false,
          error: result.reason.message
        };
      }
    });
    
    return res.status(200).json({ results: response });
    
  } catch (error) {
    console.error('Batch uploads API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}