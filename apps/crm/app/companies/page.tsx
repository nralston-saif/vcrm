import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/types/database'
import Navigation from '@/components/Navigation'
import { requireAuth } from '@/lib/auth/requireAuth'
import CompanyGrid from './CompanyGrid'

type Company = Database['public']['Tables']['companies']['Row']

export default async function CompaniesPage() {
  const supabase = await createClient()

  const { profile: person } = await requireAuth()

  const userName = person.first_name || 'User'

  // Fetch all companies for CRM management
  let companies: any[] | null = null
  let companiesError: any = null

  const result = await supabase
    .from('companies')
    .select(`
      id,
      name,
      short_description,
      website,
      logo_url,
      industry,
      city,
      country,
      founded_year,
      yc_batch,
      stage,
      tags,
      people:company_people(
        user_id,
        relationship_type,
        is_primary_contact,
        end_date,
        person:people(
          id,
          first_name,
          last_name,
          title,
          avatar_url
        )
      ),
      investments:investments(
        id,
        amount,
        round,
        type
      )
    `)
    .eq('is_active', true)
    .order('name')
  companies = result.data
  companiesError = result.error

  if (companiesError) {
    console.error('Error fetching companies:', companiesError)
  }

  const typedCompanies = (companies || []) as (Company & {
    people?: Array<{
      user_id: string
      relationship_type: string
      is_primary_contact: boolean
      end_date: string | null
      person: {
        id: string
        first_name: string | null
        last_name: string | null
        title: string | null
        avatar_url: string | null
      } | null
    }>
    investments?: Array<{
      id: string
      amount: number | null
      round: string | null
      type: string | null
    }>
  })[]

  return (
    <div className="min-h-screen bg-white">
      <Navigation userName={userName} personId={person.id} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {typedCompanies.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No companies found</p>
          </div>
        ) : (
          <CompanyGrid companies={typedCompanies} isPartner={true} userId={person.id} />
        )}
      </main>
    </div>
  )
}
