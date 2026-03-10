'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Database, CompanyStage } from '@/lib/types/database'
import PersonModal from '@/components/PersonModal'
import CreateTicketButton from '@/components/CreateTicketButton'
import { ensureProtocol } from '@/lib/utils'

type Company = Database['public']['Tables']['companies']['Row'] & {
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
}

interface CompanyGridProps {
  companies: Company[]
  isPartner?: boolean
  userId?: string
}

const STAGE_OPTIONS = ['prospect', 'portfolio', 'diligence', 'passed', 'tracked', 'archived'] as const

export default function CompanyGrid({ companies, isPartner = false, userId }: CompanyGridProps) {
  const router = useRouter()
  const supabase = createClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [stageFilter, setStageFilter] = useState<string>(() => {
    // Initialize from localStorage if available (client-side only)
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('companies-stage-filter')
      if (saved && (saved === 'all' || STAGE_OPTIONS.includes(saved as any))) {
        return saved
      }
    }
    return 'all'
  })
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)

  // Persist stage filter to localStorage
  useEffect(() => {
    localStorage.setItem('companies-stage-filter', stageFilter)
  }, [stageFilter])

  // Add Company Modal State
  const [showAddModal, setShowAddModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newCompany, setNewCompany] = useState({
    name: '',
    short_description: '',
    website: '',
    industry: '',
    city: '',
    country: '',
    founded_year: '',
    yc_batch: '',
    stage: 'prospect' as CompanyStage,
  })

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const { data, error: insertError } = await supabase
        .from('companies')
        .insert({
          name: newCompany.name,
          short_description: newCompany.short_description || null,
          website: newCompany.website || null,
          industry: newCompany.industry || null,
          city: newCompany.city || null,
          country: newCompany.country || null,
          founded_year: newCompany.founded_year ? parseInt(newCompany.founded_year) : null,
          yc_batch: newCompany.yc_batch || null,
          stage: newCompany.stage,
          is_active: true,
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Reset form and close modal
      setShowAddModal(false)
      setNewCompany({
        name: '',
        short_description: '',
        website: '',
        industry: '',
        city: '',
        country: '',
        founded_year: '',
        yc_batch: '',
        stage: 'prospect' as CompanyStage,
      })

      // Navigate to the new company's page
      if (data?.id) {
        router.push(`/companies/${data.id}`)
      } else {
        router.refresh()
      }
    } catch (err: any) {
      console.error('Error creating company:', err)
      setError(err?.message || 'Failed to create company')
    } finally {
      setSaving(false)
    }
  }

  // Calculate stage counts for the summary pills
  const stageCounts: Record<string, number> = {}
  for (const company of companies) {
    const stage = company.stage || 'unknown'
    stageCounts[stage] = (stageCounts[stage] || 0) + 1
  }

  // Define stage display order and colors
  // Using inline styles for active state to avoid Tailwind purging issues
  const stageConfig: Record<string, { label: string; bgColor: string; textColor: string; activeBg: string }> = {
    portfolio: { label: 'Portfolio', bgColor: '#dcfce7', textColor: '#166534', activeBg: '#16a34a' },
    prospect: { label: 'Prospect', bgColor: '#dbeafe', textColor: '#1e40af', activeBg: '#2563eb' },
    diligence: { label: 'Diligence', bgColor: '#fef3c7', textColor: '#92400e', activeBg: '#d97706' },
    passed: { label: 'Passed', bgColor: '#f3f4f6', textColor: '#4b5563', activeBg: '#4b5563' },
    tracked: { label: 'Tracked', bgColor: '#f3e8ff', textColor: '#7e22ce', activeBg: '#9333ea' },
    archived: { label: 'Archived', bgColor: '#f3f4f6', textColor: '#6b7280', activeBg: '#6b7280' },
  }

  // Filter companies based on search and stage
  const filteredCompanies = companies
    .filter((company) => {
      // Stage filter
      if (stageFilter !== 'all' && company.stage !== stageFilter) {
        return false
      }

      // Search filter
      if (!searchQuery.trim()) return true

      const query = searchQuery.toLowerCase()
      const nameMatch = company.name.toLowerCase().includes(query)
      const descriptionMatch = company.short_description?.toLowerCase().includes(query)
      const industryMatch = company.industry?.toLowerCase().includes(query)
      const cityMatch = company.city?.toLowerCase().includes(query)
      const tagsMatch = company.tags?.some(tag => tag.toLowerCase().includes(query))

      return nameMatch || descriptionMatch || industryMatch || cityMatch || tagsMatch
    })
    .sort((a, b) => {
      const comparison = a.name.localeCompare(b.name)
      return sortOrder === 'asc' ? comparison : -comparison
    })

  return (
    <div>
      {/* Header with count (Partners Only) */}
      {isPartner && (
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-gray-900">All Companies</h1>
            <span className="text-lg text-gray-400 font-medium">
              {filteredCompanies.length === companies.length
                ? companies.length
                : `${filteredCompanies.length}/${companies.length}`}
            </span>
          </div>
          {userId && <CreateTicketButton currentUserId={userId} />}
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search companies by name, industry, or location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
        />
      </div>

      {/* Stage Filters, Sort, and Actions - All in one row */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {/* Stage Count Pills (Partners Only) */}
        {isPartner && (
          <>
            {/* All button */}
            <button
              onClick={() => setStageFilter('all')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                stageFilter === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({companies.length})
            </button>
            {/* Stage pills - always show all stages that exist in the full company list */}
            {['portfolio', 'prospect', 'diligence', 'passed', 'tracked', 'archived'].map((stage) => {
              const count = stageCounts[stage] || 0
              if (count === 0) return null
              const config = stageConfig[stage]
              const isActive = stageFilter === stage
              return (
                <button
                  key={`stage-pill-${stage}`}
                  type="button"
                  onClick={() => setStageFilter(isActive ? 'all' : stage)}
                  style={{
                    backgroundColor: isActive ? config.activeBg : config.bgColor,
                    color: isActive ? '#ffffff' : config.textColor,
                  }}
                  className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                >
                  {config.label} ({count})
                </button>
              )
            })}
          </>
        )}

        {/* Sort Order and Add Button - pushed to right */}
        <div className="ml-auto flex items-center gap-3">
          <select
            id="sort-order"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
            className="px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
          >
            <option value="asc">A-Z</option>
            <option value="desc">Z-A</option>
          </select>
          {isPartner && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800"
            >
              + Add Company
            </button>
          )}
        </div>
      </div>

      {/* Company Grid */}
      {filteredCompanies.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No companies match your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCompanies.map((company) => {
            // Get current founders for this company (exclude former founders)
            const founders = company.people?.filter(
              (p) => p.relationship_type?.toLowerCase() === 'founder' && p.person && !p.end_date
            ) || []

            return (
              <div
                key={company.id}
                onClick={() => router.push(`/companies/${company.id}`)}
                className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition hover:shadow-md cursor-pointer relative"
              >
                {/* Stage Badge - top right */}
                {isPartner && company.stage && (
                  <span className={`absolute top-2 right-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                    company.stage === 'portfolio' ? 'bg-green-100 text-green-800' :
                    company.stage === 'prospect' ? 'bg-blue-100 text-blue-800' :
                    company.stage === 'passed' ? 'bg-gray-100 text-gray-600' :
                    company.stage === 'dead' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {company.stage}
                  </span>
                )}

                {/* Logo and Company Info */}
                <div className="flex items-start space-x-3">
                  {/* Company Logo */}
                  {company.logo_url ? (
                    <img
                      src={company.logo_url}
                      alt={company.name}
                      className="h-12 w-12 object-contain flex-shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-gray-400">
                        {company.name[0]}
                      </span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0 pr-12">
                    {/* Company Name - links to website if available */}
                    {company.website ? (
                      <a
                        href={ensureProtocol(company.website)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-base font-semibold text-gray-900 hover:underline truncate block"
                      >
                        {company.name}
                      </a>
                    ) : (
                      <h3 className="text-base font-semibold text-gray-900 truncate">
                        {company.name}
                      </h3>
                    )}

                    {/* Description */}
                    {company.short_description && (
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {company.short_description}
                      </p>
                    )}

                    {/* Compact Info Line */}
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                      {company.industry && <span>{company.industry}</span>}
                      {company.industry && (company.city || company.yc_batch) && <span>•</span>}
                      {company.city && <span>{company.city}</span>}
                      {company.city && company.yc_batch && <span>•</span>}
                      {company.yc_batch && <span>YC {company.yc_batch}</span>}
                    </div>
                  </div>
                </div>

                {/* Founders - comma separated names */}
                {founders.length > 0 && (
                  <div className="mt-2 text-xs text-gray-500">
                    <span>{founders.length === 1 ? 'Founder: ' : 'Founders: '}</span>
                    {founders.map((founder, idx) => {
                      const person = founder.person
                      if (!person) return null
                      return (
                        <span key={person.id}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedPersonId(person.id)
                            }}
                            className="text-gray-700 hover:underline"
                          >
                            {person.first_name} {person.last_name}
                          </button>
                          {idx < founders.length - 1 && ', '}
                        </span>
                      )
                    })}
                  </div>
                )}

                {/* Investment Summary (Partners Only) - compact */}
                {isPartner && company.investments && company.investments.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2 text-xs">
                    <span className="text-gray-500">Investment:</span>
                    <span className="font-semibold text-gray-900">
                      ${company.investments.reduce((sum, inv) => sum + (inv.amount || 0), 0).toLocaleString()}
                    </span>
                    {company.investments[0]?.round && (
                      <span className="text-gray-500">• {company.investments[0].round}</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add Company Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Add New Company</h2>
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setError(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <form onSubmit={handleCreateCompany} className="space-y-4">
                <div>
                  <label htmlFor="company-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name *
                  </label>
                  <input
                    id="company-name"
                    type="text"
                    required
                    value={newCompany.name}
                    onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                    placeholder="Acme Inc"
                  />
                </div>

                <div>
                  <label htmlFor="company-stage" className="block text-sm font-medium text-gray-700 mb-1">
                    Stage *
                  </label>
                  <select
                    id="company-stage"
                    required
                    value={newCompany.stage || ''}
                    onChange={(e) => setNewCompany({ ...newCompany, stage: e.target.value as CompanyStage })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                  >
                    {STAGE_OPTIONS.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage.charAt(0).toUpperCase() + stage.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="company-description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    id="company-description"
                    rows={3}
                    value={newCompany.short_description}
                    onChange={(e) => setNewCompany({ ...newCompany, short_description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                    placeholder="Brief description of what the company does..."
                  />
                </div>

                <div>
                  <label htmlFor="company-website" className="block text-sm font-medium text-gray-700 mb-1">
                    Website
                  </label>
                  <input
                    id="company-website"
                    type="url"
                    value={newCompany.website}
                    onChange={(e) => setNewCompany({ ...newCompany, website: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                    placeholder="https://example.com"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="company-industry" className="block text-sm font-medium text-gray-700 mb-1">
                      Industry
                    </label>
                    <input
                      id="company-industry"
                      type="text"
                      value={newCompany.industry}
                      onChange={(e) => setNewCompany({ ...newCompany, industry: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                      placeholder="AI/ML"
                    />
                  </div>
                  <div>
                    <label htmlFor="company-founded" className="block text-sm font-medium text-gray-700 mb-1">
                      Founded Year
                    </label>
                    <input
                      id="company-founded"
                      type="number"
                      min="1900"
                      max="2100"
                      value={newCompany.founded_year}
                      onChange={(e) => setNewCompany({ ...newCompany, founded_year: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                      placeholder="2024"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="company-city" className="block text-sm font-medium text-gray-700 mb-1">
                      City
                    </label>
                    <input
                      id="company-city"
                      type="text"
                      value={newCompany.city}
                      onChange={(e) => setNewCompany({ ...newCompany, city: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                      placeholder="San Francisco"
                    />
                  </div>
                  <div>
                    <label htmlFor="company-country" className="block text-sm font-medium text-gray-700 mb-1">
                      Country
                    </label>
                    <input
                      id="company-country"
                      type="text"
                      value={newCompany.country}
                      onChange={(e) => setNewCompany({ ...newCompany, country: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                      placeholder="United States"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="company-yc" className="block text-sm font-medium text-gray-700 mb-1">
                    YC Batch
                  </label>
                  <input
                    id="company-yc"
                    type="text"
                    value={newCompany.yc_batch}
                    onChange={(e) => setNewCompany({ ...newCompany, yc_batch: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                    placeholder="S24, W25, etc."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false)
                      setError(null)
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Creating...' : 'Create Company'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Person Modal */}
      {selectedPersonId && (
        <PersonModal
          personId={selectedPersonId}
          onClose={() => setSelectedPersonId(null)}
        />
      )}
    </div>
  )
}
