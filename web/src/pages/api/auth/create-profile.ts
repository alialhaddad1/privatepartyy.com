import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabaseClient';

/**
 * API endpoint to manually create a user profile
 * This is useful when the trigger fails or for existing users without profiles
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the user from the authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token or user not found' });
    }

    // Check if profile already exists
    const { data: existingProfile, error: checkError } = await (supabase
      .from('user_profiles') as any)
      .select('id')
      .eq('id', user.id)
      .single();

    if (existingProfile) {
      return res.status(200).json({
        message: 'Profile already exists',
        profile: existingProfile
      });
    }

    // Create the profile
    const displayName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'User';

    const { data: newProfile, error: createError } = await (supabase
      .from('user_profiles') as any)
      .insert({
        id: user.id,
        email: user.email,
        display_name: displayName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating profile:', createError);
      return res.status(500).json({
        error: 'Failed to create profile',
        details: createError.message
      });
    }

    return res.status(201).json({
      message: 'Profile created successfully',
      profile: newProfile
    });

  } catch (error: any) {
    console.error('Exception in create-profile:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
