import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { notifyReadyForDeliberation } from '@/lib/notifications'
import { requireAuthApi } from '@/lib/auth/requireAuth'

// Server-side Supabase client (service role for notifications)
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Configurable vote threshold (default 3 partners)
const REQUIRED_VOTES = parseInt(process.env.REQUIRED_VOTES || '3', 10)

/**
 * POST /api/notifications/check-votes
 * Check if an application has reached required votes and send notification if so.
 *
 * Uses idempotent approach to prevent duplicate notifications:
 * 1. Check if all_votes_in is already true (skip if so)
 * 2. Count votes
 * 3. Atomically set all_votes_in = true only if it was false
 * 4. Only send notification if WE flipped the flag
 *
 * Requires partner authentication.
 */
export async function POST(request: NextRequest) {
  // Verify authentication
  const auth = await requireAuthApi()
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { applicationId, voterId } = await request.json()

    if (!applicationId) {
      return NextResponse.json({ error: 'applicationId required' }, { status: 400 })
    }

    // First, check if notification was already sent (all_votes_in flag)
    const { data: app, error: appError } = await getSupabase()
      .from('applications')
      .select('company_name, all_votes_in')
      .eq('id', applicationId)
      .single()

    if (appError) {
      console.error('Error fetching application:', appError)
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    // If already marked as all votes in, skip (idempotent)
    if (app.all_votes_in) {
      return NextResponse.json({
        notified: false,
        reason: 'already_notified',
        voteCount: REQUIRED_VOTES
      })
    }

    // Count current votes
    const { data: votes, error: votesError } = await getSupabase()
      .from('votes')
      .select('id')
      .eq('application_id', applicationId)
      .eq('vote_type', 'initial')

    if (votesError) {
      console.error('Error fetching votes:', votesError)
      return NextResponse.json({ error: 'Failed to fetch votes' }, { status: 500 })
    }

    const voteCount = votes?.length || 0

    // Not enough votes yet
    if (voteCount < REQUIRED_VOTES) {
      return NextResponse.json({ notified: false, voteCount })
    }

    // We have enough votes - try to atomically set the flag
    // The WHERE clause ensures only ONE concurrent request succeeds
    const { data: updated, error: updateError } = await getSupabase()
      .from('applications')
      .update({ all_votes_in: true })
      .eq('id', applicationId)
      .eq('all_votes_in', false)  // Only update if still false
      .select('id')

    if (updateError) {
      console.error('Error updating application:', updateError)
      return NextResponse.json({ error: 'Failed to update application' }, { status: 500 })
    }

    // Check if WE were the one who flipped the flag
    if (updated && updated.length > 0) {
      // We won the race - send the notification
      await notifyReadyForDeliberation(applicationId, app.company_name, voterId)
      return NextResponse.json({
        notified: true,
        voteCount,
        message: 'Notification sent - all votes are in'
      })
    }

    // Another request already flipped the flag (race condition handled)
    return NextResponse.json({
      notified: false,
      reason: 'handled_by_another_request',
      voteCount
    })

  } catch (error) {
    console.error('Error in check-votes:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
