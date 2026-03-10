import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { notifyDecisionMade } from '@/lib/notifications'
import { requireAuthApi } from '@/lib/auth/requireAuth'

// Server-side Supabase client (service role for notifications)
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/notifications/decision-made
 * Send notification when a decision is made on an application (invest/reject)
 * Requires partner authentication.
 */
export async function POST(request: NextRequest) {
  // Verify authentication
  const auth = await requireAuthApi()
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { applicationId, decision, actorId, actorName } = await request.json()

    if (!applicationId || !decision || !actorId || !actorName) {
      return NextResponse.json(
        { error: 'applicationId, decision, actorId, and actorName required' },
        { status: 400 }
      )
    }

    // Only notify for final decisions (yes/no)
    if (decision !== 'yes' && decision !== 'no') {
      return NextResponse.json({ notified: false, reason: 'not_final_decision' })
    }

    // Get the application name
    const { data: app, error: appError } = await getSupabase()
      .from('applications')
      .select('company_name')
      .eq('id', applicationId)
      .single()

    if (appError || !app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    // Map decision to notification format
    const decisionType = decision === 'yes' ? 'invested' : 'rejected'

    // Send notification
    await notifyDecisionMade(applicationId, app.company_name, decisionType, actorId, actorName)

    return NextResponse.json({ notified: true })
  } catch (error) {
    console.error('Error in decision-made notification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
