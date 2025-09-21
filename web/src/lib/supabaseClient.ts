/*
You are Claude Sonnet 4.0. Edit ONLY the file: web/src/lib/supabaseClient.ts
Context: Initialize Supabase client for a Next.js 14 prototype. Will be used across server and client code.
Tech stack: Next.js 14, TypeScript, Supabase.
Requirements:
- Import { createClient } from '@supabase/supabase-js'
- Use env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
- Export a singleton `supabase` client instance
- Add TypeScript type definitions for the `posts` table and storage bucket
- Ensure this client can be used in server components (edge runtime) and client components
Return the complete file code.
*/