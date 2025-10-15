import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface UserProfile {
  id: string;
  name: string;
  email: string;
  generation?: string | null;
  avatar: string;
  isAnonymous: boolean;
  createdAt: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req;

  try {
    switch (method) {
      case 'POST': {
        // Create or update user profile
        const profileData = req.body as UserProfile;

        console.log('📝 [Profile API] Creating/updating profile:', profileData.email);

        // Validate required fields
        if (!profileData.id || !profileData.email || !profileData.name) {
          return res.status(400).json({
            error: 'Missing required fields',
            details: 'id, email, and name are required'
          });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(profileData.email)) {
          return res.status(400).json({
            error: 'Invalid email format'
          });
        }

        // Check if profile with this email already exists
        const { data: existingProfile, error: fetchError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('email', profileData.email.toLowerCase())
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          // PGRST116 means no rows found, which is fine
          console.error('❌ [Profile API] Error checking existing profile:', fetchError);
        }

        let result;

        if (existingProfile) {
          // Update existing profile
          console.log('✏️ [Profile API] Updating existing profile for:', profileData.email);

          const { data, error } = await supabase
            .from('user_profiles')
            .update({
              name: profileData.name,
              avatar: profileData.avatar,
              generation: profileData.generation,
              is_anonymous: profileData.isAnonymous,
              updated_at: new Date().toISOString()
            })
            .eq('email', profileData.email.toLowerCase())
            .select()
            .single();

          if (error) {
            console.error('❌ [Profile API] Error updating profile:', error);
            return res.status(500).json({
              error: 'Failed to update profile',
              details: error.message
            });
          }

          result = data;
        } else {
          // Create new profile
          console.log('✨ [Profile API] Creating new profile for:', profileData.email);

          const { data, error } = await supabase
            .from('user_profiles')
            .insert([{
              id: profileData.id,
              name: profileData.name,
              email: profileData.email.toLowerCase(),
              avatar: profileData.avatar,
              generation: profileData.generation,
              is_anonymous: profileData.isAnonymous,
              created_at: profileData.createdAt,
              updated_at: new Date().toISOString()
            }])
            .select()
            .single();

          if (error) {
            console.error('❌ [Profile API] Error creating profile:', error);
            return res.status(500).json({
              error: 'Failed to create profile',
              details: error.message
            });
          }

          result = data;
        }

        console.log('✅ [Profile API] Profile saved successfully:', result.id);

        return res.status(200).json({
          success: true,
          profile: {
            id: result.id,
            name: result.name,
            email: result.email,
            avatar: result.avatar,
            generation: result.generation,
            isAnonymous: result.is_anonymous,
            createdAt: result.created_at,
            updatedAt: result.updated_at
          }
        });
      }

      case 'GET': {
        // Get user profile by email
        const { email } = req.query;

        if (!email || typeof email !== 'string') {
          return res.status(400).json({
            error: 'Email is required'
          });
        }

        console.log('🔍 [Profile API] Fetching profile for:', email);

        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('email', email.toLowerCase())
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            return res.status(404).json({
              error: 'Profile not found'
            });
          }

          console.error('❌ [Profile API] Error fetching profile:', error);
          return res.status(500).json({
            error: 'Failed to fetch profile',
            details: error.message
          });
        }

        console.log('✅ [Profile API] Profile found:', data.id);

        return res.status(200).json({
          profile: {
            id: data.id,
            name: data.name,
            email: data.email,
            avatar: data.avatar,
            generation: data.generation,
            isAnonymous: data.is_anonymous,
            createdAt: data.created_at,
            updatedAt: data.updated_at
          }
        });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('❌ [Profile API] Unexpected error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
