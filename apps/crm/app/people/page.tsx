import { createClient } from '@/lib/supabase/server'
import { Suspense } from 'react'
import Navigation from '@/components/Navigation'
import PeopleClient from './PeopleClient'
import { requireAuth } from '@/lib/auth/requireAuth'
import type { UserRole, UserStatus } from '@vcrm/supabase'

// Type that matches what PeopleClient expects
type PersonWithNotes = {
  id: string
  name: string | null
  first_name: string | null
  last_name: string | null
  displayName: string | null
  email: string | null
  alternative_emails: string[] | null
  role: UserRole
  status: UserStatus
  title: string | null
  bio: string | null
  avatar_url: string | null
  linkedin_url: string | null
  twitter_url: string | null
  mobile_phone: string | null
  location: string | null
  tags: string[]
  first_met_date: string | null
  introduced_by: string | null
  introduction_context: string | null
  relationship_notes: string | null
  created_at: string | null
  company_associations: {
    relationship_type: string | null
    title: string | null
    company: { id: string; name: string } | null
  }[]
  noteCount: number
}

// Force dynamic rendering to ensure searchParams are always fresh
export const dynamic = 'force-dynamic'

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>
}) {
  const { search: initialSearch } = await searchParams
  const supabase = await createClient()

  const { profile } = await requireAuth()

  // Run independent queries in parallel for better performance
  const [
      { data: people },
      { data: investments },
      { data: applications },
    ] = await Promise.all([
      // Get all people (only fields we need)
      supabase
        .from('people')
        .select(`
          id,
          name,
          first_name,
          last_name,
          email,
          role,
          status,
          title,
          bio,
          avatar_url,
          linkedin_url,
          twitter_url,
          mobile_phone,
          location,
          tags,
          first_met_date,
          introduced_by,
          introduction_context,
          relationship_notes,
          created_at
        `)
        .order('first_name', { ascending: true }),
      // Get portfolio companies (investments)
      supabase
        .from('investments')
        .select('id, company:companies(name)')
        .limit(300),
      // Get applications (pipeline and deliberation)
      supabase
        .from('applications')
        .select('id, company_name, stage')
        .limit(1000),
    ])

    const personIds = people?.map(p => p.id) || []

    // Run person-dependent queries in parallel
    const [
      { data: associations },
      { data: notes },
    ] = await Promise.all([
      // Get company associations
      supabase
        .from('company_people')
        .select('user_id, relationship_type, title, company_id')
        .in('user_id', personIds)
        .limit(2000),
      // Get note counts
      supabase
        .from('people_notes')
        .select('person_id')
        .in('person_id', personIds),
    ])

    // Get companies for associations
    const companyIds = [...new Set(associations?.map(a => a.company_id) ?? [])]
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name')
      .in('id', companyIds as string[])

    // Create company map
    const companyMap: Record<string, { id: string; name: string }> = {}
    companies?.forEach(c => {
      companyMap[c.id] = c
    })

    // Create association map by person
    const associationsByPerson: Record<string, Array<{
      relationship_type: string | null
      title: string | null
      company: { id: string; name: string } | null
    }>> = {}

    associations?.forEach(assoc => {
      if (!associationsByPerson[assoc.user_id]) {
        associationsByPerson[assoc.user_id] = []
      }
      associationsByPerson[assoc.user_id].push({
        relationship_type: assoc.relationship_type,
        title: assoc.title,
        company: assoc.company_id ? companyMap[assoc.company_id] : null,
      })
    })

    // Create a map of person_id -> note count
    const noteCountMap: Record<string, number> = {}
    notes?.forEach(note => {
      noteCountMap[note.person_id] = (noteCountMap[note.person_id] || 0) + 1
    })

    // Build company location map: company_name (lowercase) -> { page, id }
    const companyLocationMap: Record<string, { page: string; id: string }> = {}

    applications?.forEach(app => {
      const key = app.company_name.toLowerCase()
      const page = app.stage === 'deliberation' ? 'deliberation' : 'deals'
      if (!companyLocationMap[key] || (page === 'deliberation' && companyLocationMap[key].page === 'deals')) {
        companyLocationMap[key] = { page, id: app.id }
      }
    })

    investments?.forEach(inv => {
      const companyName = (inv.company as { name: string } | null)?.name
      if (companyName) {
        const key = companyName.toLowerCase()
        companyLocationMap[key] = { page: 'portfolio', id: inv.id }
      }
    })

    // Attach associations, note counts, and construct display name
    const peopleWithNotes: PersonWithNotes[] = (people || []).map(person => {
      // Cast to include fields which may not be in generated types yet
      const p = person as typeof person & { alternative_emails?: string[] | null; tags?: string[] }
      const displayName = p.first_name && p.last_name
        ? `${p.first_name} ${p.last_name}`
        : p.first_name || p.last_name || p.name || null

      return {
        id: p.id,
        name: p.name,
        first_name: p.first_name,
        last_name: p.last_name,
        displayName,
        email: p.email,
        alternative_emails: p.alternative_emails || null,
        role: p.role as UserRole,
        status: p.status as UserStatus,
        title: p.title,
        bio: p.bio,
        avatar_url: p.avatar_url,
        linkedin_url: p.linkedin_url,
        twitter_url: p.twitter_url,
        mobile_phone: p.mobile_phone,
        location: p.location,
        tags: p.tags || [],
        first_met_date: p.first_met_date,
        introduced_by: p.introduced_by,
        introduction_context: p.introduction_context,
        relationship_notes: p.relationship_notes,
        created_at: p.created_at,
        company_associations: associationsByPerson[p.id] || [],
        noteCount: noteCountMap[p.id] || 0,
      }
    })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation userName={profile?.first_name || 'User'} personId={profile?.id} />
      <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading...</div>}>
        <PeopleClient
          people={peopleWithNotes as any}
          userId={profile?.id || ''}
          userName={profile?.name || profile?.email || 'User'}
          companyLocationMap={companyLocationMap}
          initialSearch={initialSearch || ''}
        />
      </Suspense>
    </div>
  )
}
