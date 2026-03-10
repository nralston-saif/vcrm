'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@vcrm/ui'
import type { TicketStatus, TicketPriority } from '@vcrm/supabase'
import TagSelector from './TagSelector'

type Partner = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  avatar_url: string | null
}

type Company = {
  id: string
  name: string
  logo_url?: string | null
}

type Person = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
}

type FormData = {
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  due_date: string
  assigned_to: string
  related_company: string
  related_person: string
  tags: string[]
}

export default function CreateTicketModal({
  partners,
  companies,
  people,
  currentUserId,
  currentUserName,
  onClose,
  onSuccess,
}: {
  partners: Partner[]
  companies: Company[]
  people: Person[]
  currentUserId: string
  currentUserName: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    status: 'open',
    priority: 'medium',
    due_date: '',
    assigned_to: '',
    related_company: '',
    related_person: '',
    tags: [],
  })
  const [loading, setLoading] = useState(false)

  const supabase = createClient()
  const { showToast } = useToast()

  const getPartnerName = (partner: Partner) => {
    if (partner.first_name && partner.last_name) {
      return `${partner.first_name} ${partner.last_name}`
    }
    return partner.email || 'Unknown'
  }

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

      onSuccess()
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Create New Ticket</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2 -m-2"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
              placeholder="e.g., Follow up with Acme Corp"
              required
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
              rows={4}
              placeholder="Add details about this ticket..."
            />
          </div>

          {/* Two-column layout for dropdowns */}
          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as TicketPriority })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                required
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            {/* Assign To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assign To
              </label>
              <select
                value={formData.assigned_to}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
              >
                <option value="">Unassigned</option>
                {partners.map(partner => (
                  <option key={partner.id} value={partner.id}>
                    {getPartnerName(partner)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Due Date & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as TicketStatus })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                required
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
              </select>
            </div>
          </div>

          {/* Related Company & Person */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Related Company
              </label>
              <select
                value={formData.related_company}
                onChange={(e) => setFormData({ ...formData, related_company: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
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
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-black font-medium transition-colors disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
