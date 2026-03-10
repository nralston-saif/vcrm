import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { notifyTicketAssigned, notifyTicketArchived, notifyTicketStatusChanged } from '@/lib/notifications'
import { requireAuthApi } from '@/lib/auth/requireAuth'

// Server-side Supabase client (service role for notifications)
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/notifications/ticket
 * Send notification for ticket events (assigned, archived)
 * Requires partner authentication.
 */
export async function POST(request: NextRequest) {
  // Verify authentication
  const auth = await requireAuthApi()
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { type, ticketId, ticketTitle, targetId, creatorId, actorId, actorName, newStatus } = await request.json()

    if (!type || !ticketId || !actorId || !actorName) {
      return NextResponse.json(
        { error: 'type, ticketId, actorId, and actorName required' },
        { status: 400 }
      )
    }

    if (type === 'assigned') {
      // Notification for ticket assignment
      if (!targetId) {
        return NextResponse.json({ error: 'targetId required for assignment' }, { status: 400 })
      }

      await notifyTicketAssigned(ticketId, ticketTitle, targetId, actorId, actorName)
      return NextResponse.json({ notified: true, type: 'assigned' })

    } else if (type === 'archived') {
      // Notification for ticket archived
      if (!creatorId) {
        return NextResponse.json({ error: 'creatorId required for archive' }, { status: 400 })
      }

      await notifyTicketArchived(ticketId, ticketTitle, creatorId, actorId, actorName)
      return NextResponse.json({ notified: true, type: 'archived' })

    } else if (type === 'status_changed') {
      // Notification for ticket status change
      if (!creatorId) {
        return NextResponse.json({ error: 'creatorId required for status change' }, { status: 400 })
      }

      await notifyTicketStatusChanged(ticketId, ticketTitle, creatorId, actorId, actorName, newStatus || 'updated')
      return NextResponse.json({ notified: true, type: 'status_changed' })

    } else {
      return NextResponse.json({ error: 'Unknown notification type' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error in ticket notification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
