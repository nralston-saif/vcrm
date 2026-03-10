import { createClient } from '@/lib/supabase/server'
import { Suspense } from 'react'
import Navigation from '@/components/Navigation'
import { requireAuth } from '@/lib/auth/requireAuth'
import BioMapClient from './BioMapClient'
import type { Database } from '@/lib/types/database'
import type { UserRole, UserStatus } from '@vcrm/supabase'

type Person = Database['public']['Tables']['people']['Row']
type Company = Database['public']['Tables']['companies']['Row']

// Helper to check if tags contain "bio"
const hasBioTag = (tags: string[] | null): boolean => {
  if (!tags || tags.length === 0) return false
  return tags.some(tag => tag.toLowerCase().includes('bio'))
}

// Helper to check if tags include any focus tag
const hasFocusTag = (tags: string[] | null, focusTagNames: string[]): boolean => {
  if (!tags || tags.length === 0 || focusTagNames.length === 0) return false
  return tags.some(tag => focusTagNames.includes(tag.toLowerCase()))
}

// Type for focus tags
export type FocusTag = {
  id: string
  name: string
  color: string
}

// Type for people in Bio-Map
export type BioMapPerson = {
  id: string
  name: string | null
  first_name: string | null
  last_name: string | null
  displayName: string
  email: string | null
  role: UserRole
  status: UserStatus
  title: string | null
  bio: string | null
  linkedin_url: string | null
  location: string | null
  tags: string[]
  company_associations: {
    relationship_type: string | null
    title: string | null
    company: { id: string; name: string } | null
  }[]
}

// Type for organizations in Bio-Map
export type BioMapOrganization = {
  id: string
  name: string
  short_description: string | null
  website: string | null
  logo_url: string | null
  industry: string | null
  city: string | null
  country: string | null
  stage: string | null
  entity_type: string | null
  tags: string[]
  founded_year: number | null
  contacts: {
    id: string
    name: string
    title: string | null
    email: string | null
    relationship_type: string | null
  }[]
}

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default async function BioMapPage() {
  const supabase = await createClient()

  const { profile } = await requireAuth()

  // Fetch focus tags from tags where category = 'biomap_focus'
  const { data: focusTagsData } = await supabase
    .from('tags')
    .select('id, name, color')
    .eq('category', 'biomap_focus')
    .order('name', { ascending: true })

  const focusTags: FocusTag[] = (focusTagsData || []).map(t => ({
    id: t.id,
    name: t.name,
    color: t.color || '#6B7280',
  }))
  const focusTagNames = focusTags.map(t => t.name.toLowerCase())

  // Fetch all people with tags
  const { data: allPeople } = await supabase
    .from('people')
    .select('*')
    .not('tags', 'is', null)
    .order('first_name', { ascending: true })

  // Filter for people with bio-related tags OR focus tags (backward compatible)
  const bioPeople = (allPeople || []).filter(p =>
    hasBioTag(p.tags) || hasFocusTag(p.tags, focusTagNames)
  )

  // Get company associations for bio people
  const bioPersonIds = bioPeople.map(p => p.id)
  const { data: associations } = await supabase
    .from('company_people')
    .select('user_id, relationship_type, title, company_id')
    .in('user_id', bioPersonIds)

  // Get companies for associations
  const companyIds = [...new Set(associations?.map(a => a.company_id) ?? [])]
  const { data: associatedCompanies } = await supabase
    .from('companies')
    .select('id, name')
    .in('id', companyIds as string[])

  // Create company map
  const companyMap: Record<string, { id: string; name: string }> = {}
  associatedCompanies?.forEach(c => {
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

  // Transform people data
  const transformedPeople: BioMapPerson[] = bioPeople.map(person => {
    const p = person as typeof person & { tags?: string[] }
    const displayName = p.first_name && p.last_name
      ? `${p.first_name} ${p.last_name}`
      : p.first_name || p.last_name || p.name || 'Unknown'

    return {
      id: p.id,
      name: p.name,
      first_name: p.first_name,
      last_name: p.last_name,
      displayName,
      email: p.email,
      role: p.role as UserRole,
      status: p.status as UserStatus,
      title: p.title,
      bio: p.bio,
      linkedin_url: p.linkedin_url,
      location: p.location,
      tags: p.tags || [],
      company_associations: associationsByPerson[p.id] || [],
    }
  })

  // Fetch all companies/organizations with tags
  const { data: allCompanies } = await supabase
    .from('companies')
    .select('*')
    .eq('is_active', true)
    .not('tags', 'is', null)
    .order('name', { ascending: true })

  // Filter for organizations with bio-related tags OR focus tags (backward compatible)
  const bioOrganizations = (allCompanies || []).filter(c =>
    hasBioTag(c.tags) || hasFocusTag(c.tags, focusTagNames)
  )

  // Get all contacts for these organizations (not just founders)
  const bioOrgIds = bioOrganizations.map(c => c.id)
  const { data: orgPeople } = await supabase
    .from('company_people')
    .select(`
      company_id,
      relationship_type,
      title,
      end_date,
      person:people(id, first_name, last_name, name, email)
    `)
    .in('company_id', bioOrgIds)
    .is('end_date', null)

  // Create contacts map by company
  const contactsByCompany: Record<string, Array<{ id: string; name: string; title: string | null; email: string | null; relationship_type: string | null }>> = {}
  orgPeople?.forEach(op => {
    if (!contactsByCompany[op.company_id]) {
      contactsByCompany[op.company_id] = []
    }
    const person = op.person as { id: string; first_name: string | null; last_name: string | null; name: string | null; email: string | null } | null
    if (person) {
      const name = person.first_name && person.last_name
        ? `${person.first_name} ${person.last_name}`
        : person.first_name || person.last_name || person.name || 'Unknown'
      contactsByCompany[op.company_id].push({
        id: person.id,
        name,
        title: op.title,
        email: person.email,
        relationship_type: op.relationship_type,
      })
    }
  })

  // Transform organizations data
  const transformedOrganizations: BioMapOrganization[] = bioOrganizations.map(org => {
    const c = org as typeof org & { tags?: string[] }
    return {
      id: c.id,
      name: c.name,
      short_description: c.short_description,
      website: c.website,
      logo_url: c.logo_url,
      industry: c.industry,
      city: c.city,
      country: c.country,
      stage: c.stage,
      entity_type: c.entity_type,
      tags: c.tags || [],
      founded_year: c.founded_year,
      contacts: contactsByCompany[c.id] || [],
    }
  })

  // Get unique bio tags for filter pills
  const allBioTags = new Set<string>()
  transformedPeople.forEach(p => {
    p.tags.forEach(tag => {
      if (tag.toLowerCase().includes('bio')) {
        allBioTags.add(tag)
      }
    })
  })
  transformedOrganizations.forEach(o => {
    o.tags.forEach(tag => {
      if (tag.toLowerCase().includes('bio')) {
        allBioTags.add(tag)
      }
    })
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation userName={profile?.first_name || 'User'} personId={profile?.id} />
      <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading...</div>}>
        <BioMapClient
          people={transformedPeople}
          organizations={transformedOrganizations}
          bioTags={Array.from(allBioTags).sort()}
          focusTags={focusTags}
          userId={profile?.id || ''}
        />
      </Suspense>
    </div>
  )
}
