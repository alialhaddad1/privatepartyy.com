import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * API endpoint for quick login - creates or signs in a user without email verification
 * Uses admin API to bypass email confirmation and create an instant session
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Create admin client for bypassing email confirmation
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Check if user already exists
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error('Error listing users:', listError);
      return res.status(500).json({ error: 'Failed to check existing users' });
    }

    const existingUser = existingUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    let userId: string;
    let isNewUser = false;

    if (existingUser) {
      // User exists - use their ID
      userId = existingUser.id;
      console.log('Existing user found:', email);
    } else {
      // Create new user without email confirmation
      const randomPassword = Math.random().toString(36).slice(-16) + Math.random().toString(36).slice(-16);

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: randomPassword,
        email_confirm: true, // Skip email verification - user is auto-confirmed
        user_metadata: {
          display_name: email.split('@')[0]
        }
      });

      if (createError || !newUser.user) {
        console.error('Error creating user:', createError);
        return res.status(500).json({ error: 'Failed to create user account' });
      }

      userId = newUser.user.id;
      isNewUser = true;
      console.log('New user created:', email);
    }

    // Generate an access token for immediate login
    const { data: tokenData, error: tokenError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: undefined // Don't send email
      }
    });

    if (tokenError) {
      console.error('Error generating token:', tokenError);
    }

    return res.status(200).json({
      success: true,
      userId,
      email,
      isNewUser,
      // Client should use signInWithPassword with the auto-generated credentials
      // Or we provide a session token
      message: 'User ready for quick login'
    });

  } catch (error: any) {
    console.error('Exception in quick-login endpoint:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
