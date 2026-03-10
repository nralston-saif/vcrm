'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@vcrm/ui'
import type { TicketStatus, TicketPriority, TicketComment as BaseTicketComment } from '@/lib/types/database'
import type { Database } from '@/lib/types/database'
type BaseTicket = Database['public']['Tables']['tickets']['Row']
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

type Application = {
  id: string
  company_name: string
  draft_rejection_email: string | null
  primary_email: string | null
}

type TicketCommentWithAuthor = BaseTicketComment & {
  author?: Partner | null
}

type TicketWithRelations = BaseTicket & {
  assigned_partner?: Partner | null
  creator?: Partner | null
  company?: Company | null
  person?: Person | null
  application?: Application | null
  comments?: TicketCommentWithAuthor[]
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

export default function TicketDetailModal({
  ticket,
  partners,
  companies,
  people,
  currentUserId,
  currentUserName,
  onClose,
  onUpdate,
}: {
  ticket: TicketWithRelations
  partners: Partner[]
  companies: Company[]
  people: Person[]
  currentUserId: string
  currentUserName: string
  onClose: () => void
  onUpdate: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    title: ticket.title,
    description: ticket.description || '',
    status: ticket.status,
    priority: ticket.priority,
    due_date: ticket.due_date || '',
    assigned_to: ticket.assigned_to || '',
    related_company: ticket.related_company || '',
    related_person: ticket.related_person || '',
    tags: ticket.tags || [],
  })
  const [loading, setLoading] = useState(false)

  // Comment state
  const [comments, setComments] = useState<TicketCommentWithAuthor[]>(ticket.comments || [])
  const [newComment, setNewComment] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [finalComment, setFinalComment] = useState('')
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)

  // Draft email editing state
  const [editingDraftEmail, setEditingDraftEmail] = useState<string>('')
  const [savingDraftEmail, setSavingDraftEmail] = useState(false)
  const [generatingEmail, setGeneratingEmail] = useState(false)
  const [currentDraftEmail, setCurrentDraftEmail] = useState<string | null>(
    ticket.application?.draft_rejection_email || null
  )

  // Check if this is an email ticket
  const isEmailTicket = ticket.tags?.includes('email-follow-up') || ticket.title?.toLowerCase().includes('email')
  const isRejectionEmail = ticket.tags?.includes('rejected') || ticket.title?.toLowerCase().includes('rejection')
  const isInterviewEmail = ticket.tags?.includes('deliberation') || ticket.title?.toLowerCase().includes('interview')

  const supabase = createClient()
  const { showToast } = useToast()

  const getPartnerName = (partner: Partner | null | undefined) => {
    if (!partner) return 'Unassigned'
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const formatDateShort = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getPriorityColor = (priority: TicketPriority) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700'
      case 'medium':
        return 'bg-amber-100 text-amber-700'
      case 'low':
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getStatusColor = (status: TicketStatus) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-700'
      case 'in_progress':
        return 'bg-amber-100 text-amber-700'
      case 'testing':
        return 'bg-purple-100 text-purple-700'
      case 'archived':
        return 'bg-emerald-100 text-emerald-700'
    }
  }

  // Fetch comments and subscribe to real-time updates
  useEffect(() => {
    fetchComments()

    const channel = supabase
      .channel(`ticket_comments:${ticket.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_comments',
          filter: `ticket_id=eq.${ticket.id}`,
        },
        () => {
          fetchComments()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [ticket.id])

  // Subscribe to draft email updates for email tickets
  useEffect(() => {
    if (!isEmailTicket || !ticket.application_id) return

    const applicationId = ticket.application_id

    // Initial fetch of draft email
    const fetchDraftEmail = async () => {
      const { data } = await supabase
        .from('applications')
        .select('draft_rejection_email')
        .eq('id', applicationId)
        .single()

      if (data?.draft_rejection_email) {
        setCurrentDraftEmail(data.draft_rejection_email)
      }
    }

    fetchDraftEmail()

    // Subscribe to changes
    const channel = supabase
      .channel(`application_email:${applicationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'applications',
          filter: `id=eq.${applicationId}`,
        },
        (payload) => {
          const newEmail = (payload.new as { draft_rejection_email?: string })?.draft_rejection_email
          if (newEmail) {
            setCurrentDraftEmail(newEmail)
            setGeneratingEmail(false)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [ticket.id, ticket.application_id, isEmailTicket])

  const fetchComments = async () => {
    const { data, error } = await supabase
      .from('ticket_comments')
      .select(`
        *,
        author:people!ticket_comments_author_id_fkey(
          id, first_name, last_name, email, avatar_url
        )
      `)
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setComments(data)
    }
  }

  const saveDraftEmail = async (email: string) => {
    if (!ticket.application_id) return

    setSavingDraftEmail(true)
    try {
      const response = await fetch('/api/generate-rejection-email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ applicationId: ticket.application_id, email }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        showToast(`Failed to save email: ${errorData.error}`, 'error')
        return
      }

      showToast('Email saved!', 'success')
      setCurrentDraftEmail(email)
      onUpdate()
    } catch {
      showToast('Failed to save email', 'error')
    } finally {
      setSavingDraftEmail(false)
    }
  }

  const generateEmail = async () => {
    if (!ticket.application_id) return

    setGeneratingEmail(true)
    try {
      const response = await fetch('/api/generate-rejection-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ applicationId: ticket.application_id }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        showToast(`Failed to generate email: ${errorData.error}`, 'error')
        setGeneratingEmail(false)
        return
      }

      showToast('Email generated!', 'success')
      // The real-time subscription will update the email
    } catch {
      showToast('Failed to generate email', 'error')
      setGeneratingEmail(false)
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return

    setIsSubmittingComment(true)
    const { error } = await supabase.from('ticket_comments').insert({
      ticket_id: ticket.id,
      author_id: currentUserId,
      content: newComment.trim(),
      is_final_comment: false,
    })

    setIsSubmittingComment(false)

    if (error) {
      showToast('Failed to add comment', 'error')
      console.error(error)
    } else {
      setNewComment('')
      showToast('Comment added', 'success')
      // Manually refetch to ensure immediate update
      await fetchComments()
    }
  }

  const handleEditComment = async (commentId: string) => {
    if (!editContent.trim()) return

    const { error } = await supabase
      .from('ticket_comments')
      .update({ content: editContent.trim() })
      .eq('id', commentId)

    if (error) {
      showToast('Failed to edit comment', 'error')
      console.error(error)
    } else {
      setEditingCommentId(null)
      setEditContent('')
      showToast('Comment updated', 'success')
      // Manually refetch to ensure immediate update
      await fetchComments()
    }
  }

  const handleDeleteComment = async () => {
    if (!deletingCommentId) return

    const { error } = await supabase
      .from('ticket_comments')
      .delete()
      .eq('id', deletingCommentId)

    if (error) {
      showToast('Failed to delete comment', 'error')
      console.error(error)
    } else {
      showToast('Comment deleted', 'success')
      // Manually refetch to ensure immediate update
      await fetchComments()
    }

    setDeletingCommentId(null)
  }

  const handleArchiveWithComment = async () => {
    setLoading(true)

    // Get the final email (either edited or original)
    const finalEmail = editingDraftEmail || ticket.application?.draft_rejection_email

    // If draft email was edited, save it to the application so AI can learn from edits
    if (editingDraftEmail && ticket.application_id && editingDraftEmail !== ticket.application?.draft_rejection_email) {
      try {
        const response = await fetch('/api/generate-rejection-email', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ applicationId: ticket.application_id, email: editingDraftEmail }),
        })
        if (!response.ok) {
          console.error('Failed to save edited email to application')
        }
      } catch (err) {
        console.error('Error saving edited email:', err)
      }
    }

    // Add final comment if provided
    if (finalComment.trim()) {
      const { error: commentError } = await supabase.from('ticket_comments').insert({
        ticket_id: ticket.id,
        author_id: currentUserId,
        content: finalComment.trim(),
        is_final_comment: true,
      })

      if (commentError) {
        showToast('Failed to save final comment', 'error')
        console.error(commentError)
        setLoading(false)
        return
      }
    }

    // Save the final email as a comment for record keeping
    if (finalEmail) {
      const { error: emailCommentError } = await supabase.from('ticket_comments').insert({
        ticket_id: ticket.id,
        author_id: currentUserId,
        content: `📧 Final Email Sent:\n\n${finalEmail}`,
        is_final_comment: true,
      })

      if (emailCommentError) {
        console.error('Failed to save email as comment:', emailCommentError)
        // Don't block archiving if this fails
      }
    }

    // If this ticket has an associated application, mark email as sent
    // Uses server-side API with service role key to avoid client-side RLS issues
    if (ticket.application_id) {
      try {
        const response = await fetch('/api/mark-email-sent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ applicationId: ticket.application_id }),
        })
        if (!response.ok) {
          console.error('Failed to mark email as sent:', await response.text())
        }
      } catch (err) {
        console.error('Failed to mark email as sent:', err)
        // Don't block archiving if this fails
      }
    }

    // Update ticket status to archived
    const { error } = await supabase
      .from('tickets')
      .update({ status: 'archived' })
      .eq('id', ticket.id)

    setLoading(false)

    if (error) {
      showToast('Failed to archive ticket', 'error')
      console.error(error)
    } else {
      // Dismiss ticket_assigned notification for the assignee
      fetch('/api/notifications/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ticketId: ticket.id,
        }),
      }).catch(console.error)

      showToast('Ticket archived successfully', 'success')
      setShowArchiveModal(false)
      setFinalComment('')
      setEditingDraftEmail('')
      // Close the modal first, then trigger update in background
      onClose()
      onUpdate()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      showToast('Title is required', 'error')
      return
    }

    setLoading(true)

    const previousAssignedTo = ticket.assigned_to
    const previousStatus = ticket.status

    const { error } = await supabase
      .from('tickets')
      .update({
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        status: formData.status,
        priority: formData.priority,
        due_date: formData.due_date || null,
        assigned_to: formData.assigned_to || null,
        related_company: formData.related_company || null,
        related_person: formData.related_person || null,
        tags: formData.tags.length > 0 ? formData.tags : null,
      })
      .eq('id', ticket.id)

    setLoading(false)

    if (error) {
      showToast('Failed to update ticket', 'error')
      console.error(error)
    } else {
      showToast('Ticket updated successfully', 'success')
      setIsEditing(false)

      // Send notification if assignment changed
      if (formData.assigned_to && formData.assigned_to !== previousAssignedTo) {
        fetch('/api/notifications/ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'assigned',
            ticketId: ticket.id,
            ticketTitle: formData.title.trim(),
            targetId: formData.assigned_to,
            actorId: currentUserId,
            actorName: currentUserName,
          }),
        }).catch(console.error)
      }

      // Send notification if status changed
      if (formData.status !== previousStatus) {
        if (formData.status === 'archived') {
          // If this ticket has an associated application, mark email as sent
          // Uses server-side API with service role key to avoid client-side RLS issues
          if (ticket.application_id) {
            try {
              const response = await fetch('/api/mark-email-sent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ applicationId: ticket.application_id }),
              })
              if (!response.ok) {
                console.error('Failed to mark email as sent:', await response.text())
              }
            } catch (err) {
              console.error('Failed to mark email as sent:', err)
            }
          }

          // Archived notification
          fetch('/api/notifications/ticket', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'archived',
              ticketId: ticket.id,
              ticketTitle: formData.title.trim(),
              creatorId: ticket.created_by,
              actorId: currentUserId,
              actorName: currentUserName,
            }),
          }).catch(console.error)

          // Dismiss ticket_assigned notification for the assignee
          fetch('/api/notifications/dismiss', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              ticketId: ticket.id,
            }),
          }).catch(console.error)
        } else {
          // Other status change notification
          fetch('/api/notifications/ticket', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'status_changed',
              ticketId: ticket.id,
              ticketTitle: formData.title.trim(),
              creatorId: ticket.created_by,
              actorId: currentUserId,
              actorName: currentUserName,
              newStatus: formData.status,
            }),
          }).catch(console.error)
        }
      }

      onUpdate()
    }
  }

  const handleDelete = async () => {
    setLoading(true)

    const { error } = await supabase
      .from('tickets')
      .delete()
      .eq('id', ticket.id)

    setLoading(false)

    if (error) {
      showToast('Failed to delete ticket', 'error')
      console.error(error)
    } else {
      showToast('Ticket deleted successfully', 'success')
      onClose()
      onUpdate()
    }
  }

  const handleQuickStatusChange = async (newStatus: TicketStatus) => {
    setLoading(true)

    const { error } = await supabase
      .from('tickets')
      .update({ status: newStatus })
      .eq('id', ticket.id)

    setLoading(false)

    if (error) {
      showToast('Failed to update status', 'error')
      console.error(error)
    } else {
      showToast('Status updated successfully', 'success')

      // Send notification for status change
      if (newStatus === 'archived' && ticket.status !== 'archived') {
        // If this ticket has an associated application, mark email as sent
        // Uses server-side API with service role key to avoid client-side RLS issues
        if (ticket.application_id) {
          try {
            const response = await fetch('/api/mark-email-sent', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ applicationId: ticket.application_id }),
            })
            if (!response.ok) {
              console.error('Failed to mark email as sent:', await response.text())
            }
          } catch (err) {
            console.error('Failed to mark email as sent:', err)
          }
        }

        // Archived notification
        fetch('/api/notifications/ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'archived',
            ticketId: ticket.id,
            ticketTitle: ticket.title,
            creatorId: ticket.created_by,
            actorId: currentUserId,
            actorName: currentUserName,
          }),
        }).catch(console.error)

        // Dismiss ticket_assigned notification for the assignee
        fetch('/api/notifications/dismiss', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            ticketId: ticket.id,
          }),
        }).catch(console.error)
      } else if (newStatus !== ticket.status) {
        // Other status change notification
        fetch('/api/notifications/ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'status_changed',
            ticketId: ticket.id,
            ticketTitle: ticket.title,
            creatorId: ticket.created_by,
            actorId: currentUserId,
            actorName: currentUserName,
            newStatus: newStatus,
          }),
        }).catch(console.error)
      }

      onUpdate()
    }
  }

  const handleFlagToggle = async () => {
    setLoading(true)

    const { error } = await supabase
      .from('tickets')
      .update({ is_flagged: !ticket.is_flagged })
      .eq('id', ticket.id)

    setLoading(false)

    if (error) {
      showToast('Failed to update flag', 'error')
      console.error(error)
    } else {
      showToast(ticket.is_flagged ? 'Flag removed' : 'Ticket flagged', 'success')
      onUpdate()
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content max-w-4xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {isEditing ? (
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="text-2xl font-bold text-gray-900 w-full border-b-2 border-gray-300 focus:outline-none focus:border-gray-900"
                  placeholder="Ticket title"
                />
              ) : (
                <h2 className="text-2xl font-bold text-gray-900">{ticket.title}</h2>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${getStatusColor(ticket.status)}`}>
                  {ticket.status.replace('_', ' ')}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${getPriorityColor(ticket.priority)}`}>
                  {ticket.priority}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2 -m-2 ml-4"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        {isEditing ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1 overflow-y-auto min-h-0">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as TicketPriority })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as TicketStatus })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            {/* Due Date & Assigned To */}
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
                currentUserId={ticket.created_by}
              />
            </div>
          </form>
        ) : (
          <div className="p-6 space-y-6 flex-1 overflow-y-auto min-h-0">
            {/* Description */}
            {ticket.description && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
                <p className="text-gray-900 whitespace-pre-wrap">{ticket.description}</p>
              </div>
            )}

            {/* Quick actions */}
            {ticket.status !== 'archived' && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Quick Actions</h3>
                <div className="flex flex-wrap gap-2">
                  {ticket.status !== 'in_progress' && (
                    <button
                      onClick={() => handleQuickStatusChange('in_progress')}
                      className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200 transition-colors"
                      disabled={loading}
                    >
                      Mark In Progress
                    </button>
                  )}
                  <button
                    onClick={() => setShowArchiveModal(true)}
                    className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200 transition-colors"
                    disabled={loading}
                  >
                    Resolve
                  </button>
                  <button
                    onClick={handleFlagToggle}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                      ticket.is_flagged
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    disabled={loading}
                  >
                    <svg className="w-4 h-4" fill={ticket.is_flagged ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                    </svg>
                    {ticket.is_flagged ? 'Flagged' : 'Flag'}
                  </button>
                </div>
              </div>
            )}

            {/* Details */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Assigned To</h3>
                <p className="text-gray-900">{getPartnerName(ticket.assigned_partner)}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Due Date</h3>
                <p className="text-gray-900">{ticket.due_date ? formatDateShort(ticket.due_date) : 'No due date'}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Related Company</h3>
                <p className="text-gray-900">{ticket.company?.name || 'None'}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Related Person</h3>
                <p className="text-gray-900">{ticket.person ? getPersonName(ticket.person) : 'None'}</p>
              </div>
            </div>

            {/* Tags */}
            {ticket.tags && ticket.tags.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {ticket.tags.map((tag, index) => (
                    <span key={index} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Comments Section */}
            <div className="border-t border-gray-100 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Comments ({comments.length})
              </h3>

              {/* Comments List */}
              <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
                {comments.map((comment) => (
                  <div key={comment.id} className="bg-gray-50 rounded-lg p-4">
                    {editingCommentId === comment.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditComment(comment.id)}
                            className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-black transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingCommentId(null)
                              setEditContent('')
                            }}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        {comment.author?.avatar_url ? (
                          <img
                            src={comment.author.avatar_url}
                            alt=""
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-xs text-gray-600">
                              {comment.author?.first_name?.[0] || '?'}
                            </span>
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {getPartnerName(comment.author)}
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatDate(comment.created_at)}
                              </span>
                            </div>
                            {comment.author_id === currentUserId && (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => {
                                    setEditingCommentId(comment.id)
                                    setEditContent(comment.content)
                                  }}
                                  className="p-1 text-gray-500 hover:text-gray-700"
                                  title="Edit comment"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                {!comment.is_final_comment && (
                                  <button
                                    onClick={() => setDeletingCommentId(comment.id)}
                                    className="p-1 text-gray-500 hover:text-red-600"
                                    title="Delete comment"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          <p className="text-gray-700 whitespace-pre-wrap">
                            {comment.content}
                          </p>
                          <div className="flex gap-2 mt-2">
                            {comment.is_final_comment && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700">
                                Final Comment
                              </span>
                            )}
                            {comment.is_testing_comment && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">
                                In Testing
                              </span>
                            )}
                            {comment.is_reactivated_comment && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">
                                Reactivated
                              </span>
                            )}
                            {!comment.is_final_comment && !comment.is_testing_comment && !comment.is_reactivated_comment && ticket.archived_at && new Date(comment.created_at) > new Date(ticket.archived_at) && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                                Post-completion
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {comments.length === 0 && (
                  <p className="text-center text-gray-500 py-8">
                    No comments yet. Add the first comment below.
                  </p>
                )}
              </div>

              {/* Add Comment Form */}
              <div className="space-y-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || isSubmittingComment}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black font-medium transition-colors disabled:opacity-50"
                  >
                    {isSubmittingComment ? 'Adding...' : 'Add Comment'}
                  </button>
                </div>
              </div>
            </div>

            {/* Draft Email Section - Show for all email tickets */}
            {isEmailTicket && ticket.application_id && (
              <div className="pt-6 border-t border-gray-100">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {isRejectionEmail ? 'AI-Generated Rejection Email' : 'Email Draft'}
                  {ticket.application?.primary_email && (
                    <span className="text-xs font-normal text-gray-500">
                      → {ticket.application?.primary_email}
                    </span>
                  )}
                </h4>

                {/* Generating state */}
                {generatingEmail && (
                  <div className="flex items-center gap-2 py-8 justify-center text-gray-500">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Generating email with AI...</span>
                  </div>
                )}

                {/* Email exists - show textarea */}
                {!generatingEmail && currentDraftEmail && (
                  <>
                    <textarea
                      value={editingDraftEmail || currentDraftEmail}
                      onChange={(e) => setEditingDraftEmail(e.target.value)}
                      onFocus={() =>
                        !editingDraftEmail &&
                        setEditingDraftEmail(currentDraftEmail)
                      }
                      rows={10}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900 font-mono text-sm resize-y min-h-[200px]"
                      placeholder="Email draft..."
                    />
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(editingDraftEmail || currentDraftEmail)
                          showToast('Email copied to clipboard', 'success')
                        }}
                        className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy Email
                      </button>
                      {editingDraftEmail && editingDraftEmail !== currentDraftEmail && (
                        <button
                          onClick={() => saveDraftEmail(editingDraftEmail)}
                          disabled={savingDraftEmail}
                          className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          {savingDraftEmail ? (
                            <>
                              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Saving...
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Save Changes
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </>
                )}

                {/* No email yet - show generate button for rejection emails */}
                {!generatingEmail && !currentDraftEmail && isRejectionEmail && (
                  <div className="text-center py-6">
                    <p className="text-gray-500 mb-3">No rejection email has been generated yet.</p>
                    <button
                      onClick={generateEmail}
                      className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors"
                    >
                      Generate Rejection Email
                    </button>
                  </div>
                )}

                {/* Interview emails - no auto-generation available */}
                {!generatingEmail && !currentDraftEmail && isInterviewEmail && (
                  <div className="text-center py-6 text-gray-500">
                    <p>Interview follow-up emails are not auto-generated.</p>
                    <p className="text-sm mt-1">Please compose your follow-up email manually.</p>
                  </div>
                )}
              </div>
            )}

            {/* Metadata */}
            <div className="pt-6 border-t border-gray-100 space-y-2 text-sm text-gray-500">
              <p>Created by {getPartnerName(ticket.creator)} on {formatDate(ticket.created_at)}</p>
              <p>Last updated {formatDate(ticket.updated_at)}</p>
              {ticket.archived_at && (
                <p>Archived on {formatDate(ticket.archived_at)}</p>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between flex-shrink-0">
          <div>
            {!isEditing && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
                disabled={loading}
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-3">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false)
                    setFormData({
                      title: ticket.title,
                      description: ticket.description || '',
                      status: ticket.status,
                      priority: ticket.priority,
                      due_date: ticket.due_date || '',
                      assigned_to: ticket.assigned_to || '',
                      related_company: ticket.related_company || '',
                      related_person: ticket.related_person || '',
                      tags: ticket.tags || [],
                    })
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-black font-medium transition-colors disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-black font-medium transition-colors"
              >
                Edit Ticket
              </button>
            )}
          </div>
        </div>

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-2xl">
            <div className="bg-white rounded-xl p-6 max-w-sm mx-4">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Ticket?</h3>
              <p className="text-gray-600 mb-4">
                Are you sure you want to delete this ticket? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Archive Modal */}
        {showArchiveModal && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-2xl">
            <div className="bg-white rounded-xl p-6 max-w-lg mx-4 w-full">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Resolve Ticket
              </h3>
              <p className="text-gray-600 mb-4">
                Add a final comment to summarize the outcome (optional).
              </p>
              <textarea
                value={finalComment}
                onChange={(e) => setFinalComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    handleArchiveWithComment()
                  }
                }}
                placeholder="Final summary or resolution notes... (Cmd/Ctrl+Enter to submit)"
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-gray-900 focus:border-gray-900 mb-4"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowArchiveModal(false)
                    setFinalComment('')
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleArchiveWithComment}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition-colors disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Resolving...' : 'Resolve & Close'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Comment Confirmation */}
        {deletingCommentId && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-2xl">
            <div className="bg-white rounded-xl p-6 max-w-sm mx-4">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Comment?</h3>
              <p className="text-gray-600 mb-4">
                Are you sure you want to delete this comment? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingCommentId(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteComment}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
