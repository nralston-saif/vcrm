import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { notifyTicketAssigned } from '@/lib/notifications'
import { requireAuthApi } from '@/lib/auth/requireAuth'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/tickets
 * Create a ticket and send the assignment notification in a single server-side call.
 * This avoids the race condition / silent failure of fire-and-forget client-side notifications.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuthApi()
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const {
      title,
      description,
      priority,
      assignedTo,
      createdBy,
      tags,
      applicationId,
      actorName,
    } = await request.json()

    if (!title || !assignedTo || !createdBy || !actorName) {
      return NextResponse.json(
        { error: 'title, assignedTo, createdBy, and actorName are required' },
        { status: 400 }
      )
    }

    // 1. Create the ticket
    const { data: ticket, error: ticketError } = await getSupabase()
      .from('tickets')
      .insert({
        title,
        description: description || null,
        status: 'open',
        priority: priority || 'medium',
        assigned_to: assignedTo,
        created_by: createdBy,
        tags: tags || null,
        application_id: applicationId || null,
      })
      .select('id')
      .single()

    if (ticketError || !ticket) {
      console.error('Error creating ticket:', ticketError)
      return NextResponse.json(
        { error: ticketError?.message || 'Failed to create ticket' },
        { status: 500 }
      )
    }

    // 2. Send notification (same transaction context, no separate client fetch needed)
    try {
      await notifyTicketAssigned(ticket.id, title, assignedTo, createdBy, actorName)
    } catch (notifError) {
      console.error('Ticket created but notification failed:', notifError)
      // Still return success — the ticket exists, notification failure is non-fatal
    }

    return NextResponse.json({ ticketId: ticket.id })
  } catch (error) {
    console.error('Error in POST /api/tickets:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
