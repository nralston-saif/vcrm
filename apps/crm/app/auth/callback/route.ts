import { createClient } from '@/lib/supabase/server'
import { checkEmailConfirmed } from '@/lib/auth/check-confirmed'
import { logAuthEvent } from '@/lib/auth/log-auth-event'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const userEmail = searchParams.get('user_email')
  const next = searchParams.get('next') ?? '/login'

  // Log verification attempt
  await logAuthEvent({
    eventType: 'verification_attempt',
    email: userEmail ?? undefined,
    success: false, // Will be updated on success path
    metadata: { hasCode: !!code, next },
    request,
  })

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Successful verification - redirect to next page
      await logAuthEvent({
        eventType: 'verification_success',
        email: userEmail ?? undefined,
        success: true,
        request,
      })
      return NextResponse.redirect(`${origin}${next}`)
    }

    // Log the error for debugging
    console.error('Auth callback error:', error)

    // Code exchange failed - check if email is actually confirmed
    if (userEmail) {
      const isConfirmed = await checkEmailConfirmed(userEmail)
      if (isConfirmed) {
        // Email is confirmed, just redirect to login with success message
        await logAuthEvent({
          eventType: 'verification_fallback_success',
          email: userEmail,
          success: true,
          metadata: { originalError: error.message, originalCode: error.code },
          request,
        })
        return NextResponse.redirect(`${origin}/login?verified=true`)
      }
    }

    // Log the failure
    await logAuthEvent({
      eventType: 'verification_failed',
      email: userEmail ?? undefined,
      success: false,
      errorCode: error.code,
      errorMessage: error.message,
      request,
    })
  }

  // Return to verify page with error
  const errorUrl = new URL('/auth/verify', origin)
  errorUrl.searchParams.set('error', 'verification_failed')
  errorUrl.searchParams.set('error_description', 'Unable to verify your email. Please try signing up again.')
  return NextResponse.redirect(errorUrl.toString())
}
