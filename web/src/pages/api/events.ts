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

interface CreateEventBody {
  name?: string; // Support both 'name' and 'title'
  title?: string;
  description?: string;
  date?: string;
  time?: string;
  location?: string;
  maxAttendees?: number;
  isPublic?: boolean;
  hostId?: string;
  hostName?: string;
  hostEmail?: string;
  tags?: string[];
  imageUrl?: string;
}

interface Event {
  id: string;
  title: string;
  description?: string;
  date: string;
  time: string;
  location?: string;
  maxAttendees?: number;
  currentAttendees?: number;
  isPublic: boolean;
  hostId: string;
  hostName?: string;
  hostEmail?: string;
  tags?: string[];
  imageUrl?: string;
  token?: string;
  createdAt: string;
  updatedAt: string;
}

function validateEventData(data: any, requireDateAndTime: boolean = true): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  const title = data.title || data.name;
  if (!title || typeof title !== 'string' || title.trim().length < 3) {
    errors.push('Title/Name must be at least 3 characters long');
  }

  if (title && title.length > 200) {
    errors.push('Title/Name must be less than 200 characters');
  }

  // Only require date and time if specified
  if (requireDateAndTime) {
    if (!data.date || !isValidDate(data.date)) {
      errors.push('Invalid date format (YYYY-MM-DD required)');
    }

    if (!data.time || !isValidTime(data.time)) {
      errors.push('Invalid time format (HH:MM required)');
    }

    if (data.date && data.time) {
      const eventDateTime = new Date(`${data.date}T${data.time}`);
      if (eventDateTime < new Date()) {
        errors.push('Event date must be in the future');
      }
    }
  }

  // hostId is optional for simple event creation
  if (data.hostId && typeof data.hostId !== 'string') {
    errors.push('Host ID must be a string');
  }
  
  if (data.description && data.description.length > 2000) {
    errors.push('Description must be less than 2000 characters');
  }
  
  if (data.location && data.location.length > 500) {
    errors.push('Location must be less than 500 characters');
  }
  
  if (data.maxAttendees !== undefined) {
    if (!Number.isInteger(data.maxAttendees) || data.maxAttendees < 1 || data.maxAttendees > 10000) {
      errors.push('Max attendees must be between 1 and 10000');
    }
  }
  
  if (data.tags && Array.isArray(data.tags)) {
    if (data.tags.length > 10) {
      errors.push('Maximum 10 tags allowed');
    }
    for (const tag of data.tags) {
      if (typeof tag !== 'string' || tag.length > 50) {
        errors.push('Each tag must be a string with max 50 characters');
        break;
      }
    }
  }
  
  if (data.hostEmail && !isValidEmail(data.hostEmail)) {
    errors.push('Invalid host email format');
  }
  
  if (data.imageUrl && !isValidUrl(data.imageUrl)) {
    errors.push('Invalid image URL format');
  }
  
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

function isValidDate(date: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(date)) return false;
  const d = new Date(date);
  return d instanceof Date && !isNaN(d.getTime());
}

function isValidTime(time: string): boolean {
  const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return regex.test(time);
}

function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function generateEventToken(eventTitle: string): string {
  // Create a URL-friendly slug from the event title
  const baseSlug = eventTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '')     // Remove leading/trailing hyphens
    .substring(0, 30);            // Limit length

  // Add random suffix to ensure uniqueness (short and memorable)
  const randomSuffix = randomBytes(2).toString('hex'); // 4 characters

  return `${baseSlug}-${randomSuffix}`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req;
  
  try {
    switch (method) {
      case 'POST': {
        console.log('📝 [Events API] POST request received');
        const eventData = req.body as CreateEventBody;
        console.log('📝 [Events API] Request body:', JSON.stringify(eventData, null, 2));

        // Check environment variables
        if (!supabaseUrl || !supabaseServiceRoleKey) {
          console.error('❌ [Events API] Missing Supabase credentials');
          console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Present' : 'MISSING');
          console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceRoleKey ? 'Present' : 'MISSING');
          return res.status(500).json({
            error: 'Server configuration error',
            details: 'Missing Supabase credentials'
          });
        }

        // Validate event data - date and time are now required
        const validation = validateEventData(eventData, true);
        if (!validation.valid) {
          console.error('❌ [Events API] Validation failed:', validation.errors);
          return res.status(400).json({
            error: 'Validation failed',
            details: validation.errors
          });
        }

        const title = (eventData.title || eventData.name || '').trim();
        const token = generateEventToken(title);

        const eventToInsert: any = {
          title: title,
          description: eventData.description?.trim() || '',
          date: eventData.date,
          time: eventData.time,
          location: eventData.location?.trim(),
          max_attendees: eventData.maxAttendees,
          current_attendees: 0,
          is_public: eventData.isPublic ?? true,
          host_id: eventData.hostId || 'anonymous',
          host_name: eventData.hostName?.trim() || 'Anonymous Host',
          host_email: eventData.hostEmail?.trim().toLowerCase(),
          tags: eventData.tags?.map(tag => tag.trim()),
          image_url: eventData.imageUrl?.trim(),
          token: token,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // Try to get the authenticated user and link the event to them
        const authHeader = req.headers.authorization;
        if (authHeader) {
          try {
            const authToken = authHeader.replace('Bearer ', '');
            // Create a separate client for auth verification
            const authSupabase = createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!,
              {
                auth: { autoRefreshToken: false, persistSession: false }
              }
            );
            const { data: { user }, error: authError } = await authSupabase.auth.getUser(authToken);
            if (user && !authError) {
              console.log('📝 [Events API] Authenticated user found:', user.id);
              eventToInsert.host_user_id = user.id;
              // Update host_id and host_name from user profile if not provided
              if (!eventData.hostId || eventData.hostId === 'anonymous') {
                eventToInsert.host_id = user.id;
              }
              if (!eventData.hostName || eventData.hostName === 'Anonymous Host') {
                // Try to get display name from user_profiles
                const { data: profile } = await authSupabase
                  .from('user_profiles')
                  .select('display_name, email')
                  .eq('id', user.id)
                  .single();
                if (profile) {
                  eventToInsert.host_name = profile.display_name || profile.email?.split('@')[0] || 'Event Host';
                }
              }
            } else {
              console.log('📝 [Events API] No authenticated user or auth error:', authError);
            }
          } catch (error) {
            console.error('📝 [Events API] Error getting user from token:', error);
            // Continue without auth - event will be created without host_user_id
          }
        }

        console.log('📝 [Events API] Inserting event:', JSON.stringify(eventToInsert, null, 2));

        const { data, error } = await supabase
          .from('events')
          .insert([eventToInsert])
          .select()
          .single();

        if (error) {
          console.error('❌ [Events API] Supabase error:', error);
          console.error('❌ [Events API] Error details:', JSON.stringify(error, null, 2));
          return res.status(500).json({
            error: 'Failed to create event',
            details: error.message,
            code: error.code
          });
        }

        console.log('✅ [Events API] Event created successfully:', data.id);
        
        return res.status(201).json({
          eventId: data.id,
          token: token,
          event: {
            id: data.id,
            title: data.title,
            description: data.description,
            date: data.date,
            time: data.time,
            location: data.location,
            maxAttendees: data.max_attendees,
            currentAttendees: data.current_attendees,
            isPublic: data.is_public,
            hostId: data.host_id,
            hostName: data.host_name,
            hostEmail: data.host_email,
            tags: data.tags,
            imageUrl: data.image_url,
            createdAt: data.created_at,
            updatedAt: data.updated_at
          }
        });
      }
      
      case 'GET': {
        const { 
          hostId, 
          search, 
          isPublic, 
          fromDate, 
          toDate, 
          tags,
          limit = 50,
          offset = 0,
          orderBy = 'date',
          order = 'asc'
        } = req.query;
        
        let query = supabase
          .from('events')
          .select('*', { count: 'exact' });
        
        if (hostId && typeof hostId === 'string') {
          query = query.eq('host_id', hostId);
        }
        
        if (search && typeof search === 'string') {
          query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,location.ilike.%${search}%`);
        }
        
        if (isPublic !== undefined) {
          query = query.eq('is_public', isPublic === 'true');
        }
        
        if (fromDate && typeof fromDate === 'string' && isValidDate(fromDate)) {
          query = query.gte('date', fromDate);
        }
        
        if (toDate && typeof toDate === 'string' && isValidDate(toDate)) {
          query = query.lte('date', toDate);
        }
        
        if (tags && typeof tags === 'string') {
          const tagArray = tags.split(',').map(t => t.trim());
          query = query.contains('tags', tagArray);
        }
        
        const validOrderBy = ['date', 'created_at', 'title', 'current_attendees'];
        const orderByField = validOrderBy.includes(orderBy as string) ? orderBy : 'date';
        const orderDirection = order === 'desc' ? false : true;
        
        query = query.order(orderByField as string, { ascending: orderDirection });
        
        const limitNum = Math.min(Math.max(1, parseInt(limit as string) || 50), 100);
        const offsetNum = Math.max(0, parseInt(offset as string) || 0);
        
        query = query.range(offsetNum, offsetNum + limitNum - 1);
        
        const { data, error, count } = await query;
        
        if (error) {
          console.error('Supabase error:', error);
          return res.status(500).json({ error: 'Failed to fetch events' });
        }
        
        const events = data?.map(event => ({
          id: event.id,
          title: event.title,
          description: event.description,
          date: event.date,
          time: event.time,
          location: event.location,
          maxAttendees: event.max_attendees,
          currentAttendees: event.current_attendees,
          isPublic: event.is_public,
          hostId: event.host_id,
          hostName: event.host_name,
          hostEmail: event.host_email,
          tags: event.tags,
          imageUrl: event.image_url,
          token: event.token,
          createdAt: event.created_at,
          updatedAt: event.updated_at
        })) || [];
        
        return res.status(200).json({
          events,
          total: count || 0,
          limit: limitNum,
          offset: offsetNum
        });
      }
      
      case 'PUT': {
        const { eventId, token } = req.query;
        const updateData = req.body;
        
        if (!eventId || typeof eventId !== 'string') {
          return res.status(400).json({ error: 'Event ID is required' });
        }
        
        if (!token || typeof token !== 'string') {
          return res.status(401).json({ error: 'Token is required' });
        }
        
        const { data: existingEvent, error: fetchError } = await supabase
          .from('events')
          .select('token')
          .eq('id', eventId)
          .single();
        
        if (fetchError || !existingEvent) {
          return res.status(404).json({ error: 'Event not found' });
        }
        
        if (existingEvent.token !== token) {
          return res.status(403).json({ error: 'Invalid token' });
        }
        
        const allowedUpdates = ['title', 'description', 'date', 'time', 'location', 'max_attendees', 'is_public', 'tags', 'image_url'];
        const updates: any = {};
        
        for (const field of allowedUpdates) {
          if (updateData[field] !== undefined) {
            updates[field] = updateData[field];
          }
        }
        
        if (Object.keys(updates).length === 0) {
          return res.status(400).json({ error: 'No valid fields to update' });
        }
        
        updates.updated_at = new Date().toISOString();
        
        const { data, error } = await supabase
          .from('events')
          .update(updates)
          .eq('id', eventId)
          .select()
          .single();
        
        if (error) {
          console.error('Supabase error:', error);
          return res.status(500).json({ error: 'Failed to update event' });
        }
        
        return res.status(200).json({
          id: data.id,
          title: data.title,
          description: data.description,
          date: data.date,
          time: data.time,
          location: data.location,
          maxAttendees: data.max_attendees,
          currentAttendees: data.current_attendees,
          isPublic: data.is_public,
          hostId: data.host_id,
          hostName: data.host_name,
          hostEmail: data.host_email,
          tags: data.tags,
          imageUrl: data.image_url,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        });
      }
      
      case 'DELETE': {
        const { eventId, token } = req.query;
        
        if (!eventId || typeof eventId !== 'string') {
          return res.status(400).json({ error: 'Event ID is required' });
        }
        
        if (!token || typeof token !== 'string') {
          return res.status(401).json({ error: 'Token is required' });
        }
        
        const { data: existingEvent, error: fetchError } = await supabase
          .from('events')
          .select('token')
          .eq('id', eventId)
          .single();
        
        if (fetchError || !existingEvent) {
          return res.status(404).json({ error: 'Event not found' });
        }
        
        if (existingEvent.token !== token) {
          return res.status(403).json({ error: 'Invalid token' });
        }
        
        const { error } = await supabase
          .from('events')
          .delete()
          .eq('id', eventId);
        
        if (error) {
          console.error('Supabase error:', error);
          return res.status(500).json({ error: 'Failed to delete event' });
        }
        
        return res.status(200).json({ success: true, message: 'Event deleted' });
      }
      
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Events API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}