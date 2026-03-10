'use client'

import { useState, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { BioMapPerson, BioMapOrganization, FocusTag } from './page'
import BioMapDetailModal from './BioMapDetailModal'
import CreateTicketButton from '@/components/CreateTicketButton'
import { createClient } from '@/lib/supabase/client'
import { useNetworkData, type GraphNode } from './components/hooks/useNetworkData'
import { useTreemapData, type TreemapMode } from './components/hooks/useTreemapData'

// Dynamically import visualization components to avoid SSR issues
const NetworkGraph = dynamic(() => import('./components/NetworkGraph'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[600px] bg-white rounded-lg border border-gray-200">
      <div className="text-gray-500">Loading network graph...</div>
    </div>
  ),
})

const FocusAreaTreemap = dynamic(() => import('./components/FocusAreaTreemap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[500px] bg-white rounded-lg border border-gray-200">
      <div className="text-gray-500">Loading treemap...</div>
    </div>
  ),
})

type ViewMode = 'people' | 'organizations' | 'network' | 'treemap'
type SortOption = 'name-az' | 'name-za' | 'date-newest'

const ROLE_COLORS: Record<string, string> = {
  partner: 'bg-blue-100 text-blue-800',
  founder: 'bg-purple-100 text-purple-800',
  advisor: 'bg-amber-100 text-amber-800',
  employee: 'bg-gray-100 text-gray-800',
  board_member: 'bg-emerald-100 text-emerald-800',
  investor: 'bg-indigo-100 text-indigo-800',
  contact: 'bg-slate-100 text-slate-800',
}

const ROLE_LABELS: Record<string, string> = {
  partner: 'Partner',
  founder: 'Founder',
  advisor: 'Advisor',
  employee: 'Employee',
  board_member: 'Board Member',
  investor: 'Investor',
  contact: 'Contact',
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  for_profit: 'For-Profit',
  pbc: 'Public Benefit Corp',
  nonprofit: 'Nonprofit',
  government: 'Government',
  other: 'Other',
}

export default function BioMapClient({
  people,
  organizations,
  bioTags,
  focusTags,
  userId,
}: {
  people: BioMapPerson[]
  organizations: BioMapOrganization[]
  bioTags: string[]
  focusTags: FocusTag[]
  userId: string
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('organizations')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [sortOption, setSortOption] = useState<SortOption>('name-az')
  const [selectedPerson, setSelectedPerson] = useState<BioMapPerson | null>(null)
  const [selectedOrganization, setSelectedOrganization] = useState<BioMapOrganization | null>(null)
  const [showAddOrgModal, setShowAddOrgModal] = useState(false)
  const [showAddPersonModal, setShowAddPersonModal] = useState(false)
  const [treemapMode, setTreemapMode] = useState<TreemapMode>('organizations')

  // Organization filters
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [focusFilter, setFocusFilter] = useState<string>('all')

  // People filters
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [orgFilter, setOrgFilter] = useState<string>('all')
  const [locationFilter, setLocationFilter] = useState<string>('all')

  // Get unique values for filter dropdowns
  const uniqueTypes = useMemo(() => {
    const types = new Set<string>()
    organizations.forEach(org => {
      if (org.entity_type) types.add(org.entity_type)
    })
    return Array.from(types).sort()
  }, [organizations])

  const uniqueRoles = useMemo(() => {
    const roles = new Set<string>()
    people.forEach(p => {
      if (p.role) roles.add(p.role)
    })
    return Array.from(roles).sort()
  }, [people])

  const uniqueOrgs = useMemo(() => {
    const orgs = new Set<string>()
    people.forEach(p => {
      p.company_associations.forEach(ca => {
        if (ca.company?.name) orgs.add(ca.company.name)
      })
    })
    return Array.from(orgs).sort()
  }, [people])

  const uniqueLocations = useMemo(() => {
    const locations = new Set<string>()
    people.forEach(p => {
      if (p.location) locations.add(p.location)
    })
    return Array.from(locations).sort()
  }, [people])

  // Filter people
  const filteredPeople = useMemo(() => {
    let filtered = people

    // Apply bio tag filter
    if (selectedTag !== 'all') {
      filtered = filtered.filter(p =>
        p.tags.some(t => t.toLowerCase() === selectedTag.toLowerCase())
      )
    }

    // Apply focus tag filter
    if (focusFilter !== 'all') {
      filtered = filtered.filter(p =>
        p.tags.some(t => t.toLowerCase() === focusFilter.toLowerCase())
      )
    }

    // Apply role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(p => p.role === roleFilter)
    }

    // Apply organization filter
    if (orgFilter !== 'all') {
      filtered = filtered.filter(p =>
        p.company_associations.some(ca => ca.company?.name === orgFilter)
      )
    }

    // Apply location filter
    if (locationFilter !== 'all') {
      filtered = filtered.filter(p => p.location === locationFilter)
    }

    // Apply search
    if (searchQuery.trim()) {
      const searchWords = searchQuery.toLowerCase().split(/\s+/).filter(w => w.length > 0)
      filtered = filtered.filter(person => {
        const searchableText = [
          person.displayName,
          person.email,
          person.title,
          person.bio,
          person.location,
          ...person.company_associations.map(ca => ca.company?.name),
          ...person.tags,
        ].filter(Boolean).join(' ').toLowerCase()

        return searchWords.every(word => searchableText.includes(word))
      })
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'name-az':
          return a.displayName.localeCompare(b.displayName)
        case 'name-za':
          return b.displayName.localeCompare(a.displayName)
        default:
          return 0
      }
    })

    return filtered
  }, [people, searchQuery, selectedTag, focusFilter, sortOption, roleFilter, orgFilter, locationFilter])

  // Filter organizations
  const filteredOrganizations = useMemo(() => {
    let filtered = organizations

    // Apply bio tag filter
    if (selectedTag !== 'all') {
      filtered = filtered.filter(o =>
        o.tags.some(t => t.toLowerCase() === selectedTag.toLowerCase())
      )
    }

    // Apply focus tag filter
    if (focusFilter !== 'all') {
      filtered = filtered.filter(o =>
        o.tags.some(t => t.toLowerCase() === focusFilter.toLowerCase())
      )
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(o => o.entity_type === typeFilter)
    }

    // Apply search
    if (searchQuery.trim()) {
      const searchWords = searchQuery.toLowerCase().split(/\s+/).filter(w => w.length > 0)
      filtered = filtered.filter(org => {
        const searchableText = [
          org.name,
          org.short_description,
          org.industry,
          org.city,
          org.country,
          ...org.contacts.map(f => f.name),
          ...org.tags,
        ].filter(Boolean).join(' ').toLowerCase()

        return searchWords.every(word => searchableText.includes(word))
      })
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'name-az':
          return a.name.localeCompare(b.name)
        case 'name-za':
          return b.name.localeCompare(a.name)
        default:
          return 0
      }
    })

    return filtered
  }, [organizations, searchQuery, selectedTag, sortOption, typeFilter, focusFilter])

  // Get primary company for a person
  const getPrimaryCompany = (person: BioMapPerson): string | null => {
    if (person.company_associations.length === 0) return null
    return person.company_associations[0].company?.name || null
  }

  // Get bio tags for a person/org (tags that contain 'bio')
  const getBioTags = (tags: string[]): string[] => {
    return tags.filter(t => t.toLowerCase().includes('bio'))
  }

  // Get focus tags for a person/org with their colors
  const focusTagNames = useMemo(() => focusTags.map(t => t.name.toLowerCase()), [focusTags])

  // Prepare data for visualizations
  const networkData = useNetworkData(filteredPeople, filteredOrganizations, focusTags)
  const treemapData = useTreemapData(filteredPeople, filteredOrganizations, focusTags, treemapMode)

  // Handle network node click
  const handleNetworkNodeClick = useCallback((node: GraphNode) => {
    if (node.type === 'person') {
      setSelectedPerson(node.entityData as BioMapPerson)
    } else {
      setSelectedOrganization(node.entityData as BioMapOrganization)
    }
  }, [])

  // Handle treemap segment click (filter by focus area)
  const handleTreemapSegmentClick = useCallback((focusArea: string) => {
    // Set the focus filter to the clicked area
    setFocusFilter(focusArea)
    // Switch to a list view to see filtered results
    setViewMode('organizations')
  }, [])

  // Handle treemap entity click
  const handleTreemapEntityClick = useCallback((entityType: 'person' | 'organization', entityId: string) => {
    if (entityType === 'person') {
      const person = people.find(p => p.id === entityId)
      if (person) setSelectedPerson(person)
    } else {
      const org = organizations.find(o => o.id === entityId)
      if (org) setSelectedOrganization(org)
    }
  }, [people, organizations])

  // Handle tag color change
  const handleTagColorChange = useCallback(async (tagName: string, newColor: string) => {
    const supabase = createClient()

    // Find the tag in focusTags to get its ID
    const tag = focusTags.find(t => t.name.toLowerCase() === tagName.toLowerCase())
    if (!tag) return

    // Update the color in the database
    const { error } = await supabase
      .from('tags')
      .update({ color: newColor })
      .eq('id', tag.id)

    if (!error) {
      // Refresh the page to get updated colors
      window.location.reload()
    }
  }, [focusTags])

  const getFocusTags = (tags: string[]): { name: string; color: string }[] => {
    return tags
      .filter(t => focusTagNames.includes(t.toLowerCase()))
      .map(t => {
        const focusTag = focusTags.find(ft => ft.name.toLowerCase() === t.toLowerCase())
        return {
          name: t,
          color: focusTag?.color || '#6B7280',
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bio-Map</h1>
          <p className="mt-1 text-gray-500">
            Track organizations and people in the bio-safety space
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <CreateTicketButton currentUserId={userId} />
          <button
            onClick={() => viewMode === 'organizations' ? setShowAddOrgModal(true) : setShowAddPersonModal(true)}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add {viewMode === 'organizations' ? 'Organization' : 'Person'}
          </button>
        </div>
      </div>

      {/* Search, Sort, View Mode and Tag Filters */}
      <div className="bg-white rounded-xl rounded-b-none shadow-sm border border-gray-100 border-b-0 p-4">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg flex-wrap">
            <button
              onClick={() => setViewMode('organizations')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === 'organizations'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Organizations ({filteredOrganizations.length})
            </button>
            <button
              onClick={() => setViewMode('people')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === 'people'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              People ({filteredPeople.length})
            </button>
            <button
              onClick={() => setViewMode('network')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                viewMode === 'network'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Network
            </button>
            <button
              onClick={() => setViewMode('treemap')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                viewMode === 'treemap'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
              Treemap
            </button>
          </div>
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={viewMode === 'organizations' ? 'Search organizations...' : 'Search people...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input !pl-11"
            />
          </div>
          <div className="sm:w-44">
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="input"
            >
              <option value="name-az">Name (A-Z)</option>
              <option value="name-za">Name (Z-A)</option>
            </select>
          </div>
        </div>

        {/* Filter dropdowns - different for organizations vs people */}
        <div className="flex flex-wrap gap-3">
          {viewMode === 'organizations' ? (
            // Organization filters
            <>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-gray-900 focus:border-gray-900"
              >
                <option value="all">All Types</option>
                {uniqueTypes.map(type => (
                  <option key={type} value={type}>
                    {ENTITY_TYPE_LABELS[type] || type}
                  </option>
                ))}
              </select>
              {focusTags.length > 0 && (
                <select
                  value={focusFilter}
                  onChange={(e) => setFocusFilter(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                >
                  <option value="all">All Focus</option>
                  {focusTags.map(tag => (
                    <option key={tag.id} value={tag.name}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              )}
              {bioTags.length > 0 && (
                <select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                >
                  <option value="all">All Bio Tags</option>
                  {bioTags.map(tag => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              )}
            </>
          ) : (
            // People filters
            <>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-gray-900 focus:border-gray-900"
              >
                <option value="all">All Roles</option>
                {uniqueRoles.map(role => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role] || role}
                  </option>
                ))}
              </select>
              <select
                value={orgFilter}
                onChange={(e) => setOrgFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-gray-900 focus:border-gray-900 max-w-[180px] truncate"
              >
                <option value="all">All Organizations</option>
                {uniqueOrgs.map(org => (
                  <option key={org} value={org}>
                    {org}
                  </option>
                ))}
              </select>
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-gray-900 focus:border-gray-900"
              >
                <option value="all">All Locations</option>
                {uniqueLocations.map(loc => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
              {focusTags.length > 0 && (
                <select
                  value={focusFilter}
                  onChange={(e) => setFocusFilter(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                >
                  <option value="all">All Focus</option>
                  {focusTags.map(tag => (
                    <option key={tag.id} value={tag.name}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              )}
              {bioTags.length > 0 && (
                <select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                >
                  <option value="all">All Bio Tags</option>
                  {bioTags.map(tag => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {viewMode === 'network' ? (
        /* Network Graph View */
        <div className="mt-4 relative">
          <NetworkGraph
            data={networkData}
            focusTags={focusTags}
            onNodeClick={handleNetworkNodeClick}
            height={600}
          />
        </div>
      ) : viewMode === 'treemap' ? (
        /* Treemap View */
        <div className="mt-4">
          <FocusAreaTreemap
            data={treemapData}
            mode={treemapMode}
            onModeChange={setTreemapMode}
            onSegmentClick={handleTreemapSegmentClick}
            onEntityClick={handleTreemapEntityClick}
            onTagColorChange={handleTagColorChange}
            height={500}
          />
        </div>
      ) : viewMode === 'organizations' ? (
        /* Organizations Table */
        filteredOrganizations.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl rounded-t-none shadow-sm border border-gray-100">
            <span className="text-4xl mb-4 block">🧬</span>
            <p className="text-gray-500">No organizations found with bio-related tags</p>
            <p className="text-sm text-gray-400 mt-2">Add bio-related tags to organizations to see them here</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl rounded-t-none shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Organization</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Type</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 hidden md:table-cell">Focus</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 hidden lg:table-cell">Description</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 hidden md:table-cell">Contact</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 hidden lg:table-cell">Contact Info</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredOrganizations.map(org => (
                    <tr
                      key={org.id}
                      onClick={() => setSelectedOrganization(org)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{org.name}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {org.entity_type ? (ENTITY_TYPE_LABELS[org.entity_type] || org.entity_type) : '-'}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {getFocusTags(org.tags).map(tag => (
                            <span
                              key={tag.name}
                              className="px-2 py-0.5 text-xs rounded-full text-white"
                              style={{ backgroundColor: tag.color }}
                            >
                              {tag.name}
                            </span>
                          ))}
                          {getFocusTags(org.tags).length === 0 && <span className="text-sm text-gray-400">-</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-sm text-gray-600 max-w-xs">
                        {org.short_description ? (
                          <span className="line-clamp-2">{org.short_description}</span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-sm text-gray-600">
                        {org.contacts.length > 0 ? org.contacts.map(f => f.name).join(', ') : '-'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-sm text-gray-500">
                        {org.contacts.length > 0 && org.contacts[0].email ? (
                          <a
                            href={`mailto:${org.contacts[0].email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-600 hover:underline"
                          >
                            {org.contacts[0].email}
                          </a>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* People Table */
        filteredPeople.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl rounded-t-none shadow-sm border border-gray-100">
            <span className="text-4xl mb-4 block">👥</span>
            <p className="text-gray-500">No people found with bio-related tags</p>
            <p className="text-sm text-gray-400 mt-2">Add bio-related tags to people to see them here</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl rounded-t-none shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">Name</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-600 hidden md:table-cell">Role</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-600 hidden lg:table-cell">Organization</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-600 hidden lg:table-cell">Location</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">Tags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPeople.map(person => (
                    <tr
                      key={person.id}
                      onClick={() => setSelectedPerson(person)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#1a1a1a] rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-sm font-medium">
                              {person.displayName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{person.displayName}</div>
                            {person.title && (
                              <div className="text-sm text-gray-500">{person.title}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${ROLE_COLORS[person.role] || 'bg-gray-100 text-gray-800'}`}>
                          {ROLE_LABELS[person.role] || person.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell text-sm text-gray-600">
                        {getPrimaryCompany(person) || '-'}
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell text-sm text-gray-500">
                        {person.location || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {getFocusTags(person.tags).slice(0, 2).map(tag => (
                            <span
                              key={tag.name}
                              className="px-2 py-0.5 text-xs rounded-full text-white"
                              style={{ backgroundColor: tag.color }}
                            >
                              {tag.name}
                            </span>
                          ))}
                          {getFocusTags(person.tags).length > 2 && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                              +{getFocusTags(person.tags).length - 2}
                            </span>
                          )}
                          {getFocusTags(person.tags).length === 0 && getBioTags(person.tags).slice(0, 2).map(tag => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Detail Modal */}
      {(selectedOrganization || selectedPerson) && (
        <BioMapDetailModal
          organization={selectedOrganization}
          person={selectedPerson}
          focusTags={focusTags}
          userId={userId}
          onClose={() => {
            setSelectedOrganization(null)
            setSelectedPerson(null)
          }}
          onUpdate={() => {
            // Refresh the page to get updated data
            window.location.reload()
          }}
        />
      )}

      {/* Add Organization Modal */}
      {showAddOrgModal && (
        <AddOrganizationModal
          onClose={() => setShowAddOrgModal(false)}
          onSuccess={() => {
            setShowAddOrgModal(false)
            window.location.reload()
          }}
        />
      )}

      {/* Add Person Modal */}
      {showAddPersonModal && (
        <AddPersonModal
          onClose={() => setShowAddPersonModal(false)}
          onSuccess={() => {
            setShowAddPersonModal(false)
            window.location.reload()
          }}
        />
      )}
    </div>
  )
}

// Add Organization Modal Component
function AddOrganizationModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState('')
  const [entityType, setEntityType] = useState('')
  const [description, setDescription] = useState('')
  const [website, setWebsite] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Organization name is required')
      return
    }

    setSaving(true)
    setError(null)

    const supabase = createClient()
    const { error: insertError } = await supabase
      .from('companies')
      .insert({
        name: name.trim(),
        entity_type: entityType || null,
        short_description: description.trim() || null,
        website: website.trim() || null,
        tags: ['bio'],
        is_active: true,
        stage: 'tracked',
      })

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
    } else {
      onSuccess()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Add Organization</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder="Organization name"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            >
              <option value="">Select type...</option>
              <option value="for_profit">For-Profit</option>
              <option value="nonprofit">Nonprofit</option>
              <option value="government">Government</option>
              <option value="pbc">Public Benefit Corp</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
              placeholder="Brief description..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Website
            </label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder="https://..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add Organization'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Add Person Modal Component
function AddPersonModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [title, setTitle] = useState('')
  const [bio, setBio] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName.trim()) {
      setError('First name is required')
      return
    }

    setSaving(true)
    setError(null)

    const supabase = createClient()
    const { error: insertError } = await supabase
      .from('people')
      .insert({
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        email: email.trim() || null,
        title: title.trim() || null,
        bio: bio.trim() || null,
        linkedin_url: linkedinUrl.trim() || null,
        location: location.trim() || null,
        tags: ['bio'],
        role: 'contact',
        status: 'tracked',
      })

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
    } else {
      onSuccess()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">Add Person</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                placeholder="First name"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                placeholder="Last name"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder="Job title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
              placeholder="Brief bio..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              LinkedIn URL
            </label>
            <input
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder="https://linkedin.com/in/..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder="City, Country"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add Person'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
