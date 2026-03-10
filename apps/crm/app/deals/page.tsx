import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Navigation from '@/components/Navigation'
import { requireAuth } from '@/lib/auth/requireAuth'
import { fundConfig } from '@/fund.config'
import DealsClient from './DealsClient'

type RawVote = {
  id: string
  vote: string
  user_id: string
  notes: string | null
  vote_type: string
  people: { name: string } | null
}

// Type for the RPC response
type DealsPageData = {
  applications: Array<{
    id: string
    company_id: string | null
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
    votes_revealed: boolean | null
    stage: string | null
    email_sent: boolean | null
    email_sent_at: string | null
    draft_rejection_email: string | null
    votes: RawVote[]
    deliberations: Array<{
      id: string
      meeting_date: string | null
      idea_summary: string | null
      thoughts: string | null
      decision: string | null
      status: string | null
      tags: string[] | null
      created_at: string | null
    }>
    email_sender: { name: string } | null
  }>
  partners: Array<{ id: string; name: string | null }>
  interviewTags: Array<{ name: string; color: string | null }>
}

type TransformedVote = {
  oduserId: string
  userName: string
  vote: string
  notes: string | null
}

function transformVotes(votes: RawVote[] | undefined): TransformedVote[] {
  if (!votes) return []

  return votes
    .filter((v) => v.vote_type === 'initial')
    .map((v) => ({
      oduserId: v.user_id,
      userName: v.people?.name || 'Unknown',
      vote: v.vote,
      notes: v.notes,
    }))
}

export default async function DealsPage(): Promise<React.ReactElement> {
  if (!fundConfig.modules.deals) notFound()
  const supabase = await createClient()

  const { profile } = await requireAuth()

  // Fetch all data in a single database call for maximum performance
  // This reduces 3 network round-trips to 1
  const { data: pageData } = await supabase.rpc('get_deals_page_data' as any) as { data: DealsPageData | null }

  // Extract data from the consolidated response
  const allApplications = pageData?.applications || []
  const partners = pageData?.partners || []
  const interviewTags = pageData?.interviewTags || []

  // Transform and filter applications by stage
  const votingAppsWithVotes = (allApplications || [])
    .filter(app => app.stage === 'new' || app.stage === 'application')
    .map((app) => {
      const allVotes = transformVotes(app.votes as RawVote[])
      const userVote = allVotes.find((v) => v.oduserId === profile?.id)

      return {
        id: app.id,
        company_id: app.company_id,
        company_name: app.company_name,
        founder_names: app.founder_names,
        founder_linkedins: app.founder_linkedins,
        founder_bios: app.founder_bios,
        primary_email: app.primary_email,
        company_description: app.company_description,
        website: app.website,
        previous_funding: app.previous_funding,
        deck_link: app.deck_link,
        submitted_at: app.submitted_at,
        votes_revealed: app.votes_revealed,
        voteCount: allVotes.length,
        userVote: userVote?.vote,
        userNotes: userVote?.notes,
        allVotes,
      }
    })

  const deliberationAppsWithVotes = (allApplications || [])
    .filter(app => app.stage === 'interview' && app.votes_revealed === true)
    .map((app) => {
      const votes = transformVotes(app.votes as RawVote[])
      const deliberation = Array.isArray(app.deliberations)
        ? app.deliberations[0]
        : app.deliberations || null

      return {
        id: app.id,
        company_id: app.company_id,
        company_name: app.company_name,
        founder_names: app.founder_names,
        founder_linkedins: app.founder_linkedins,
        founder_bios: app.founder_bios,
        primary_email: app.primary_email,
        company_description: app.company_description,
        website: app.website,
        previous_funding: app.previous_funding,
        deck_link: app.deck_link,
        submitted_at: app.submitted_at,
        stage: app.stage,
        votes,
        voteCount: votes.length,
        allVotes: votes,
        deliberation: deliberation ? {
          ...deliberation,
          decision: deliberation.decision || '',
          tags: deliberation.tags || [],
          created_at: deliberation.created_at || null,
        } : null,
        email_sent: app.email_sent,
        email_sent_at: app.email_sent_at,
        email_sender_name: (app.email_sender as { name: string } | null)?.name || null,
      }
    })

  const undecidedDeliberations = deliberationAppsWithVotes
    .filter(
      (app) =>
        !app.deliberation?.decision ||
        app.deliberation.decision === 'pending' ||
        app.deliberation.decision === 'maybe'
    )
    .sort(
      (a, b) =>
        new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime()
    )

  const decidedDeliberations = deliberationAppsWithVotes
    .filter(
      (app) =>
        app.deliberation?.decision === 'yes' || app.deliberation?.decision === 'no'
    )
    .sort(
      (a, b) =>
        new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime()
    )

  const archivedAppsTransformed = (allApplications || [])
    .filter(app => app.stage === 'portfolio' || app.stage === 'rejected')
    .map((app) => {
      const deliberation = Array.isArray(app.deliberations)
        ? app.deliberations[0]
        : null
      return {
        id: app.id,
        company_id: app.company_id,
        company_name: app.company_name,
        founder_names: app.founder_names,
        founder_linkedins: app.founder_linkedins,
        founder_bios: app.founder_bios,
        primary_email: app.primary_email,
        company_description: app.company_description,
        website: app.website,
        previous_funding: app.previous_funding,
        deck_link: app.deck_link,
        stage: app.stage,
        previous_stage: (app as { previous_stage?: string }).previous_stage || null,
        submitted_at: app.submitted_at,
        email_sent: app.email_sent,
        email_sent_at: app.email_sent_at,
        email_sender_name: (app.email_sender as { name: string } | null)?.name || null,
        allVotes: transformVotes(app.votes as RawVote[]),
        draft_rejection_email: (app as { draft_rejection_email?: string }).draft_rejection_email || null,
        decision: deliberation?.decision || null,
      }
    })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation userName={profile?.first_name || 'User'} personId={profile?.id} />
      <DealsClient
        votingApplications={votingAppsWithVotes}
        undecidedDeliberations={undecidedDeliberations}
        decidedDeliberations={decidedDeliberations}
        archivedApplications={archivedAppsTransformed}
        userId={profile?.id || ''}
        partners={partners || []}
        interviewTags={interviewTags || []}
      />
    </div>
  )
}
