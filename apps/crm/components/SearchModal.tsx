'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Application = {
  id: string
  company_name: string
  founder_names: string | null
  company_description: string | null
  stage: string
  submitted_at: string
}

type Investment = {
  id: string
  company_name: string
  founders: string | null
  description: string | null
  amount: number | null
  investment_date: string | null
}

type Company = {
  id: string
  name: string
  short_description: string | null
  logo_url: string | null
  industry: string | null
  city: string | null
  country: string | null
}

type Person = {
  id: string
  name: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  role: string
  status: string
  title: string | null
  location: string | null
  avatar_url: string | null
}

type SearchResults = {
  applications: Application[]
  investments: Investment[]
  companies: Company[]
  people: Person[]
}

type SearchItem = {
  type: 'application' | 'investment' | 'company' | 'person'
  id: string
  title: string
  subtitle: string | null
  badge: string
  badgeStyle: string
  href: string
  hash: string
  avatarUrl?: string | null
  logoUrl?: string | null
}

export default function SearchModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults>({ applications: [], investments: [], companies: [], people: [] })
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Flatten results for keyboard navigation
  const flatResults: SearchItem[] = [
    ...results.companies.map((company) => ({
      type: 'company' as const,
      id: company.id,
      title: company.name,
      subtitle: company.short_description,
      badge: company.industry || 'Company',
      badgeStyle: 'bg-blue-100 text-blue-700',
      href: `/companies/${company.id}`,
      hash: '',
      logoUrl: company.logo_url,
    })),
    ...results.people.map((person) => ({
      type: 'person' as const,
      id: person.id,
      title: getPersonDisplayName(person),
      subtitle: person.title || person.email,
      badge: getRoleLabel(person.role),
      badgeStyle: getRoleBadgeStyle(person.role),
      href: `/people/${person.id}`,
      hash: '',
      avatarUrl: person.avatar_url,
    })),
    ...results.applications.map((app) => ({
      type: 'application' as const,
      id: app.id,
      title: app.company_name,
      subtitle: formatFounderNames(app.founder_names),
      badge: app.stage,
      badgeStyle: getStageBadgeStyle(app.stage),
      href: '/deals',
      hash: `app-${app.id}`,
    })),
    ...results.investments.map((inv) => ({
      type: 'investment' as const,
      id: inv.id,
      title: inv.company_name,
      subtitle: inv.founders,
      badge: inv.amount ? formatCurrency(inv.amount) : 'Portfolio',
      badgeStyle: 'bg-emerald-100 text-emerald-700',
      href: '/portfolio',
      hash: `inv-${inv.id}`,
    })),
  ]

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults({ applications: [], investments: [], companies: [], people: [] })
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data)
          setSelectedIndex(0)
        }
      } catch (err) {
        console.error('Search failed:', err)
      }
      setLoading(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => Math.min(prev + 1, flatResults.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => Math.max(prev - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (flatResults[selectedIndex]) {
            navigateToResult(flatResults[selectedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    },
    [flatResults, selectedIndex, onClose]
  )

  const navigateToResult = (item: SearchItem) => {
    onClose()

    // For companies and people, navigate directly to the page
    if (item.type === 'company' || item.type === 'person') {
      router.push(item.href)
      return
    }

    // Navigate to the page with hash (for applications and investments)
    const targetUrl = `${item.href}#${item.hash}`
    router.push(targetUrl)

    // Scroll to element after a short delay (for page load)
    setTimeout(() => {
      const element = document.getElementById(item.hash)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Add a brief highlight effect
        element.classList.add('ring-2', 'ring-[#1a1a1a]', 'ring-offset-2')
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-[#1a1a1a]', 'ring-offset-2')
        }, 2000)
      }
    }, 100)
  }

  const hasResults = flatResults.length > 0
  const showNoResults = query.length >= 2 && !loading && !hasResults

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
          <svg
            className="w-5 h-5 text-gray-400 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search companies, founders, people..."
            className="flex-1 text-lg outline-none placeholder-gray-400"
          />
          {loading && (
            <svg className="animate-spin h-5 w-5 text-gray-400" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close search"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {query.length < 2 && (
            <div className="px-4 py-8 text-center text-gray-500">
              <p>Type at least 2 characters to search</p>
            </div>
          )}

          {showNoResults && (
            <div className="px-4 py-8 text-center text-gray-500">
              <p>No results found for "{query}"</p>
            </div>
          )}

          {hasResults && (
            <div className="py-2">
              {/* Companies Section */}
              {results.companies.length > 0 && (
                <div>
                  <div className="px-4 py-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Companies
                    </p>
                  </div>
                  {results.companies.map((company, idx) => {
                    const flatIdx = idx
                    const isSelected = selectedIndex === flatIdx
                    return (
                      <div
                        key={company.id}
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          navigateToResult({
                            type: 'company',
                            id: company.id,
                            title: company.name,
                            subtitle: company.short_description,
                            badge: company.industry || 'Company',
                            badgeStyle: 'bg-blue-100 text-blue-700',
                            href: `/companies/${company.id}`,
                            hash: '',
                            logoUrl: company.logo_url,
                          })
                        }
                        onMouseEnter={() => setSelectedIndex(flatIdx)}
                        className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors cursor-pointer ${
                          isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
                        }`}
                      >
                        {company.logo_url ? (
                          <img
                            src={company.logo_url}
                            alt={company.name}
                            className="w-10 h-10 rounded-lg object-contain bg-white border border-gray-100"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-blue-600 font-medium">
                              {company.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{company.name}</p>
                          {company.short_description && (
                            <p className="text-sm text-gray-500 truncate">{company.short_description}</p>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onClose()
                            router.push(`/companies/${company.id}#notes`)
                            setTimeout(() => {
                              const notesSection = document.getElementById('notes')
                              if (notesSection) {
                                notesSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
                              }
                            }, 300)
                          }}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                          title="View notes"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                        <span className="badge bg-blue-100 text-blue-700">
                          {company.industry || 'Company'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* People Section */}
              {results.people.length > 0 && (
                <div>
                  <div className="px-4 py-2 mt-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      People
                    </p>
                  </div>
                  {results.people.map((person, idx) => {
                    const flatIdx = results.companies.length + idx
                    const isSelected = selectedIndex === flatIdx
                    const fullName = getPersonDisplayName(person)
                    return (
                      <div
                        key={person.id}
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          navigateToResult({
                            type: 'person',
                            id: person.id,
                            title: fullName,
                            subtitle: person.title || person.email,
                            badge: getRoleLabel(person.role),
                            badgeStyle: getRoleBadgeStyle(person.role),
                            href: `/people/${person.id}`,
                            hash: '',
                            avatarUrl: person.avatar_url,
                          })
                        }
                        onMouseEnter={() => setSelectedIndex(flatIdx)}
                        className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors cursor-pointer ${
                          isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
                        }`}
                      >
                        {person.avatar_url ? (
                          <img
                            src={person.avatar_url}
                            alt={fullName}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-gray-600 font-medium">
                              {fullName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{fullName}</p>
                          {(person.title || person.email) && (
                            <p className="text-sm text-gray-500 truncate">{person.title || person.email}</p>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onClose()
                            router.push(`/people/${person.id}?notes=true`)
                          }}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                          title="View notes"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                        <span className={`badge ${getRoleBadgeStyle(person.role)}`}>
                          {getRoleLabel(person.role)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Applications Section */}
              {results.applications.length > 0 && (
                <div>
                  <div className="px-4 py-2 mt-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Applications
                    </p>
                  </div>
                  {results.applications.map((app, idx) => {
                    const flatIdx = results.companies.length + results.people.length + idx
                    const isSelected = selectedIndex === flatIdx
                    return (
                      <button
                        key={app.id}
                        onClick={() =>
                          navigateToResult({
                            type: 'application',
                            id: app.id,
                            title: app.company_name,
                            subtitle: app.founder_names,
                            badge: app.stage,
                            badgeStyle: getStageBadgeStyle(app.stage),
                            href: '/deals',
                            hash: `app-${app.id}`,
                          })
                        }
                        onMouseEnter={() => setSelectedIndex(flatIdx)}
                        className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                          isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-gray-600 font-medium">
                            {app.company_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{app.company_name}</p>
                          {app.founder_names && (
                            <p className="text-sm text-gray-500 truncate">{formatFounderNames(app.founder_names)}</p>
                          )}
                        </div>
                        <span className={`badge ${getStageBadgeStyle(app.stage)} capitalize`}>
                          {app.stage}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Investments Section */}
              {results.investments.length > 0 && (
                <div>
                  <div className="px-4 py-2 mt-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Portfolio
                    </p>
                  </div>
                  {results.investments.map((inv, idx) => {
                    const flatIdx = results.companies.length + results.people.length + results.applications.length + idx
                    const isSelected = selectedIndex === flatIdx
                    return (
                      <button
                        key={inv.id}
                        onClick={() =>
                          navigateToResult({
                            type: 'investment',
                            id: inv.id,
                            title: inv.company_name,
                            subtitle: inv.founders,
                            badge: inv.amount ? formatCurrency(inv.amount) : 'Portfolio',
                            badgeStyle: 'bg-emerald-100 text-emerald-700',
                            href: '/portfolio',
                            hash: `inv-${inv.id}`,
                          })
                        }
                        onMouseEnter={() => setSelectedIndex(flatIdx)}
                        className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                          isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-emerald-600 font-medium">
                            {inv.company_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{inv.company_name}</p>
                          {inv.founders && (
                            <p className="text-sm text-gray-500 truncate">{inv.founders}</p>
                          )}
                        </div>
                        <span className="badge bg-emerald-100 text-emerald-700">
                          {inv.amount ? formatCurrency(inv.amount) : 'Portfolio'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded">↓</kbd>
              <span className="ml-1">Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded">↵</kbd>
              <span className="ml-1">Open</span>
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-1 hover:text-gray-700 transition-colors"
          >
            <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded">esc</kbd>
            <span className="ml-1">Close</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function getStageBadgeStyle(stage: string): string {
  switch (stage) {
    case 'new':
      return 'bg-blue-100 text-blue-700'
    case 'voting':
      return 'bg-amber-100 text-amber-700'
    case 'deliberation':
      return 'bg-purple-100 text-purple-700'
    case 'invested':
      return 'bg-emerald-100 text-emerald-700'
    case 'rejected':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatFounderNames(names: string | null): string {
  if (!names) return ''
  // Handle both newline-separated and comma-separated names consistently
  return names
    .replace(/\r?\n/g, ', ')  // Convert newlines to commas first
    .split(/\s*,\s*/)          // Split on commas
    .filter(Boolean)           // Remove empty strings
    .join(' • ')               // Join with bullet separator
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    partner: 'Partner',
    founder: 'Founder',
    advisor: 'Advisor',
    employee: 'Employee',
    board_member: 'Board Member',
    investor: 'Investor',
    contact: 'Contact',
  }
  return labels[role] || role
}

function getRoleBadgeStyle(role: string): string {
  const styles: Record<string, string> = {
    partner: 'bg-blue-100 text-blue-800',
    founder: 'bg-purple-100 text-purple-800',
    advisor: 'bg-amber-100 text-amber-800',
    employee: 'bg-gray-100 text-gray-800',
    board_member: 'bg-emerald-100 text-emerald-800',
    investor: 'bg-indigo-100 text-indigo-800',
    contact: 'bg-slate-100 text-slate-800',
  }
  return styles[role] || 'bg-gray-100 text-gray-800'
}

function getPersonDisplayName(person: Person): string {
  if (person.first_name && person.last_name) {
    return `${person.first_name} ${person.last_name}`
  }
  return person.first_name || person.last_name || person.name || 'Unknown'
}
