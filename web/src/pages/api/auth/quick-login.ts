import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * API endpoint for passwordless quick login
 * Sends a magic link to the user's email for instant authentication
 * Creates user if they don't exist, otherwise sends login link
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, redirectTo } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Create regular Supabase client for magic link
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Send magic link (creates user if they don't exist)
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true, // Auto-create user if they don't exist
        emailRedirectTo: redirectTo || undefined,
        data: {
          display_name: email.split('@')[0]
        }
      }
    });

    if (error) {
      console.error('Error sending magic link:', error);
      return res.status(500).json({ error: 'Failed to send magic link' });
    }

    console.log('Magic link sent to:', email);

    return res.status(200).json({
      success: true,
      email,
      message: 'Magic link sent! Check your email to complete login.'
    });

  } catch (error: any) {
    console.error('Exception in quick-login endpoint:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
