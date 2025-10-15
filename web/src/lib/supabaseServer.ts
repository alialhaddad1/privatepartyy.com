import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client creator
 * Uses service role key for admin operations
 * Returns undefined if environment variables are not configured
 */
export function getSupabaseServer() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Return null if environment variables are not set (e.g., during build)
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.warn('Supabase environment variables not configured');
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
