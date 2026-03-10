import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Navigation from '@/components/Navigation'
import { requireAuth } from '@/lib/auth/requireAuth'
import { fundConfig } from '@/fund.config'
import TicketsClient from './TicketsClient'

// Types for the RPC response
type TicketsPageData = {
  tickets: Array<{
    id: string
    title: string
    description: string | null
    status: string
    priority: string
    due_date: string | null
    assigned_to: string | null
    created_by: string | null
    related_company: string | null
    related_person: string | null
    tags: string[] | null
    created_at: string
    updated_at: string
    archived_at: string | null
    application_id: string | null
    was_unassigned_at_creation: boolean | null
    is_flagged: boolean | null
    source: 'partner' | 'founder_feedback' | null
    feedback_type: 'bug_report' | 'suggestion' | 'question' | null
    assigned_partner: { id: string; first_name: string | null; last_name: string | null; email: string | null; avatar_url: string | null } | null
    creator: { id: string; first_name: string | null; last_name: string | null; email: string | null; avatar_url: string | null } | null
    company: { id: string; name: string; logo_url: string | null } | null
    person: { id: string; first_name: string | null; last_name: string | null; email: string | null } | null
    application: { id: string; company_name: string; draft_rejection_email: string | null; primary_email: string | null } | null
    comments: Array<{
      id: string
      ticket_id: string
      author_id: string | null
      content: string
      is_final_comment: boolean | null
      is_testing_comment: boolean | null
      is_reactivated_comment: boolean | null
      created_at: string
      updated_at: string
      author: { id: string; first_name: string | null; last_name: string | null; email: string | null; avatar_url: string | null } | null
    }>
  }>
  partners: Array<{ id: string; first_name: string | null; last_name: string | null; email: string | null; avatar_url: string | null }>
  companies: Array<{ id: string; name: string; logo_url: string | null }>
  people: Array<{ id: string; first_name: string | null; last_name: string | null; email: string | null }>
}

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default async function TicketsPage() {
  if (!fundConfig.modules.tickets) notFound()
  const supabase = await createClient()

  const { profile } = await requireAuth()

  // Fetch all data in a single database call for maximum performance
  // This reduces 4 network round-trips to 1
  const { data: pageData } = await supabase.rpc('get_tickets_page_data' as any, { p_limit: 500 }) as { data: TicketsPageData | null }

  // Extract data from the consolidated response
  const tickets = pageData?.tickets || []
  const partners = pageData?.partners || []
  const companies = pageData?.companies || []
  const people = pageData?.people || []

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation userName={profile.first_name || 'User'} personId={profile.id} />
      <TicketsClient
        tickets={tickets as any}
        partners={partners as any}
        companies={companies as any}
        people={people as any}
        currentUserId={profile.id}
        userName={profile?.first_name && profile?.last_name ? `${profile.first_name} ${profile.last_name}` : profile?.email || 'User'}
      />
    </div>
  )
}
