'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Database } from '@/lib/types/database'

type Person = Database['public']['Tables']['people']['Row'] & {
  companies?: Array<{
    id: string
    relationship_type: string
    title: string | null
    is_primary_contact: boolean
    end_date: string | null
    company: {
      id: string
      name: string
      logo_url: string | null
      stage: string
    } | null
  }>
}

interface PeopleGridProps {
  people: Person[]
  isPartner: boolean
}

export default function PeopleGrid({ people, isPartner }: PeopleGridProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [sortOrder, setSortOrder] = useState<'first_asc' | 'first_desc' | 'last_asc' | 'last_desc'>('first_asc')

  // Filter people based on search and role
  const filteredPeople = people.filter((person) => {
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      const nameMatch = `${person.first_name} ${person.last_name}`.toLowerCase().includes(query)
      const titleMatch = person.title?.toLowerCase().includes(query)
      const bioMatch = person.bio?.toLowerCase().includes(query)
      const locationMatch = person.location?.toLowerCase().includes(query)
      const companyMatch = person.companies?.some(
        (c) => c.company?.name.toLowerCase().includes(query)
      )

      if (!nameMatch && !titleMatch && !bioMatch && !locationMatch && !companyMatch) {
        return false
      }
    }

    // Role filter
    if (roleFilter !== 'all' && person.role !== roleFilter) {
      return false
    }

    return true
  })

  // Sort people alphabetically
  const sortedPeople = [...filteredPeople].sort((a, b) => {
    const firstA = (a.first_name || '').toLowerCase()
    const firstB = (b.first_name || '').toLowerCase()
    const lastA = (a.last_name || '').toLowerCase()
    const lastB = (b.last_name || '').toLowerCase()

    switch (sortOrder) {
      case 'first_asc':
        return firstA.localeCompare(firstB)
      case 'first_desc':
        return firstB.localeCompare(firstA)
      case 'last_asc':
        return lastA.localeCompare(lastB)
      case 'last_desc':
        return lastB.localeCompare(lastA)
      default:
        return firstA.localeCompare(firstB)
    }
  })

  return (
    <div>
      {/* Search and Filter Bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Search by name, company, location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
        >
          <option value="all">All Roles</option>
          <option value="founder">Founders</option>
          <option value="partner">Partners</option>
          {isPartner && (
            <>
              <option value="advisor">Advisors</option>
              <option value="employee">Employees</option>
              <option value="board_member">Board Members</option>
            </>
          )}
        </select>
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as 'first_asc' | 'first_desc' | 'last_asc' | 'last_desc')}
          className="px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
        >
          <option value="first_asc">A-Z First Name</option>
          <option value="first_desc">Z-A First Name</option>
          <option value="last_asc">A-Z Last Name</option>
          <option value="last_desc">Z-A Last Name</option>
        </select>
      </div>

      {/* Results Count */}
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          {sortedPeople.length === people.length
            ? `${people.length} ${people.length === 1 ? 'person' : 'people'}`
            : `${sortedPeople.length} of ${people.length} people`
          }
        </p>
      </div>

      {/* People Grid */}
      {people.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-12 text-center">
          <div className="flex justify-center mb-4">
            <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No contacts yet</h3>
          <p className="text-gray-500">Add people manually or they&apos;ll be created from deal applications.</p>
        </div>
      ) : sortedPeople.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No people match your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedPeople.map((person) => {
            // Get active companies (any company the person is currently associated with)
            const activeCompanies = person.companies?.filter(
              (c) => c.company && !c.end_date
            ) || []

            const primaryCompany = activeCompanies.find((c) => c.is_primary_contact)?.company ||
                                   activeCompanies[0]?.company

            return (
              <div
                key={person.id}
                onClick={() => router.push(`/people/${person.id}`)}
                className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition hover:shadow-md cursor-pointer relative"
              >
                {/* LinkedIn button - top right */}
                {person.linkedin_url && (
                  <a
                    href={person.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors"
                    title="LinkedIn"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                    </svg>
                  </a>
                )}

                {/* Avatar and Basic Info */}
                <div className="flex items-start space-x-3">
                  {person.avatar_url ? (
                    <img
                      src={person.avatar_url}
                      alt={`${person.first_name} ${person.last_name}`}
                      className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-semibold text-gray-500">
                        {person.first_name?.[0] || '?'}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0 pr-8">
                    <h3 className="text-base font-semibold text-gray-900 truncate">
                      {person.first_name} {person.last_name}
                    </h3>
                    {person.title && (
                      <p className="text-sm text-gray-600 truncate">{person.title}</p>
                    )}
                    {primaryCompany && (
                      <p className="text-sm text-gray-500 truncate">{primaryCompany.name}</p>
                    )}
                    <div className="mt-1 flex items-center gap-2">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {person.role === 'board_member' ? 'Board Member' :
                         person.role.charAt(0).toUpperCase() + person.role.slice(1)}
                      </span>
                      {isPartner && person.status === 'eligible' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          Eligible
                        </span>
                      )}
                      {person.location && (
                        <span className="text-xs text-gray-400 truncate">{person.location}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
