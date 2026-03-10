import { createClient } from '@supabase/supabase-js'
import { sendSMS, formatNotificationForSMS } from './twilio'

// Server-side client with service role for creating notifications
const getServiceClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Notification types that are eligible for SMS
const SMS_ELIGIBLE_TYPES: NotificationType[] = [
  'new_application',
  'ready_for_deliberation',
  'decision_made',
  'ticket_assigned',
]

export type NotificationType =
  | 'new_application'
  | 'ready_for_deliberation'
  | 'new_deliberation_notes'
  | 'decision_made'
  | 'ticket_assigned'
  | 'ticket_archived'
  | 'ticket_status_changed'

export type CreateNotificationParams = {
  recipientId: string
  actorId?: string | null
  type: NotificationType
  title: string
  message?: string
  link?: string
  applicationId?: string
  ticketId?: string
}

/**
 * Check if a recipient has opted into SMS for this notification type
 * and send SMS if enabled
 */
async function maybeSendSMSNotification(
  recipientId: string,
  type: NotificationType,
  title: string,
  message?: string
) {
  console.log('[SMS] Starting maybeSendSMSNotification:', { recipientId, type, title })

  // Skip if this notification type isn't SMS-eligible
  if (!SMS_ELIGIBLE_TYPES.includes(type)) {
    console.log('[SMS] Type not SMS-eligible:', type)
    return
  }

  const supabase = getServiceClient()

  // Get recipient's SMS preferences and phone number
  const { data: recipient, error } = await supabase
    .from('people')
    .select('mobile_phone, sms_notifications_enabled, sms_notification_types')
    .eq('id', recipientId)
    .single()

  if (error || !recipient) {
    console.log('[SMS] Could not fetch recipient preferences:', error?.message)
    return
  }

  console.log('[SMS] Recipient preferences:', {
    sms_enabled: recipient.sms_notifications_enabled,
    phone: recipient.mobile_phone ? 'set' : 'missing',
    types: recipient.sms_notification_types
  })

  // Check if SMS is enabled globally for this user
  if (!recipient.sms_notifications_enabled) {
    console.log('[SMS] SMS not enabled for user')
    return
  }

  // Check if user has a phone number
  if (!recipient.mobile_phone) {
    console.log('[SMS] Recipient has no phone number')
    return
  }

  // Check if this notification type is enabled for SMS
  const enabledTypes = recipient.sms_notification_types || []
  if (!enabledTypes.includes(type)) {
    console.log('[SMS] Type not in user enabled types:', { type, enabledTypes })
    return
  }

  // Format and send SMS
  const smsText = formatNotificationForSMS(title, message)
  console.log('[SMS] Attempting to send:', { to: recipient.mobile_phone, text: smsText })
  const result = await sendSMS(recipient.mobile_phone, smsText)
  console.log('[SMS] Send result:', result)
}

/**
 * Create a notification for a single recipient
 * Use this from server-side code (API routes, server actions)
 * Also sends SMS if the recipient has opted in
 */
export async function createNotification(params: CreateNotificationParams) {
  const supabase = getServiceClient()

  const { error } = await supabase.from('notifications').insert({
    recipient_id: params.recipientId,
    actor_id: params.actorId || null,
    type: params.type,
    title: params.title,
    message: params.message || null,
    link: params.link || null,
    application_id: params.applicationId || null,
    ticket_id: params.ticketId || null,
  })

  if (error) {
    console.error('Error creating notification:', error)
  } else {
    // Send SMS notification if recipient has opted in
    // Must await on serverless to ensure it completes before function terminates
    try {
      await maybeSendSMSNotification(params.recipientId, params.type, params.title, params.message)
    } catch (err) {
      console.error('[SMS] Error sending SMS:', err)
    }
  }

  return { error }
}

/**
 * Create notifications for multiple recipients
 * Excludes the actor from receiving the notification
 * Also sends SMS to recipients who have opted in
 */
export async function createNotificationForMany(
  params: Omit<CreateNotificationParams, 'recipientId'> & {
    recipientIds: string[]
    excludeActorId?: string
  }
) {
  const supabase = getServiceClient()

  // Filter out the actor if specified
  const recipients = params.excludeActorId
    ? params.recipientIds.filter((id) => id !== params.excludeActorId)
    : params.recipientIds

  if (recipients.length === 0) {
    return { error: null }
  }

  const notifications = recipients.map((recipientId) => ({
    recipient_id: recipientId,
    actor_id: params.actorId || null,
    type: params.type,
    title: params.title,
    message: params.message || null,
    link: params.link || null,
    application_id: params.applicationId || null,
    ticket_id: params.ticketId || null,
  }))

  const { error } = await supabase.from('notifications').insert(notifications)

  if (error) {
    console.error('Error creating notifications:', error)
  } else {
    // Send SMS notifications to recipients who have opted in
    // Must await on serverless to ensure it completes before function terminates
    await Promise.all(
      recipients.map(recipientId =>
        maybeSendSMSNotification(recipientId, params.type, params.title, params.message)
          .catch(err => console.error(`[SMS] Error sending to ${recipientId}:`, err))
      )
    )
  }

  return { error }
}

/**
 * Get all partner IDs for broadcasting notifications
 */
export async function getAllPartnerIds(): Promise<string[]> {
  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from('people')
    .select('id')
    .eq('role', 'partner')

  if (error) {
    console.error('Error fetching partners:', error)
    return []
  }

  return data?.map((p) => p.id) || []
}

/**
 * Get person IDs who voted on an application
 */
export async function getVoterIds(applicationId: string): Promise<string[]> {
  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from('votes')
    .select('user_id')
    .eq('application_id', applicationId)
    .eq('vote_type', 'initial')

  if (error) {
    console.error('Error fetching voters:', error)
    return []
  }

  return data?.map((v) => v.user_id) || []
}

/**
 * Notification: New application submitted
 */
export async function notifyNewApplication(applicationId: string, companyName: string) {
  const partnerIds = await getAllPartnerIds()

  return createNotificationForMany({
    recipientIds: partnerIds,
    type: 'new_application',
    title: `New application: ${companyName}`,
    message: 'A new company has applied. Review and cast your vote.',
    link: `/deals#app-${applicationId}`,
    applicationId,
  })
}

/**
 * Notification: Application reached 3 votes (ready to be advanced)
 */
export async function notifyReadyForDeliberation(
  applicationId: string,
  companyName: string,
  actorId?: string
) {
  const partnerIds = await getAllPartnerIds()

  return createNotificationForMany({
    recipientIds: partnerIds,
    excludeActorId: actorId,
    actorId,
    type: 'ready_for_deliberation',
    title: `${companyName} ready to be advanced`,
    message: 'All 3 votes are in.',
    link: `/deals#app-${applicationId}`,
    applicationId,
  })
}

/**
 * Notification: New deliberation notes added
 */
export async function notifyNewDeliberationNotes(
  applicationId: string,
  companyName: string,
  actorId: string,
  actorName: string
) {
  const voterIds = await getVoterIds(applicationId)

  return createNotificationForMany({
    recipientIds: voterIds,
    excludeActorId: actorId,
    actorId,
    type: 'new_deliberation_notes',
    title: `New notes on ${companyName}`,
    message: `${actorName} added deliberation notes.`,
    link: `/deals/${applicationId}`,
    applicationId,
  })
}

/**
 * Notification: Decision made on application
 */
export async function notifyDecisionMade(
  applicationId: string,
  companyName: string,
  decision: 'invested' | 'rejected',
  actorId: string,
  actorName: string
) {
  const voterIds = await getVoterIds(applicationId)

  const decisionText = decision === 'invested' ? 'invested in' : 'rejected'

  return createNotificationForMany({
    recipientIds: voterIds,
    excludeActorId: actorId,
    actorId,
    type: 'decision_made',
    title: `${companyName} ${decisionText}`,
    message: `${actorName} marked ${companyName} as ${decision}.`,
    link: decision === 'invested' ? `/portfolio` : `/deals/${applicationId}`,
    applicationId,
  })
}

/**
 * Notification: Ticket assigned to someone
 * Note: We notify even for self-assignments as a reminder
 */
export async function notifyTicketAssigned(
  ticketId: string,
  ticketTitle: string,
  assigneeId: string,
  actorId: string,
  actorName: string
) {
  // Use the ticket title directly for email tickets (more descriptive)
  const isEmailTicket = ticketTitle.includes('email') || ticketTitle.includes('Email')
  const title = isEmailTicket ? ticketTitle : `Ticket assigned to you`
  const message = isEmailTicket
    ? `${actorName} assigned this to you`
    : `${actorName} assigned you: "${ticketTitle}"`

  return createNotification({
    recipientId: assigneeId,
    actorId,
    type: 'ticket_assigned',
    title,
    message,
    link: `/tickets?id=${ticketId}`,
    ticketId,
  })
}

/**
 * Notification: Ticket archived (notify creator)
 */
export async function notifyTicketArchived(
  ticketId: string,
  ticketTitle: string,
  creatorId: string,
  actorId: string,
  actorName: string
) {
  // Don't notify if self-archiving
  if (creatorId === actorId) {
    return { error: null }
  }

  return createNotification({
    recipientId: creatorId,
    actorId,
    type: 'ticket_archived',
    title: `Your ticket was archived`,
    message: `${actorName} archived: "${ticketTitle}"`,
    link: `/tickets?id=${ticketId}`,
    ticketId,
  })
}

/**
 * Notification: Ticket status changed (notify creator)
 */
export async function notifyTicketStatusChanged(
  ticketId: string,
  ticketTitle: string,
  creatorId: string,
  actorId: string,
  actorName: string,
  newStatus: string
) {
  // Don't notify if self-updating
  if (creatorId === actorId) {
    return { error: null }
  }

  const statusLabel = newStatus === 'in_progress' ? 'In Progress' : newStatus

  return createNotification({
    recipientId: creatorId,
    actorId,
    type: 'ticket_status_changed',
    title: `Ticket status updated`,
    message: `${actorName} changed "${ticketTitle}" to ${statusLabel}`,
    link: `/tickets?id=${ticketId}`,
    ticketId,
  })
}

// ============================================
// Dismissal Functions
// ============================================

/**
 * Dismiss all notifications for a specific application
 * Optionally filter by recipient and/or notification types
 */
export async function dismissNotificationsForApplication(
  applicationId: string,
  recipientId?: string,
  types?: NotificationType[]
) {
  const supabase = getServiceClient()

  let query = supabase
    .from('notifications')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('application_id', applicationId)
    .is('dismissed_at', null)

  if (recipientId) {
    query = query.eq('recipient_id', recipientId)
  }

  if (types && types.length > 0) {
    query = query.in('type', types)
  }

  const { error } = await query

  if (error) {
    console.error('Error dismissing application notifications:', error)
  }

  return { error }
}

/**
 * Dismiss all notifications for a specific ticket
 * Optionally filter by recipient
 */
export async function dismissNotificationsForTicket(
  ticketId: string,
  recipientId?: string
) {
  const supabase = getServiceClient()

  let query = supabase
    .from('notifications')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('ticket_id', ticketId)
    .is('dismissed_at', null)

  if (recipientId) {
    query = query.eq('recipient_id', recipientId)
  }

  const { error } = await query

  if (error) {
    console.error('Error dismissing ticket notifications:', error)
  }

  return { error }
}
