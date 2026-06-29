import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// The only email address permitted to access /admin. Sourced from the
// ADMIN_EMAIL env var; the literal fallback keeps existing deploys working.
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'olutags@gmail.com'

/**
 * Returns the current authenticated user, or null if not signed in.
 * Use in Server Components and API routes only.
 */
export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user ?? null
}

/**
 * Returns the current user if they are the allowed admin.
 * Redirects to /admin/login if not authenticated or not authorised.
 * Use at the top of admin Server Components and layouts.
 */
export async function requireAdmin() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/admin/login')
  }

  if (user.email !== ADMIN_EMAIL) {
    redirect('/admin/login?error=unauthorised')
  }

  return user
}
