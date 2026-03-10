import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'
import { logAuthEvent } from '@/lib/auth/log-auth-event'

const RATE_LIMIT_WINDOW = 60 * 1000
const RATE_LIMIT_MAX = 5

function getServiceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type CheckEmailResponse = {
  canSignup: boolean
  reason: 'eligible' | 'not_eligible' | 'pending_verification' | 'already_active'
  message?: string
  canResendVerification?: boolean
}

export async function POST(request: NextRequest): Promise<NextResponse<CheckEmailResponse>> {
  const ip = getClientIP(request.headers)
  const rateLimit = await checkRateLimit(`check-email:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { canSignup: false, reason: 'not_eligible', message: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  try {
    const body = await request.json()
    const email = body.email?.trim()?.toLowerCase()

    if (!email) {
      return NextResponse.json(
        { canSignup: false, reason: 'not_eligible', message: 'Email is required' },
        { status: 400 }
      )
    }

    const supabase = getServiceClient()
    const notEligibleResponse: CheckEmailResponse = {
      canSignup: false,
      reason: 'not_eligible',
      message: 'This email is not eligible for signup. If you believe this is an error, please contact us.',
    }

    const { data: person, error: personError } = await supabase
      .from('people')
      .select('id, email, auth_user_id, status, role')
      .ilike('email', email)
      .maybeSingle()

    if (personError) {
      console.error('Error checking email:', personError)
      return NextResponse.json(
        { canSignup: false, reason: 'not_eligible', message: 'An error occurred. Please try again.' },
        { status: 500 }
      )
    }

    if (!person) {
      return NextResponse.json(notEligibleResponse)
    }

    if (person.auth_user_id) {
      return NextResponse.json({
        canSignup: false,
        reason: 'already_active',
        message: 'You already have an account. Please log in instead.',
      })
    }

    // Paginate through auth users to handle >1000 users
    const normalizedEmail = email.toLowerCase()
    const perPage = 1000
    let page = 1
    let existingAuthUser = null

    while (!existingAuthUser) {
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers({
        page,
        perPage,
      })

      if (authError || !authUsers?.users) {
        break
      }

      existingAuthUser = authUsers.users.find(
        (u) => u.email?.toLowerCase() === normalizedEmail
      )

      // No more pages if we got fewer than perPage results
      if (authUsers.users.length < perPage) {
        break
      }

      page++
    }

    if (existingAuthUser) {
      if (existingAuthUser.email_confirmed_at) {
        return NextResponse.json(notEligibleResponse)
      }
      return NextResponse.json({
        canSignup: false,
        reason: 'pending_verification',
        message: 'A signup is already in progress. Please check your inbox for the verification link.',
        canResendVerification: true,
      })
    }

    if (person.status !== 'eligible') {
      await logAuthEvent({
        eventType: 'email_check',
        email,
        success: false,
        metadata: { reason: 'status_not_eligible', status: person.status },
        request,
      })
      return NextResponse.json(notEligibleResponse)
    }

    await logAuthEvent({
      eventType: 'email_check',
      email,
      success: true,
      metadata: { reason: 'eligible' },
      request,
    })
    return NextResponse.json({ canSignup: true, reason: 'eligible' })
  } catch (error) {
    console.error('Check email error:', error)
    return NextResponse.json(
      { canSignup: false, reason: 'not_eligible', message: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
