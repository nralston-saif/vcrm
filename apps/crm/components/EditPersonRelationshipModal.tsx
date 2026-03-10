'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { RelationshipType } from '@vcrm/supabase'

interface EditPersonRelationshipModalProps {
  relationshipId: string
  personId: string
  personName: string
  companyName: string
  currentRelationshipType: string
  currentTitle: string | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const RELATIONSHIP_TYPES = [
  { value: 'founder', label: 'Founder' },
  { value: 'employee', label: 'Employee' },
  { value: 'advisor', label: 'Advisor' },
  { value: 'board_member', label: 'Board Member' },
  { value: 'partner', label: 'Partner' },
]

export default function EditPersonRelationshipModal({
  relationshipId,
  personId,
  personName,
  companyName,
  currentRelationshipType,
  currentTitle,
  isOpen,
  onClose,
  onSuccess,
}: EditPersonRelationshipModalProps) {
  const router = useRouter()
  const supabase = createClient()

  const [relationshipType, setRelationshipType] = useState(currentRelationshipType)
  const [title, setTitle] = useState(currentTitle || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    setError(null)

    try {
      // Update the relationship
      const { error: updateError } = await supabase
        .from('company_people')
        .update({
          relationship_type: relationshipType as RelationshipType,
          title: title || null,
        })
        .eq('id', relationshipId)

      if (updateError) throw updateError

      // If changing to founder, update the person's role
      if (relationshipType === 'founder' && currentRelationshipType !== 'founder') {
        // Check current role first
        const { data: person } = await supabase
          .from('people')
          .select('role')
          .eq('id', personId)
          .single()

        // Only update if not already a founder or partner
        if (person && person.role !== 'founder' && person.role !== 'partner') {
          await supabase
            .from('people')
            .update({ role: 'founder' })
            .eq('id', personId)
        }
      }

      onSuccess()
    } catch (err: any) {
      setError(err?.message || 'Failed to update relationship')
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async () => {
    setLoading(true)
    setError(null)

    try {
      // Soft delete by setting end_date
      const { error: updateError } = await supabase
        .from('company_people')
        .update({ end_date: new Date().toISOString() })
        .eq('id', relationshipId)

      if (updateError) throw updateError

      onSuccess()
    } catch (err: any) {
      setError(err?.message || 'Failed to remove relationship')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Modal Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={onClose} />

      {/* Modal Content */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-lg shadow-xl max-w-md w-full pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Edit Relationship</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {personName} at {companyName}
                </p>
              </div>
              <button
                onClick={onClose}
                disabled={loading}
                className="text-gray-400 hover:text-gray-600 p-2 -m-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Content */}
          <div className="px-6 py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Relationship Type
              </label>
              <select
                value={relationshipType}
                onChange={(e) => setRelationshipType(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900 disabled:bg-gray-100"
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
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={loading}
                placeholder="e.g. Co-Founder & CEO"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900 disabled:bg-gray-100"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <button
              onClick={() => setShowRemoveConfirm(true)}
              disabled={loading}
              className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
            >
              Remove from company
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Remove Confirmation Modal */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg max-w-sm w-full shadow-xl">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Remove from Company</h3>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to remove <strong>{personName}</strong> from <strong>{companyName}</strong>?
                They will be marked as a former team member.
              </p>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowRemoveConfirm(false)}
                disabled={loading}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleRemove}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
