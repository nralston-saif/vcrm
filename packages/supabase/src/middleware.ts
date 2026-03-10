import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './types/database'

export interface MiddlewareConfig {
  /** Paths that don't require authentication */
  publicPaths?: string[]
  /** Path to redirect unauthenticated users to */
  loginPath?: string
  /** Path to redirect authenticated users to when accessing login page */
  defaultRedirect?: string
}

export async function updateSession(
  request: NextRequest,
  config: MiddlewareConfig = {}
) {
  const {
    publicPaths = ['/auth', '/_next', '/api'],
    loginPath = '/auth/login',
    defaultRedirect = '/',
  } = config

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Check if current path matches any public path
  const isPublicPath = publicPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  // Redirect to login if not authenticated and not on public path
  if (!user && !isPublicPath && request.nextUrl.pathname !== '/') {
    // Support external login URLs (absolute URLs)
    if (loginPath.startsWith('http://') || loginPath.startsWith('https://')) {
      return NextResponse.redirect(loginPath)
    }
    const url = request.nextUrl.clone()
    url.pathname = loginPath
    return NextResponse.redirect(url)
  }

  // Redirect to default page if authenticated and accessing login
  if (user && request.nextUrl.pathname === loginPath) {
    const url = request.nextUrl.clone()
    url.pathname = defaultRedirect
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export { NextResponse, type NextRequest }
