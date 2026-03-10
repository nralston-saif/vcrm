import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { logAuthEvent } from '@/lib/auth/log-auth-event'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = body.email?.trim()?.toLowerCase()

    if (!email) {
      return NextResponse.json(
        { success: false, message: 'Email is required' },
        { status: 400 }
      )
    }

    // Rate limit: 3 requests per 5 minutes per email
    const rateLimitKey = `resend-verification:${email}`
    const { allowed, remaining } = await checkRateLimit(rateLimitKey, 3, 5 * 60 * 1000)

    if (!allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many requests. Please wait a few minutes before trying again.' },
        { status: 429 }
      )
    }

    const supabase = await createClient()

    // Resend the signup confirmation email
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${request.nextUrl.origin}/auth/callback?user_email=${encodeURIComponent(email)}`,
      },
    })

    if (error) {
      console.error('Error resending verification email:', error)
      await logAuthEvent({
        eventType: 'resend_verification',
        email,
        success: false,
        errorCode: error.code,
        errorMessage: error.message,
        request,
      })
      // Don't expose the actual error to the client for security
      return NextResponse.json({
        success: false,
        message: 'Unable to resend verification email. Please try again later.'
      })
    }

    await logAuthEvent({
      eventType: 'resend_verification',
      email,
      success: true,
      request,
    })

    return NextResponse.json({
      success: true,
      message: 'Verification email sent. Please check your inbox.'
    })

  } catch (error: any) {
    console.error('Resend verification error:', error)
    return NextResponse.json(
      { success: false, message: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
