import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/types/database'
import Navigation from '@/components/Navigation'
import { requireAuth } from '@/lib/auth/requireAuth'
import CompanyView from './CompanyView'

type Company = Database['public']['Tables']['companies']['Row']
type Person = Database['public']['Tables']['people']['Row']
type CompanyPerson = Database['public']['Tables']['company_people']['Row']

export type ActiveDeal = {
  id: string
  company_name: string
  founder_names: string | null
  founder_linkedins: string | null
  founder_bios: string | null
  primary_email: string | null
  company_description: string | null
  website: string | null
  previous_funding: string | null
  deck_link: string | null
  submitted_at: string | null
  stage: string | null
  votes: {
    oduserId: string
    userName: string
    vote: string
    notes: string | null
  }[]
  deliberation: {
    id: string
    meeting_date: string | null
    idea_summary: string | null
    thoughts: string | null
    decision: string
    status: string | null
  } | null
}

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { profile: currentPerson } = await requireAuth()

  // Fetch company with all related data
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select(`
      *,
      people:company_people(
        id,
        user_id,
        relationship_type,
        title,
        is_primary_contact,
        start_date,
        end_date,
        person:people(
          id,
          first_name,
          last_name,
          email,
          title,
          avatar_url,
          bio,
          linkedin_url,
          twitter_url,
          location
        )
      ),
      investments:investments(
        id,
        investment_date,
        amount,
        round,
        type,
        status,
        post_money_valuation,
        discount,
        shares,
        common_shares,
        preferred_shares,
        fd_shares,
        lead_partner_id,
        exit_date,
        acquirer
      )
    `)
    .eq('id', id)
    .single()

  if (companyError) {
    console.error('Error fetching company:', companyError)
    notFound()
  }

  if (!company) {
    console.error('Company not found for id:', id)
    notFound()
  }

  // Fetch application for this company (any stage - to show application info)
  let activeDeal: ActiveDeal | null = null

  const { data: application } = await supabase
    .from('applications')
    .select(`
      id,
      company_name,
      founder_names,
      founder_linkedins,
      founder_bios,
      primary_email,
      company_description,
      website,
      previous_funding,
      deck_link,
      submitted_at,
      stage
    `)
    .eq('company_id', id)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .single()

  if (application) {
    // Fetch votes for this application
    const { data: votes } = await supabase
      .from('votes')
      .select(`
        vote,
        notes,
        voter:people!votes_user_id_fkey(id, first_name, last_name)
      `)
      .eq('application_id', application.id)

    // Fetch deliberation for this application
    const { data: deliberation } = await supabase
      .from('deliberations')
      .select('id, meeting_date, idea_summary, thoughts, decision, status')
      .eq('application_id', application.id)
      .single()

    activeDeal = {
      ...application,
      votes: (votes || []).map((v: any) => ({
        oduserId: v.voter?.id || '',
        userName: v.voter ? `${v.voter.first_name || ''} ${v.voter.last_name || ''}`.trim() : 'Unknown',
        vote: v.vote,
        notes: v.notes,
      })),
      deliberation: deliberation ? {
        ...deliberation,
        decision: deliberation.decision || 'pending',
      } : null,
    }
  }

  // Fetch partners list for decision modal
  const { data: partners } = await supabase
    .from('people')
    .select('id, first_name, last_name')
    .eq('role', 'partner')
    .eq('status', 'active')
    .order('first_name')

  const partnersList = (partners || []).map((p: any) => ({
    id: p.id,
    name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
  }))

  // Check if current user can edit this company
  const userName = currentPerson.first_name || 'User'
  const isFounder = company.people?.some(
    (cp: any) =>
      cp.user_id === currentPerson.id &&
      cp.relationship_type === 'founder' &&
      !cp.end_date
  ) || false

  const canEdit = true

  const isPortfolioCompany = company.stage === 'portfolio' || (company.investments && company.investments.length > 0)

  const typedCompany = company as Company & {
    people?: (CompanyPerson & {
      person: Person | null
    })[]
    investments?: any[]
  }

  return (
    <div className="min-h-screen bg-white">
      <Navigation userName={userName} personId={currentPerson.id} />

      {/* Main Content */}
      <CompanyView
        company={typedCompany}
        canEdit={canEdit}
        isPartner={true}
        isFounder={isFounder}
        currentPersonId={currentPerson.id}
        userName={userName}
        activeDeal={activeDeal}
        partners={partnersList}
        isPortfolioCompany={isPortfolioCompany}
      />
    </div>
  )
}
