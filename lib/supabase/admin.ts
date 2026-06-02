import { createClient } from '@supabase/supabase-js'

// IMPORTANT: This client bypasses Row Level Security.
// Use ONLY in server-side API routes for admin operations.
// NEVER import this in components, pages, or client-side code.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)
