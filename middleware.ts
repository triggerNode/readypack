import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Forward the pathname as a request header so Server Component layouts
  // can read it via headers() — used by admin layout to skip auth guard on /admin/login
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the session — do not add logic between createServerClient and getUser
  //
  // Wrapped because this call reaches Supabase over the network on EVERY matched
  // request. Unhandled, a database blip or a slow response turns the middleware
  // itself into the failure: every page, including the ones that need no session
  // at all (the landing page, /privacy, /terms, /samples), stops responding until
  // the platform times the function out. A visitor who cannot reach the site is a
  // worse outcome than a visitor whose session is briefly stale, so on failure we
  // log and serve the page unauthenticated. Anything that actually requires a
  // session re-checks server-side and redirects to sign-in.
  try {
    await supabase.auth.getUser()
  } catch (error) {
    console.error(
      `[middleware] session refresh failed for ${request.nextUrl.pathname}; serving unauthenticated:`,
      error instanceof Error ? error.message : error,
    )
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
