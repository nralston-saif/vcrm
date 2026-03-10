import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Navigation from '@/components/Navigation'
import { requireAuth } from '@/lib/auth/requireAuth'
import PersonView from './PersonView'

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { profile: currentPerson } = await requireAuth()

  // Fetch the person with their company associations
  const { data: person, error: personError } = await supabase
    .from('people')
    .select(`
      *,
      companies:company_people(
        id,
        relationship_type,
        title,
        is_primary_contact,
        end_date,
        company:companies(
          id,
          name,
          logo_url,
          short_description,
          website
        )
      )
    `)
    .eq('id', id)
    .single()

  if (personError || !person) {
    notFound()
  }

  // Fetch introducer name if set
  let introducerName: string | null = null
  if (person.introduced_by) {
    const { data: introducer } = await supabase
      .from('people')
      .select('first_name, last_name, name')
      .eq('id', person.introduced_by)
      .single()

    if (introducer) {
      introducerName = introducer.name || `${introducer.first_name || ''} ${introducer.last_name || ''}`.trim() || null
    }
  }

  // Get active company associations
  const activeCompanies = person.companies?.filter(
    (c: any) => c.company && !c.end_date
  ) || []

  const userName = currentPerson.first_name || 'User'

  // All CRM users can edit
  const canEdit = true

  return (
    <div className="min-h-screen bg-white">
      <Navigation userName={userName} personId={currentPerson.id} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PersonView
          person={person as any}
          introducerName={introducerName}
          activeCompanies={activeCompanies as any}
          canEdit={canEdit}
          isPartner={true}
          currentUserId={currentPerson.id}
          currentUserName={currentPerson.first_name || 'User'}
        />
      </main>
    </div>
  )
}
