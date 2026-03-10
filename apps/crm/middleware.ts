import { updateSession, NextResponse, type NextRequest } from '@vcrm/supabase/middleware'

function generateNonce(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Buffer.from(array).toString('base64')
}

function buildCSP(nonce: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseHost = supabaseUrl ? new URL(supabaseUrl).host : ''

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `img-src 'self' data: blob: ${supabaseUrl}`,
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src 'self' ${supabaseUrl} wss://${supabaseHost} https://*.liveblocks.io wss://*.liveblocks.io`,
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ]
  return directives.join('; ')
}

export async function middleware(request: NextRequest) {
  const nonce = generateNonce()

  if (request.nextUrl.pathname.startsWith('/api/')) {
    const response = NextResponse.next()
    response.headers.set('x-nonce', nonce)
    response.headers.set('Content-Security-Policy-Report-Only', buildCSP(nonce))
    return response
  }

  const response = await updateSession(request, {
    publicPaths: ['/login', '/auth', '/_next', '/api'],
    loginPath: '/login',
    defaultRedirect: '/dashboard',
  })

  response.headers.set('x-nonce', nonce)
  response.headers.set('Content-Security-Policy-Report-Only', buildCSP(nonce))

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
