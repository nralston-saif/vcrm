'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type CompanyAssociation = {
  id: string
  relationship_type: string
  title: string | null
  is_primary_contact: boolean
  end_date: string | null
  company: {
    id: string
    name: string
    logo_url: string | null
    short_description: string | null
    website: string | null
  } | null
}

type Company = {
  id: string
  name: string
}

type Props = {
  personId: string
  personName: string
  personRole: string
  activeCompanies: CompanyAssociation[]
  isPartner: boolean
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  founder: 'Founder',
  employee: 'Employee',
  advisor: 'Advisor',
  board_member: 'Board Member',
  partner: 'Partner',
}

export default function PersonCompanyManager({
  personId,
  personName,
  personRole,
  activeCompanies,
  isPartner,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [showAddModal, setShowAddModal] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [relationshipType, setRelationshipType] = useState<string>('employee')
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Fetch available companies when modal opens
  useEffect(() => {
    if (showAddModal) {
      fetchCompanies()
    }
  }, [showAddModal])

  const fetchCompanies = async () => {
    const { data } = await supabase
      .from('companies')
      .select('id, name')
      .order('name')
      .limit(500)

    if (data) {
      // Filter out companies the person is already associated with
      const existingCompanyIds = activeCompanies.map(c => c.company?.id).filter(Boolean)
      const availableCompanies = data.filter(c => !existingCompanyIds.includes(c.id))
      setCompanies(availableCompanies)
    }
  }

  const handleAddCompanyLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCompanyId) return

    setLoading(true)
    setError(null)

    try {
      // Check for existing relationship (including ended ones)
      const { data: existingLink } = await supabase
        .from('company_people')
        .select('id, end_date')
        .eq('company_id', selectedCompanyId)
        .eq('user_id', personId)
        .eq('relationship_type', relationshipType)
        .single()

      if (existingLink && !existingLink.end_date) {
        setError('This person already has this relationship with this company.')
        setLoading(false)
        return
      }

      if (existingLink && existingLink.end_date) {
        // Reactivate former relationship
        const { error: updateError } = await supabase
          .from('company_people')
          .update({ end_date: null, title: title || null })
          .eq('id', existingLink.id)

        if (updateError) throw updateError
      } else {
        // Create new relationship
        const { error: insertError } = await supabase
          .from('company_people')
          .insert({
            company_id: selectedCompanyId,
            user_id: personId,
            relationship_type: relationshipType,
            title: title || null,
            is_primary_contact: false,
          })

        if (insertError) throw insertError
      }

      // If adding as founder, update person's role if needed
      if (relationshipType === 'founder' && personRole !== 'founder' && personRole !== 'partner') {
        await supabase
          .from('people')
          .update({ role: 'founder' })
          .eq('id', personId)
      }

      setSuccess('Company association added!')
      setShowAddModal(false)
      setSelectedCompanyId('')
      setRelationshipType('employee')
      setTitle('')

      setTimeout(() => {
        router.refresh()
        setSuccess(null)
      }, 1000)
    } catch (err: any) {
      console.error('Error adding company link:', err)
      setError(err?.message || 'Failed to add company association')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveCompanyLink = async (linkId: string, companyName: string, relationship: string) => {
    if (!confirm(`Remove ${personName} as ${relationship} from ${companyName}?`)) {
      return
    }

    try {
      // Soft delete by setting end_date
      const { error } = await supabase
        .from('company_people')
        .update({ end_date: new Date().toISOString() })
        .eq('id', linkId)

      if (error) throw error

      setSuccess('Association removed')
      setTimeout(() => {
        router.refresh()
        setSuccess(null)
      }, 1000)
    } catch (err: any) {
      console.error('Error removing company link:', err)
      setError(err?.message || 'Failed to remove association')
    }
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900">
          {activeCompanies.length === 0 ? 'Companies' : activeCompanies.length === 1 ? 'Company' : 'Companies'}
        </h2>
        {isPartner && (
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Link to Company
          </button>
        )}
      </div>

      {/* Success/Error messages */}
      {success && (
        <div className="mb-3 p-3 bg-green-50 text-green-700 text-sm rounded-lg">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-3 p-3 bg-red-50 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* Company list */}
      {activeCompanies.length === 0 ? (
        <p className="text-gray-500 text-sm">No company associations</p>
      ) : (
        <div className="space-y-3">
          {activeCompanies.map((assoc) => {
            const company = assoc.company
            if (!company) return null
            return (
              <div
                key={assoc.id}
                className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg group"
              >
                <Link
                  href={`/companies/${company.id}`}
                  className="flex items-center space-x-3 flex-1 hover:opacity-75 transition"
                >
                  {company.logo_url ? (
                    <img
                      src={company.logo_url}
                      alt={company.name}
                      className="h-12 w-12 object-contain"
                    />
                  ) : (
                    <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center">
                      <span className="text-lg font-bold text-gray-400">
                        {company.name[0]}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{company.name}</p>
                    <p className="text-sm text-gray-500">
                      {RELATIONSHIP_LABELS[assoc.relationship_type] || assoc.relationship_type}
                      {assoc.title && ` - ${assoc.title}`}
                    </p>
                  </div>
                </Link>
                {isPartner && (
                  <button
                    onClick={() => handleRemoveCompanyLink(
                      assoc.id,
                      company.name,
                      RELATIONSHIP_LABELS[assoc.relationship_type] || assoc.relationship_type
                    )}
                    className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-600 transition"
                    title="Remove association"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                {!isPartner && (
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add Company Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Link to Company</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Add {personName} to a company
                  </p>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleAddCompanyLink}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Company *
                  </label>
                  <select
                    value={selectedCompanyId}
                    onChange={(e) => setSelectedCompanyId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select a company...</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Relationship Type *
                  </label>
                  <select
                    value={relationshipType}
                    onChange={(e) => setRelationshipType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="founder">Founder</option>
                    <option value="employee">Employee</option>
                    <option value="advisor">Advisor</option>
                    <option value="board_member">Board Member</option>
                    <option value="partner">Partner</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Title (Optional)
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Co-Founder & CEO"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
                    {error}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !selectedCompanyId}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition disabled:opacity-50"
                >
                  {loading ? 'Adding...' : 'Add Association'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
