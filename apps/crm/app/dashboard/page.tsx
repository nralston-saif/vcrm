import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navigation from '@/components/Navigation'
import DashboardClient from './DashboardClient'
import { requireAuth } from '@/lib/auth/requireAuth'
import { fundConfig } from '@/fund.config'
import type { Database } from '@/lib/types/database'

export default async function DashboardPage() {
  const { profile } = await requireAuth()
  const supabase = await createClient()

  // Run all queries in parallel
  const todayDate = new Date().toISOString().split('T')[0]

  const [
    { data: allApplications },
    { data: statsData },
    { data: allActiveTickets },
    { data: notificationsData },
    { data: portfolioData },
    { data: newsArticles }
  ] = await Promise.all([
    // Applications (deals module)
    fundConfig.modules.deals
      ? supabase
          .from('applications')
          .select(`
            id,
            company_name,
            founder_names,
            company_description,
            submitted_at,
            stage,
            votes(id, user_id, vote_type),
            deliberations(decision)
          `)
          .in('stage', ['new', 'application', 'interview'])
          .order('submitted_at', { ascending: false })
          .then(r => r)
      : Promise.resolve({ data: [] as any[] }),

    // Application stats
    fundConfig.modules.deals
      ? supabase.rpc('get_application_stats').then(r => r)
      : Promise.resolve({ data: null as any }),

    // Active tickets (tickets module)
    fundConfig.modules.tickets
      ? supabase
          .from('tickets')
          .select(`
            id,
            title,
            description,
            priority,
            due_date,
            status,
            tags,
            company:related_company(name)
          `)
          .in('status', ['open', 'in_progress'])
          .or(`assigned_to.eq.${profile.id},assigned_to.is.null`)
          .order('priority', { ascending: true })
          .order('due_date', { ascending: true, nullsFirst: false })
          .then(r => r)
      : Promise.resolve({ data: [] as any[] }),

    // Notifications
    fundConfig.modules.notifications
      ? supabase
          .from('notifications')
          .select(`
            id,
            type,
            title,
            message,
            link,
            application_id,
            ticket_id,
            read_at,
            created_at,
            actor:actor_id(name, first_name, last_name),
            ticket:tickets!notifications_ticket_id_fkey(title, tags)
          `)
          .eq('recipient_id', profile.id)
          .is('dismissed_at', null)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(20)
          .then(r => r)
      : Promise.resolve({ data: [] as any[] }),

    // Portfolio stats
    fundConfig.modules.portfolio
      ? supabase.rpc('get_portfolio_stats').then(r => r)
      : Promise.resolve({ data: null as any }),

    // AI News articles
    fundConfig.modules.news
      ? supabase
          .from('news_articles')
          .select('id, title, url, source_name, topic, is_ai_safety, published_at, fetch_date')
          .order('fetch_date', { ascending: false })
          .order('published_at', { ascending: false })
          .limit(5)
          .then(r => r)
      : Promise.resolve({ data: [] as any[] }),
  ])

  // Split applications by stage
  const pipelineApps = allApplications?.filter((app: any) => app.stage && ['new', 'application'].includes(app.stage)) || []
  const deliberationApps = allApplications?.filter((app: any) => app.stage === 'interview') || []

  // Calculate overdue count from tickets data
  const overdueTicketsCount = allActiveTickets?.filter((t: any) => t.due_date && t.due_date < todayDate).length || 0
  const myActiveTickets = allActiveTickets?.slice(0, 10) || []

  // Filter pipeline apps that need user's vote
  const needsVote = pipelineApps?.filter((app: any) => {
    const initialVotes = app.votes?.filter((v: any) => v.vote_type === 'initial') || []
    return !initialVotes.some((v: any) => v.user_id === profile.id)
  }).map((app: any) => ({
    id: app.id,
    company_name: app.company_name,
    founder_names: app.founder_names,
    company_description: app.company_description,
    submitted_at: app.submitted_at,
  })) || []

  // Filter deliberation apps without final decision
  const needsDecision = deliberationApps?.filter((app: any) => {
    const delib = Array.isArray(app.deliberations) ? app.deliberations[0] : app.deliberations
    const decision = (delib as any)?.decision
    return !decision || decision === 'pending' || decision === 'maybe'
  }).map((app: any) => ({
    id: app.id,
    company_name: app.company_name,
    founder_names: app.founder_names,
    submitted_at: app.submitted_at,
  })) || []

  // Process stats
  const statsRow = Array.isArray(statsData) ? statsData[0] : statsData
  const stats = {
    pipeline: Number(statsRow?.pipeline) || 0,
    deliberation: Number(statsRow?.deliberation) || 0,
    invested: Number(statsRow?.invested) || 0,
    rejected: Number(statsRow?.rejected) || 0,
  }

  const portfolioRow = Array.isArray(portfolioData) ? portfolioData[0] : portfolioData
  const portfolioStats = {
    totalInvestments: Number(portfolioRow?.total_investments) || 0,
    totalInvested: Number(portfolioRow?.total_invested) || 0,
    averageCheck: Number(portfolioRow?.average_check) || 0,
  }

  const notifications = (notificationsData || []).map((n: any) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    link: n.link,
    application_id: n.application_id,
    ticket_id: n.ticket_id,
    read_at: n.read_at,
    created_at: n.created_at,
    actor_name: n.actor?.first_name && n.actor?.last_name
      ? `${n.actor.first_name} ${n.actor.last_name}`
      : n.actor?.name || null,
    ticket_title: n.ticket?.title || null,
    ticket_tags: n.ticket?.tags || null,
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation userName={profile.first_name || 'User'} personId={profile.id} />
      <DashboardClient
        needsVote={needsVote}
        needsDecision={needsDecision}
        myActiveTickets={myActiveTickets || []}
        overdueTicketsCount={overdueTicketsCount || 0}
        stats={stats}
        portfolioStats={portfolioStats}
        notifications={notifications}
        userId={profile.id}
        newsArticles={newsArticles || []}
      />
    </div>
  )
}
