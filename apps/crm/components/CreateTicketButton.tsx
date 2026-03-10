'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@vcrm/ui'
import type { TicketStatus, TicketPriority } from '@vcrm/supabase'
import TagSelector from '@/app/tickets/TagSelector'

type Person = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
}

type Company = {
  id: string
  name: string
  logo_url?: string | null
}

type CreateTicketButtonProps = {
  currentUserId: string
  className?: string
  onSuccess?: () => void
}

export default function CreateTicketButton({ currentUserId, className, onSuccess }: CreateTicketButtonProps) {
  const [showModal, setShowModal] = useState(false)
  const [partners, setPartners] = useState<Person[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [isPartner, setIsPartner] = useState<boolean | null>(null)
  const supabase = createClient()

  // Check if current user is a partner
  useEffect(() => {
    const checkPartner = async () => {
      const { data } = await supabase
        .from('people')
        .select('role')
        .eq('id', currentUserId)
        .single()

      setIsPartner(data?.role === 'partner')
    }
    checkPartner()
  }, [currentUserId, supabase])

  // Fetch data when modal opens
  useEffect(() => {
    if (showModal) {
      const fetchData = async () => {
        const [partnersRes, companiesRes, peopleRes] = await Promise.all([
          supabase
            .from('people')
            .select('id, first_name, last_name, email')
            .eq('role', 'partner')
            .order('first_name'),
          supabase
            .from('companies')
            .select('id, name, logo_url')
            .order('name'),
          supabase
            .from('people')
            .select('id, first_name, last_name, email')
            .in('status', ['active', 'eligible'])
            .order('first_name'),
        ])

        if (partnersRes.data) setPartners(partnersRes.data as Person[])
        if (companiesRes.data) setCompanies(companiesRes.data as Company[])
        if (peopleRes.data) setPeople(peopleRes.data as Person[])
      }

      fetchData()
    }
  }, [showModal, supabase])

  // Don't render anything if not a partner (or still checking)
  if (!isPartner) {
    return null
  }

  return (
    <>
      {/* Inline Button */}
      <button
        onClick={() => setShowModal(true)}
        className={className || "px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"}
      >
        + Create Ticket
      </button>

      {/* Modal */}
      {showModal && (
        <QuickTicketModal
          onClose={() => setShowModal(false)}
          currentUserId={currentUserId}
          partners={partners}
          companies={companies}
          people={people}
          onSuccess={onSuccess}
        />
      )}
    </>
  )
}

// Quick Ticket Modal Component
function QuickTicketModal({
  onClose,
  currentUserId,
  partners,
  companies,
  people,
  onSuccess,
}: {
  onClose: () => void
  currentUserId: string
  partners: Person[]
  companies: Company[]
  people: Person[]
  onSuccess?: () => void
}) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'open' as TicketStatus,
    priority: 'medium' as TicketPriority,
    due_date: '',
    assigned_to: '',
    related_company: '',
    related_person: '',
    tags: [] as string[],
  })
  const [loading, setLoading] = useState(false)

  const supabase = createClient()
  const { showToast } = useToast()

  const getPersonName = (person: Person) => {
    if (person.first_name && person.last_name) {
      return `${person.first_name} ${person.last_name}`
    }
    return person.email || 'Unknown'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      showToast('Title is required', 'error')
      return
    }

    setLoading(true)

    const { data, error } = await supabase.from('tickets').insert({
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      status: formData.status,
      priority: formData.priority,
      due_date: formData.due_date || null,
      assigned_to: formData.assigned_to || null,
      related_company: formData.related_company || null,
      related_person: formData.related_person || null,
      tags: formData.tags.length > 0 ? formData.tags : null,
      created_by: currentUserId,
      was_unassigned_at_creation: !formData.assigned_to,
    }).select('id').single()

    setLoading(false)

    if (error) {
      showToast('Failed to create ticket', 'error')
      console.error(error)
    } else {
      showToast('Ticket created successfully', 'success')

      // Send notification if assigned to someone else
      if (formData.assigned_to && formData.assigned_to !== currentUserId && data?.id) {
        const currentUser = partners.find(p => p.id === currentUserId)
        const currentUserName = currentUser
          ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || 'Someone'
          : 'Someone'

        fetch('/api/notifications/ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'assigned',
            ticketId: data.id,
            ticketTitle: formData.title.trim(),
            targetId: formData.assigned_to,
            actorId: currentUserId,
            actorName: currentUserName,
          }),
        }).catch(console.error)
      }

      onClose()
      if (onSuccess) {
        onSuccess()
      }
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      {/* Modal */}
      <div className="bg-white rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.3)] w-full max-w-md max-h-[85vh] overflow-y-auto border-2 border-gray-200" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between rounded-t-xl">
          <h2 className="text-base font-semibold text-gray-900">Create Ticket</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
              placeholder="e.g., Follow up with founder"
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
              rows={2}
              placeholder="Add details..."
            />
          </div>

          {/* Priority & Assign To (Two columns) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as TicketPriority })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
                required
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assign To
              </label>
              <select
                value={formData.assigned_to}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
              >
                <option value="">Unassigned</option>
                {partners.map(partner => (
                  <option key={partner.id} value={partner.id}>
                    {getPersonName(partner)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Due Date & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as TicketStatus })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
                required
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
              </select>
            </div>
          </div>

          {/* Related Company & Person */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Related Company
              </label>
              <select
                value={formData.related_company}
                onChange={(e) => setFormData({ ...formData, related_company: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
              >
                <option value="">None</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Related Person
              </label>
              <select
                value={formData.related_person}
                onChange={(e) => setFormData({ ...formData, related_person: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
              >
                <option value="">None</option>
                {people.map(person => (
                  <option key={person.id} value={person.id}>
                    {getPersonName(person)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags
            </label>
            <TagSelector
              selectedTags={formData.tags}
              onChange={(tags) => setFormData({ ...formData, tags })}
              currentUserId={currentUserId}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors text-sm"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-black text-white rounded-lg hover:bg-gray-800 font-medium transition-colors disabled:opacity-50 text-sm"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
