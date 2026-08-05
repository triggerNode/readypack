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
    global: {
      // Every read goes to the database, never to Next's Data Cache.
      //
      // supabase-js issues PostgREST selects as GET requests, and Next patches
      // global fetch so a GET can be cached and REPLAYED — including across
      // deployments. That is silently wrong for operational state. It is what
      // broke the generation backstop: the every-minute cron sends a byte-for-
      // byte identical query, so once an empty result was cached it kept being
      // served an empty queue and never started a single job, while returning
      // 200 and looking healthy. The same query with the same key from outside
      // Vercel returned the row.
      //
      // Writes were unaffected (POSTs are not cached), which is why order
      // creation kept working and hid this.
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  }
)
