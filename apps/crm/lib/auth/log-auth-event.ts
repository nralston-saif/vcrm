import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export type AuthEventType =
  | 'email_check'
  | 'signup_started'
  | 'verification_attempt'
  | 'verification_success'
  | 'verification_failed'
  | 'verification_fallback_success'
  | 'resend_verification'
  | 'claim_attempt'
  | 'claim_success'
  | 'claim_failed'
  | 'login_attempt'
  | 'login_success'
  | 'login_failed'

interface LogAuthEventParams {
  eventType: AuthEventType
  email?: string
  userId?: string
  success: boolean
  errorCode?: string
  errorMessage?: string
  metadata?: Record<string, unknown>
  request?: NextRequest
}

/**
 * Log an authentication event to the auth events table.
 * Uses service role client to bypass RLS.
 *
 * This function is fire-and-forget - errors are logged but don't throw.
 */
export async function logAuthEvent({
  eventType,
  email,
  userId,
  success,
  errorCode,
  errorMessage,
  metadata,
  request,
}: LogAuthEventParams): Promise<void> {
  try {
    const supabase = getServiceClient()

    // Extract IP and user agent from request if provided
    let ipAddress: string | null = null
    let userAgent: string | null = null

    if (request) {
      ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        ?? request.headers.get('x-real-ip')
        ?? null
      userAgent = request.headers.get('user-agent') ?? null
    }

    const { error } = await supabase.from('auth_events').insert({
      event_type: eventType,
      email: email?.toLowerCase(),
      user_id: userId,
      success,
      error_code: errorCode,
      error_message: errorMessage,
      metadata: metadata ?? {},
      ip_address: ipAddress,
      user_agent: userAgent,
    })

    if (error) {
      console.error('Failed to log auth event:', error)
    }
  } catch (err) {
    // Don't let logging failures affect the auth flow
    console.error('Error in logAuthEvent:', err)
  }
}
