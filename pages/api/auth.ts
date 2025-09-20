import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { serialize } from 'cookie';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method, body, headers } = req;
  
  if (method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = body;
  
  try {
    switch (action) {
      case 'signIn': {
        const { email, password } = body;
        
        if (!email || !password) {
          return res.status(400).json({ error: 'Email and password required' });
        }
        
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (error) {
          return res.status(401).json({ error: error.message });
        }
        
        if (data.session) {
          const accessToken = serialize('sb-access-token', data.session.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/'
          });
          
          const refreshToken = serialize('sb-refresh-token', data.session.refresh_token || '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 30, // 30 days
            path: '/'
          });
          
          res.setHeader('Set-Cookie', [accessToken, refreshToken]);
        }
        
        return res.status(200).json({
          user: data.user,
          session: data.session
        });
      }
      
      case 'signOut': {
        const accessToken = req.cookies['sb-access-token'];
        
        if (accessToken) {
          await supabase.auth.admin.signOut(accessToken);
        }
        
        const clearAccessToken = serialize('sb-access-token', '', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: -1,
          path: '/'
        });
        
        const clearRefreshToken = serialize('sb-refresh-token', '', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: -1,
          path: '/'
        });
        
        res.setHeader('Set-Cookie', [clearAccessToken, clearRefreshToken]);
        
        return res.status(200).json({ success: true });
      }
      
      case 'session': {
        const accessToken = req.cookies['sb-access-token'];
        const refreshToken = req.cookies['sb-refresh-token'];
        
        if (!accessToken) {
          return res.status(401).json({ error: 'No session' });
        }
        
        const { data: { user }, error } = await supabase.auth.getUser(accessToken);
        
        if (error && refreshToken) {
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
            refresh_token: refreshToken
          });
          
          if (refreshError) {
            return res.status(401).json({ error: 'Session expired' });
          }
          
          if (refreshData.session) {
            const newAccessToken = serialize('sb-access-token', refreshData.session.access_token, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'strict',
              maxAge: 60 * 60 * 24 * 7,
              path: '/'
            });
            
            const newRefreshToken = serialize('sb-refresh-token', refreshData.session.refresh_token || '', {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'strict',
              maxAge: 60 * 60 * 24 * 30,
              path: '/'
            });
            
            res.setHeader('Set-Cookie', [newAccessToken, newRefreshToken]);
            
            return res.status(200).json({
              user: refreshData.user,
              session: refreshData.session
            });
          }
        }
        
        if (error) {
          return res.status(401).json({ error: 'Invalid session' });
        }
        
        return res.status(200).json({ user });
      }
      
      case 'signUp': {
        const { email, password } = body;
        
        if (!email || !password) {
          return res.status(400).json({ error: 'Email and password required' });
        }
        
        const { data, error } = await supabase.auth.signUp({
          email,
          password
        });
        
        if (error) {
          return res.status(400).json({ error: error.message });
        }
        
        if (data.session) {
          const accessToken = serialize('sb-access-token', data.session.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 7,
            path: '/'
          });
          
          const refreshToken = serialize('sb-refresh-token', data.session.refresh_token || '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 30,
            path: '/'
          });
          
          res.setHeader('Set-Cookie', [accessToken, refreshToken]);
        }
        
        return res.status(200).json({
          user: data.user,
          session: data.session
        });
      }
      
      case 'resetPassword': {
        const { email } = body;
        
        if (!email) {
          return res.status(400).json({ error: 'Email required' });
        }
        
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`
        });
        
        if (error) {
          return res.status(400).json({ error: error.message });
        }
        
        return res.status(200).json({ success: true });
      }
      
      case 'updatePassword': {
        const { newPassword } = body;
        const accessToken = req.cookies['sb-access-token'];
        
        if (!newPassword) {
          return res.status(400).json({ error: 'New password required' });
        }
        
        if (!accessToken) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const { data: { user }, error: getUserError } = await supabase.auth.getUser(accessToken);
        
        if (getUserError || !user) {
          return res.status(401).json({ error: 'Invalid session' });
        }
        
        const { error } = await supabase.auth.admin.updateUserById(
          user.id,
          { password: newPassword }
        );
        
        if (error) {
          return res.status(400).json({ error: error.message });
        }
        
        return res.status(200).json({ success: true });
      }
      
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Auth API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}