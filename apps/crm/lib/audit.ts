import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

/**
 * Audit logging helper for tracking partner actions on sensitive data
 * Uses service role key to bypass RLS for reliable logging
 */

// Initialize Supabase with service role key for audit logging
const getAuditClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Predefined audit action types for consistency
export type AuditAction =
  | 'login'
  | 'logout'
  | 'vote_cast'
  | 'vote_update'
  | 'application_stage_change'
  | 'application_view'
  | 'company_create'
  | 'company_update'
  | 'company_delete'
  | 'investment_create'
  | 'investment_update'
  | 'person_create'
  | 'person_update'
  | 'data_export'
  | 'report_generate'
  | 'note_create'
  | 'note_update'
  | 'note_delete'
  | 'ticket_create'
  | 'ticket_update'
  | 'ticket_archive'
  | 'profile_claim'

// Entity types that can be audited
export type AuditEntityType =
  | 'user'
  | 'application'
  | 'vote'
  | 'company'
  | 'investment'
  | 'person'
  | 'report'
  | 'note'
  | 'ticket'

export interface AuditEventParams {
  actorId: string
  actorEmail?: string
  action: AuditAction
  entityType: AuditEntityType
  entityId?: string
  details?: Record<string, unknown>
  request?: NextRequest | Request
}

/**
 * Extract client IP address from request headers
 */
function getClientIP(request?: NextRequest | Request): string | null {
  if (!request) return null

  const headers = request.headers

  // Check common proxy headers
  const forwardedFor = headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || null
  }

  const realIP = headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  return null
}

/**
 * Extract user agent from request headers
 */
function getUserAgent(request?: NextRequest | Request): string | null {
  if (!request) return null
  return request.headers.get('user-agent')
}

/**
 * Log an audit event to the database
 *
 * @example
 * await logAuditEvent({
 *   actorId: user.id,
 *   actorEmail: user.email,
 *   action: 'vote_cast',
 *   entityType: 'application',
 *   entityId: applicationId,
 *   details: { vote: 'yes', notes: 'Strong team' },
 *   request
 * })
 */
export async function logAuditEvent(params: AuditEventParams): Promise<string | null> {
  const {
    actorId,
    actorEmail,
    action,
    entityType,
    entityId,
    details = {},
    request,
  } = params

  try {
    const supabase = getAuditClient()

    // Use the database function to insert the audit log
    const { data, error } = await supabase.rpc('log_audit_event', {
      p_actor_id: actorId,
      p_actor_email: actorEmail || null,
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: entityId || null,
      p_details: details,
      p_ip_address: getClientIP(request),
      p_user_agent: getUserAgent(request),
    })

    if (error) {
      console.error('Failed to log audit event:', error)
      return null
    }

    return data as string
  } catch (err) {
    // Don't throw - audit logging failures shouldn't break the main operation
    console.error('Audit logging error:', err)
    return null
  }
}

/**
 * Convenience function to log an audit event without awaiting
 * Use this when you don't need to wait for the audit log to complete
 */
export function logAuditEventAsync(params: AuditEventParams): void {
  logAuditEvent(params).catch(err => {
    console.error('Async audit logging error:', err)
  })
}
