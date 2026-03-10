'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import TagSelector from '@/app/tickets/TagSelector'
import type { UserRole, UserStatus, RelationshipType } from '@vcrm/supabase'

interface AddPersonToCompanyModalProps {
  companyId: string
  companyName: string
  existingPeopleIds: string[]
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  currentUserId: string
}

type Person = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  role: string
  status: string | null
  title: string | null
  avatar_url: string | null
}

const RELATIONSHIP_TYPES = [
  { value: 'founder', label: 'Founder' },
  { value: 'employee', label: 'Employee' },
  { value: 'advisor', label: 'Advisor' },
  { value: 'board_member', label: 'Board Member' },
  { value: 'partner', label: 'Partner' },
]

const ROLE_LABELS: Record<string, string> = {
  partner: 'Partner',
  founder: 'Founder',
  advisor: 'Advisor',
  employee: 'Employee',
  board_member: 'Board Member',
  investor: 'Investor',
  contact: 'Contact',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  eligible: 'Eligible',
  tracked: 'Tracked',
  inactive: 'Inactive',
}

const ROLE_COLORS: Record<string, string> = {
  partner: 'bg-blue-100 text-blue-800',
  founder: 'bg-purple-100 text-purple-800',
  advisor: 'bg-amber-100 text-amber-800',
  employee: 'bg-gray-100 text-gray-800',
  board_member: 'bg-emerald-100 text-emerald-800',
  investor: 'bg-indigo-100 text-indigo-800',
  contact: 'bg-slate-100 text-slate-800',
}

export default function AddPersonToCompanyModal({
  companyId,
  companyName,
  existingPeopleIds,
  isOpen,
  onClose,
  onSuccess,
  currentUserId,
}: AddPersonToCompanyModalProps) {
  const router = useRouter()
  const supabase = createClient()

  // Tab state
  const [activeTab, setActiveTab] = useState<'search' | 'create'>('search')

  // Common fields for both tabs
  const [relationshipType, setRelationshipType] = useState<string>('employee')
  const [titleAtCompany, setTitleAtCompany] = useState('')

  // Search existing person state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Person[]>([])
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Create new person state
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    mobile_phone: '',
    role: 'contact' as UserRole,
    status: 'tracked' as UserStatus,
    title: '',
    bio: '',
    location: '',
    linkedin_url: '',
    twitter_url: '',
    first_met_date: '',
    introduced_by: '',
    introduction_context: '',
    relationship_notes: '',
  })
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  // All people (for introduced_by dropdown and duplicate check)
  const [allPeople, setAllPeople] = useState<Person[]>([])

  // Duplicate detection
  const [potentialDuplicates, setPotentialDuplicates] = useState<Person[]>([])
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)

  // Loading states
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Fetch all people for introduced_by dropdown and duplicate check
  useEffect(() => {
    if (isOpen) {
      fetchAllPeople()
    }
  }, [isOpen])

  // Debounced search
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([])
      return
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchPeople(searchQuery)
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery])

  const fetchAllPeople = async () => {
    const { data } = await supabase
      .from('people')
      .select('id, first_name, last_name, email, role, status, title, avatar_url')
      .order('first_name')

    if (data) {
      setAllPeople(data)
    }
  }

  const searchPeople = async (query: string) => {
    setIsSearching(true)

    // Search by name or email
    const { data } = await supabase
      .from('people')
      .select('id, first_name, last_name, email, role, status, title, avatar_url')
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(20)

    if (data) {
      // Filter out people already linked to this company
      const filtered = data.filter(p => !existingPeopleIds.includes(p.id))
      setSearchResults(filtered)
    }

    setIsSearching(false)
  }

  // Duplicate detection algorithm (ported from PeopleClient.tsx)
  const checkForDuplicates = (firstName: string, lastName: string, email: string | null): Person[] => {
    const fullName = `${firstName} ${lastName}`.toLowerCase().trim()
    const nameWords = fullName.split(/\s+/).filter(w => w.length > 0)

    return allPeople.filter(person => {
      // Check for exact email match
      if (email) {
        const emailLower = email.toLowerCase()
        if (person.email && emailLower === person.email.toLowerCase()) {
          return true
        }
      }

      // Check for similar names
      const personName = `${person.first_name || ''} ${person.last_name || ''}`.toLowerCase().trim()
      const personWords = personName.split(/\s+/).filter(w => w.length > 0)

      // Exact full name match
      if (personName === fullName) {
        return true
      }

      // Check for exact first name match
      const newFirstName = nameWords[0]
      const existingFirstName = personWords[0]
      if (newFirstName && existingFirstName && newFirstName === existingFirstName) {
        const newLastName = nameWords[1]
        const existingLastName = personWords[1]

        // Same first name, similar or missing last names
        if (!newLastName || !existingLastName || newLastName === existingLastName) {
          return true
        }
        // Check if last names start the same
        if (newLastName.length >= 3 && existingLastName.length >= 3) {
          if (newLastName.startsWith(existingLastName) || existingLastName.startsWith(newLastName)) {
            return true
          }
        }
      }

      return false
    })
  }

  const handleLinkExistingPerson = async () => {
    if (!selectedPerson) return

    setLoading(true)
    setError(null)

    try {
      // Check for soft-deleted relationship
      const { data: existing } = await supabase
        .from('company_people')
        .select('id, end_date')
        .eq('company_id', companyId)
        .eq('user_id', selectedPerson.id)
        .eq('relationship_type', relationshipType)
        .maybeSingle()

      if (existing?.end_date) {
        // Reactivate soft-deleted relationship
        const { error: updateError } = await supabase
          .from('company_people')
          .update({ end_date: null, title: titleAtCompany || null })
          .eq('id', existing.id)

        if (updateError) throw updateError
      } else if (!existing) {
        // Create new link
        const { error: insertError } = await supabase
          .from('company_people')
          .insert({
            company_id: companyId,
            user_id: selectedPerson.id,
            relationship_type: relationshipType as RelationshipType,
            title: titleAtCompany || null,
            is_primary_contact: false,
          })

        if (insertError) throw insertError
      } else {
        // Relationship already exists
        setError('This person already has this relationship with the company.')
        setLoading(false)
        return
      }

      // Update role and status when adding as founder
      if (relationshipType === 'founder') {
        const updates: Record<string, string> = {}
        if (selectedPerson.role !== 'founder' && selectedPerson.role !== 'partner') {
          updates.role = 'founder'
        }
        // Founders are automatically eligible for community signup
        // (don't downgrade 'active' people)
        if (selectedPerson.status === 'tracked') {
          updates.status = 'eligible'
        }
        if (Object.keys(updates).length > 0) {
          await supabase
            .from('people')
            .update(updates)
            .eq('id', selectedPerson.id)
        }
      }

      setSuccess(`${selectedPerson.first_name} ${selectedPerson.last_name} added to ${companyName}`)
      setTimeout(() => {
        onSuccess()
      }, 1000)
    } catch (err: any) {
      setError(err?.message || 'Failed to link person to company')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateNewPerson = async (skipDuplicateCheck = false) => {
    if (!formData.first_name.trim()) {
      setError('First name is required')
      return
    }

    // Check for duplicates
    if (!skipDuplicateCheck) {
      const duplicates = checkForDuplicates(
        formData.first_name,
        formData.last_name,
        formData.email || null
      )
      if (duplicates.length > 0) {
        setPotentialDuplicates(duplicates)
        setShowDuplicateWarning(true)
        return
      }
    }

    setLoading(true)
    setError(null)

    try {
      // 1. Create the person
      // Founders are automatically eligible for community signup
      const effectiveStatus = relationshipType === 'founder' ? 'eligible' as UserStatus : formData.status
      const { data: newPerson, error: createError } = await supabase
        .from('people')
        .insert({
          first_name: formData.first_name || null,
          last_name: formData.last_name || null,
          email: formData.email || null,
          mobile_phone: formData.mobile_phone || null,
          role: relationshipType === 'founder' ? 'founder' : formData.role,
          status: effectiveStatus,
          title: formData.title || null,
          bio: formData.bio || null,
          location: formData.location || null,
          linkedin_url: formData.linkedin_url || null,
          twitter_url: formData.twitter_url || null,
          first_met_date: formData.first_met_date || null,
          introduced_by: formData.introduced_by || null,
          introduction_context: formData.introduction_context || null,
          relationship_notes: formData.relationship_notes || null,
          tags: selectedTags.length > 0 ? selectedTags : null,
        })
        .select('id')
        .single()

      if (createError) throw createError

      // 2. Link to company
      const { error: linkError } = await supabase
        .from('company_people')
        .insert({
          company_id: companyId,
          user_id: newPerson.id,
          relationship_type: relationshipType as RelationshipType,
          title: titleAtCompany || formData.title || null,
          is_primary_contact: false,
        })

      if (linkError) throw linkError

      const fullName = `${formData.first_name} ${formData.last_name}`.trim()
      setSuccess(`${fullName} created and added to ${companyName}`)
      setTimeout(() => {
        onSuccess()
      }, 1000)
    } catch (err: any) {
      setError(err?.message || 'Failed to create person')
    } finally {
      setLoading(false)
    }
  }

  const handleProceedWithDuplicate = () => {
    setShowDuplicateWarning(false)
    handleCreateNewPerson(true)
  }

  const resetForm = () => {
    setActiveTab('search')
    setRelationshipType('employee')
    setTitleAtCompany('')
    setSearchQuery('')
    setSearchResults([])
    setSelectedPerson(null)
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      mobile_phone: '',
      role: 'contact',
      status: 'tracked',
      title: '',
      bio: '',
      location: '',
      linkedin_url: '',
      twitter_url: '',
      first_met_date: '',
      introduced_by: '',
      introduction_context: '',
      relationship_notes: '',
    })
    setSelectedTags([])
    setPotentialDuplicates([])
    setShowDuplicateWarning(false)
    setError(null)
    setSuccess(null)
  }

  const handleClose = () => {
    if (!loading) {
      resetForm()
      onClose()
    }
  }

  const getDisplayName = (person: Person) => {
    return `${person.first_name || ''} ${person.last_name || ''}`.trim() || person.email || 'Unknown'
  }

  if (!isOpen) return null

  return (
    <>
      {/* Modal Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={handleClose} />

      {/* Modal Content */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Add Person to {companyName}</h2>
              <p className="text-sm text-gray-500 mt-0.5">Link an existing person or create a new one</p>
            </div>
            <button
              onClick={handleClose}
              disabled={loading}
              className="text-gray-400 hover:text-gray-600 p-2 -m-2"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
          {success && (
            <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          {/* Tabs */}
          <div className="px-6 pt-4 flex-shrink-0">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('search')}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                  activeTab === 'search'
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Search Existing
              </button>
              <button
                onClick={() => setActiveTab('create')}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                  activeTab === 'create'
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Create New
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* Common Fields - Relationship Type & Title */}
            <div className="grid grid-cols-2 gap-4 mb-6 pb-4 border-b border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Relationship Type *
                </label>
                <select
                  value={relationshipType}
                  onChange={(e) => setRelationshipType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                >
                  {RELATIONSHIP_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title at Company
                </label>
                <input
                  type="text"
                  value={titleAtCompany}
                  onChange={(e) => setTitleAtCompany(e.target.value)}
                  placeholder="e.g. Co-Founder & CEO"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                />
              </div>
            </div>

            {/* Tab Content: Search Existing */}
            {activeTab === 'search' && (
              <div className="space-y-4">
                {/* Search Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Search by name or email
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value)
                        setSelectedPerson(null)
                      }}
                      placeholder="Start typing to search..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                    />
                    {isSearching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <svg className="animate-spin h-4 w-4 text-gray-400" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && !selectedPerson && (
                  <div className="border border-gray-200 rounded-md divide-y divide-gray-100 max-h-60 overflow-y-auto">
                    {searchResults.map(person => (
                      <button
                        key={person.id}
                        onClick={() => setSelectedPerson(person)}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3"
                      >
                        {person.avatar_url ? (
                          <img
                            src={person.avatar_url}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                            <span className="text-gray-600 font-medium">
                              {(person.first_name?.[0] || '?').toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {getDisplayName(person)}
                          </p>
                          {person.email && (
                            <p className="text-sm text-gray-500 truncate">{person.email}</p>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[person.role] || 'bg-gray-100 text-gray-800'}`}>
                          {ROLE_LABELS[person.role] || person.role}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* No Results */}
                {searchQuery.trim().length >= 2 && !isSearching && searchResults.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p>No people found matching "{searchQuery}"</p>
                    <button
                      onClick={() => setActiveTab('create')}
                      className="mt-2 text-sm text-gray-900 hover:underline font-medium"
                    >
                      Create a new person instead
                    </button>
                  </div>
                )}

                {/* Selected Person Preview */}
                {selectedPerson && (
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Selected Person</span>
                      <button
                        onClick={() => setSelectedPerson(null)}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        Change
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      {selectedPerson.avatar_url ? (
                        <img
                          src={selectedPerson.avatar_url}
                          alt=""
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-lg text-gray-600 font-medium">
                            {(selectedPerson.first_name?.[0] || '?').toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-gray-900">
                          {getDisplayName(selectedPerson)}
                        </p>
                        {selectedPerson.email && (
                          <p className="text-sm text-gray-500">{selectedPerson.email}</p>
                        )}
                        {selectedPerson.title && (
                          <p className="text-sm text-gray-600">{selectedPerson.title}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab Content: Create New */}
            {activeTab === 'create' && (
              <div className="space-y-4">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                      placeholder="First name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                      placeholder="Last name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                      placeholder="email@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.mobile_phone}
                      onChange={(e) => setFormData({ ...formData, mobile_phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                    >
                      {Object.entries(ROLE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as UserStatus })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                    >
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                    placeholder="Job title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bio
                  </label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900 resize-none"
                    placeholder="Brief background..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                    placeholder="City, Country"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      LinkedIn URL
                    </label>
                    <input
                      type="url"
                      value={formData.linkedin_url}
                      onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                      placeholder="https://linkedin.com/in/..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Twitter URL
                    </label>
                    <input
                      type="url"
                      value={formData.twitter_url}
                      onChange={(e) => setFormData({ ...formData, twitter_url: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                      placeholder="https://twitter.com/..."
                    />
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tags
                  </label>
                  <TagSelector
                    selectedTags={selectedTags}
                    onChange={setSelectedTags}
                    currentUserId={currentUserId}
                  />
                </div>

                {/* Relationship Tracking Section */}
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                    Relationship Tracking
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        First Met Date
                      </label>
                      <input
                        type="date"
                        value={formData.first_met_date}
                        onChange={(e) => setFormData({ ...formData, first_met_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Introduced By
                      </label>
                      <select
                        value={formData.introduced_by}
                        onChange={(e) => setFormData({ ...formData, introduced_by: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                      >
                        <option value="">Select a person...</option>
                        {allPeople.map(p => (
                          <option key={p.id} value={p.id}>
                            {getDisplayName(p)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      How We Met / Introduction Context
                    </label>
                    <textarea
                      value={formData.introduction_context}
                      onChange={(e) => setFormData({ ...formData, introduction_context: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900 resize-none"
                      placeholder="e.g., Met at YC Demo Day..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Relationship Notes
                    </label>
                    <textarea
                      value={formData.relationship_notes}
                      onChange={(e) => setFormData({ ...formData, relationship_notes: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900 resize-none"
                      placeholder="Ongoing notes about the relationship..."
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 flex-shrink-0">
            <button
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-50"
            >
              Cancel
            </button>
            {activeTab === 'search' ? (
              <button
                onClick={handleLinkExistingPerson}
                disabled={loading || !selectedPerson}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Adding...' : 'Add Person'}
              </button>
            ) : (
              <button
                onClick={() => handleCreateNewPerson(false)}
                disabled={loading || !formData.first_name.trim()}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create & Add'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Duplicate Warning Modal */}
      {showDuplicateWarning && potentialDuplicates.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg max-w-lg w-full shadow-xl">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Potential Duplicate Found</h2>
                  <p className="text-sm text-gray-500">Similar people already exist</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <p className="text-gray-700 mb-4">
                We found {potentialDuplicates.length} existing {potentialDuplicates.length === 1 ? 'person' : 'people'} with a similar name or email:
              </p>

              <div className="space-y-3 max-h-60 overflow-y-auto">
                {potentialDuplicates.map(person => (
                  <div
                    key={person.id}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white font-medium">
                        {(person.first_name?.[0] || '?').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {getDisplayName(person)}
                        </p>
                        {person.email && (
                          <p className="text-sm text-gray-500 truncate">{person.email}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[person.role] || 'bg-gray-100 text-gray-800'}`}>
                            {ROLE_LABELS[person.role] || person.role}
                          </span>
                          {person.title && (
                            <span className="text-xs text-gray-500">{person.title}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-sm text-gray-500 mt-4">
                Are you sure you want to create a new person named "{formData.first_name} {formData.last_name}"?
              </p>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setShowDuplicateWarning(false)
                  setPotentialDuplicates([])
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleProceedWithDuplicate}
                className="flex-1 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-md hover:bg-amber-700"
              >
                Create Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
