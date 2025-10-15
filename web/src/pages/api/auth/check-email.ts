import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create admin client with service role key
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Use admin client to check if user exists
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error) {
      console.error('Error listing users:', error);
      return res.status(500).json({ error: 'Failed to check email', hasPassword: false });
    }

    // Find user by email
    const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      // User doesn't exist
      return res.status(200).json({ exists: false, hasPassword: false });
    }

    // Check if user has encrypted_password (indicates password-based auth)
    // If user was created with magic link or OAuth, they won't have this
    const hasPassword = user.app_metadata?.provider === 'email' &&
                       (user as any).encrypted_password !== undefined &&
                       (user as any).encrypted_password !== '';

    return res.status(200).json({
      exists: true,
      hasPassword: hasPassword
    });

  } catch (error) {
    console.error('Error in check-email:', error);
    return res.status(500).json({ error: 'Internal server error', hasPassword: false });
  }
}
