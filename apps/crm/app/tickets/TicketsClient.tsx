'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { TicketStatus, TicketPriority, TicketComment as BaseTicketComment, Database, TicketSource, FeedbackType } from '@/lib/types/database'
type BaseTicket = Database['public']['Tables']['tickets']['Row']
import CreateTicketModal from './CreateTicketModal'
import TicketDetailModal from './TicketDetailModal'
import LeaderboardModal from './LeaderboardModal'
import ReportsModal from './ReportsModal'
import { useTicketModal } from '@/components/TicketModalProvider'

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

type TicketCommentWithAuthor = BaseTicketComment & {
  author?: Partner | null
}

type TicketWithRelations = BaseTicket & {
  assigned_partner?: Partner | null
  creator?: Partner | null
  company?: Company | null
  person?: Person | null
  comments?: TicketCommentWithAuthor[]
  source?: TicketSource
  feedback_type?: FeedbackType | null
}

type StatusFilter = 'active' | 'archived' | 'unassigned' | 'intake' | 'all'
type StageFilter = 'all' | 'open' | 'in_progress'
type SortOption = 'date-newest' | 'date-oldest' | 'priority' | 'due-date' | 'title' | 'flagged'

export default function TicketsClient({
  tickets,
  partners,
  companies,
  people,
  currentUserId,
  userName,
}: {
  tickets: TicketWithRelations[]
  partners: Partner[]
  companies: Company[]
  people: Person[]
  currentUserId: string
  userName: string
}) {
  // State
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [stageFilter, setStageFilter] = useState<StageFilter>('all')
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'all'>('all')
  const [assignedFilter, setAssignedFilter] = useState<string | 'all' | 'unassigned'>(currentUserId)
  const [sortOption, setSortOption] = useState<SortOption>('date-newest')

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [showReports, setShowReports] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<TicketWithRelations | null>(null)
  const [localTickets, setLocalTickets] = useState<TicketWithRelations[]>(tickets)

  // Sync local tickets with prop changes
  useEffect(() => {
    setLocalTickets(tickets)
  }, [tickets])
  const [resolvingTicket, setResolvingTicket] = useState<{ id: string; title: string } | null>(null)
  const [resolveComment, setResolveComment] = useState('')
  const [isResolving, setIsResolving] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const { setOnTicketUpdate } = useTicketModal()

  // Handle opening ticket from URL parameter (e.g., from dashboard)
  useEffect(() => {
    const ticketId = searchParams.get('id')
    if (ticketId) {
      const ticket = tickets.find(t => t.id === ticketId)
      if (ticket) {
        setSelectedTicket(ticket)
        // Remove the query parameter after opening
        router.replace('/tickets', { scroll: false })
      }
    }
  }, [searchParams, tickets, router])

  // Listen for ticket updates from modal (deletions)
  useEffect(() => {
    if (setOnTicketUpdate) {
      setOnTicketUpdate((ticketId, status) => {
        if (status === 'archived') {
          // Remove deleted ticket from list
          setLocalTickets(prev => prev.filter(t => t.id !== ticketId))
        }
      })
    }
    return () => {
      if (setOnTicketUpdate) {
        setOnTicketUpdate(null)
      }
    }
  }, [setOnTicketUpdate])

  // Filter and sort tickets
  const filteredTickets = useMemo(() => {
    let filtered = localTickets

    // Status filter
    if (statusFilter === 'active') {
      filtered = filtered.filter(t => t.status !== 'archived')
    } else if (statusFilter === 'archived') {
      filtered = filtered.filter(t => t.status === 'archived')
    } else if (statusFilter === 'unassigned') {
      filtered = filtered.filter(t => !t.assigned_to && t.status !== 'archived')
    } else if (statusFilter === 'intake') {
      // Founder feedback that hasn't been assigned yet
      filtered = filtered.filter(t => t.source === 'founder_feedback' && !t.assigned_to && t.status !== 'archived')
    }

    // Stage filter (open vs in_progress)
    if (stageFilter !== 'all') {
      filtered = filtered.filter(t => t.status === stageFilter)
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(t => t.priority === priorityFilter)
    }

    // Assignment filter
    if (assignedFilter === 'unassigned') {
      filtered = filtered.filter(t => !t.assigned_to)
    } else if (assignedFilter !== 'all') {
      filtered = filtered.filter(t => t.assigned_to === assignedFilter)
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.company?.name.toLowerCase().includes(query) ||
        t.tags?.some(tag => tag.toLowerCase().includes(query))
      )
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'flagged':
          // Flagged tickets first, then by created date
          if (a.is_flagged && !b.is_flagged) return -1
          if (!a.is_flagged && b.is_flagged) return 1
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'date-newest':
          // For archived tickets, sort by archived_at (resolve date); otherwise by created_at
          if (statusFilter === 'archived') {
            const aDate = a.archived_at ? new Date(a.archived_at).getTime() : 0
            const bDate = b.archived_at ? new Date(b.archived_at).getTime() : 0
            return bDate - aDate
          }
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'date-oldest':
          if (statusFilter === 'archived') {
            const aDate = a.archived_at ? new Date(a.archived_at).getTime() : 0
            const bDate = b.archived_at ? new Date(b.archived_at).getTime() : 0
            return aDate - bDate
          }
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'priority':
          const priorityOrder = { high: 0, medium: 1, low: 2 }
          return priorityOrder[a.priority] - priorityOrder[b.priority]
        case 'due-date':
          if (!a.due_date) return 1
          if (!b.due_date) return -1
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        case 'title':
          return a.title.localeCompare(b.title)
        default:
          return 0
      }
    })

    return filtered
  }, [localTickets, statusFilter, stageFilter, priorityFilter, assignedFilter, searchQuery, sortOption])

  // Stats
  const stats = useMemo(() => ({
    total: localTickets.length,
    open: localTickets.filter(t => t.status === 'open').length,
    inProgress: localTickets.filter(t => t.status === 'in_progress').length,
    archived: localTickets.filter(t => t.status === 'archived').length,
    unassigned: localTickets.filter(t => !t.assigned_to && t.status !== 'archived').length,
    flagged: localTickets.filter(t => t.is_flagged && t.status !== 'archived').length,
    overdue: localTickets.filter(t =>
      t.due_date &&
      new Date(t.due_date) < new Date() &&
      t.status !== 'archived'
    ).length,
    intake: localTickets.filter(t => t.source === 'founder_feedback' && !t.assigned_to && t.status !== 'archived').length,
  }), [localTickets])

  // Helper functions
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const isOverdue = (dueDate: string | null, status: TicketStatus) => {
    return dueDate && new Date(dueDate) < new Date() && status !== 'archived'
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

  const getPartnerName = (partner: Partner | null | undefined) => {
    if (!partner) return 'Unassigned'
    if (partner.first_name && partner.last_name) {
      return `${partner.first_name} ${partner.last_name}`
    }
    return partner.email || 'Unknown'
  }

  const getFeedbackTypeBadge = (feedbackType: FeedbackType | null | undefined) => {
    if (!feedbackType) return null
    const badges: Record<FeedbackType, { label: string; icon: string; className: string }> = {
      bug_report: { label: 'Bug', icon: '🐛', className: 'bg-red-100 text-red-700' },
      suggestion: { label: 'Idea', icon: '💡', className: 'bg-amber-100 text-amber-700' },
      question: { label: 'Q', icon: '❓', className: 'bg-blue-100 text-blue-700' },
    }
    return badges[feedbackType]
  }

  const handleResolveClick = (ticketId: string, ticketTitle: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setResolvingTicket({ id: ticketId, title: ticketTitle })
    setResolveComment('')
  }

  const handleResolveSubmit = async () => {
    if (!resolvingTicket) return

    setIsResolving(true)
    const supabase = createClient()

    // Add comment if provided
    if (resolveComment.trim()) {
      await supabase.from('ticket_comments').insert({
        ticket_id: resolvingTicket.id,
        author_id: currentUserId,
        content: resolveComment.trim(),
        is_final_comment: true,
      })
    }

    // Archive the ticket
    const { error } = await supabase
      .from('tickets')
      .update({ status: 'archived' })
      .eq('id', resolvingTicket.id)

    setIsResolving(false)
    setResolvingTicket(null)
    setResolveComment('')

    if (!error) {
      router.refresh()
    }
  }

  // Toggle flag on ticket
  const handleFlagToggle = async (ticketId: string, currentFlagged: boolean, e: React.MouseEvent) => {
    e.stopPropagation()
    const supabase = createClient()

    const { error } = await supabase
      .from('tickets')
      .update({ is_flagged: !currentFlagged })
      .eq('id', ticketId)

    if (!error) {
      // Update local state for immediate feedback
      setLocalTickets(prev => prev.map(t =>
        t.id === ticketId ? { ...t, is_flagged: !currentFlagged } : t
      ))
    }
  }

  // Quick status change without modal
  const handleQuickStatusChange = async (ticketId: string, newStatus: TicketStatus, e: React.MouseEvent) => {
    e.stopPropagation()
    const supabase = createClient()

    const { error } = await supabase
      .from('tickets')
      .update({ status: newStatus })
      .eq('id', ticketId)

    if (!error) {
      // Update local state for immediate feedback
      setLocalTickets(prev => prev.map(t =>
        t.id === ticketId ? { ...t, status: newStatus } : t
      ))
    }
  }

  // Render ticket row (compact list view)
  const renderTicketCard = (ticket: TicketWithRelations) => {
    const overdueStatus = isOverdue(ticket.due_date, ticket.status)

    return (
      <div
        key={ticket.id}
        onClick={() => setSelectedTicket(ticket)}
        className="p-3 sm:p-4 hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
          {/* Left side - Main content */}
          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-start gap-2 mb-1">
              <h3 className="font-medium text-gray-900 text-sm sm:text-base line-clamp-2 sm:truncate flex-1 min-w-0">
                {ticket.title}
              </h3>
              {/* Comment count - visible on mobile next to title */}
              {ticket.comments && ticket.comments.length > 0 && (
                <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gray-100 text-xs text-gray-600 flex-shrink-0 sm:hidden" title={`${ticket.comments.length} comment${ticket.comments.length !== 1 ? 's' : ''}`}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span>{ticket.comments.length}</span>
                </div>
              )}
            </div>

            {/* Badges row */}
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 flex-wrap">
              {/* Feedback type badge for founder submissions */}
              {ticket.source === 'founder_feedback' && ticket.feedback_type && (() => {
                const badge = getFeedbackTypeBadge(ticket.feedback_type)
                return badge ? (
                  <span className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${badge.className}`}>
                    <span>{badge.icon}</span>
                    <span>{badge.label}</span>
                  </span>
                ) : null
              })()}
              <span className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium capitalize ${getStatusColor(ticket.status)}`}>
                {ticket.status.replace('_', ' ')}
              </span>
              <span className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium capitalize ${getPriorityColor(ticket.priority)}`}>
                {ticket.priority}
              </span>
              {/* Comment count - visible on desktop */}
              {ticket.comments && ticket.comments.length > 0 && (
                <div className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-600" title={`${ticket.comments.length} comment${ticket.comments.length !== 1 ? 's' : ''}`}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span>{ticket.comments.length}</span>
                </div>
              )}
              {/* Due date badge - mobile only */}
              {ticket.due_date && (
                <div className={`sm:hidden inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${overdueStatus ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                  {overdueStatus ? 'Overdue' : formatDate(ticket.due_date)}
                </div>
              )}
            </div>

            {/* Description - hidden on mobile */}
            {ticket.description && (
              <p className="hidden sm:block text-sm text-gray-600 line-clamp-1 mb-1.5">
                {ticket.description}
              </p>
            )}

            {/* Tags, Company, and Assigned person */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-[10px] sm:text-xs">
              {/* Company */}
              {ticket.company && (
                <div className="flex items-center gap-1 text-gray-500">
                  <span className="truncate max-w-[100px] sm:max-w-none">📁 {ticket.company.name}</span>
                </div>
              )}

              {/* Assigned to */}
              <div className="flex items-center gap-1 text-gray-500">
                <span className="truncate">👤 {ticket.assigned_partner?.first_name || 'Unassigned'}</span>
              </div>

              {/* Creation date */}
              <div className="flex items-center gap-1 text-gray-400">
                <span>📅 {formatDate(ticket.created_at)}</span>
              </div>

              {/* Archived date - only for archived tickets */}
              {ticket.status === 'archived' && ticket.archived_at && (
                <div className="flex items-center gap-1 text-emerald-600">
                  <span>✓ {formatDate(ticket.archived_at)}</span>
                </div>
              )}

              {/* Tags - hidden on mobile */}
              {ticket.tags && ticket.tags.length > 0 && (
                <div className="hidden sm:flex flex-wrap gap-1">
                  {ticket.tags.map((tag, index) => (
                    <span key={index} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right side - Due date and actions (desktop only) */}
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
            {ticket.due_date && (
              <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg ${overdueStatus ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs font-medium whitespace-nowrap">
                  {overdueStatus ? 'Overdue' : formatDate(ticket.due_date)}
                </span>
              </div>
            )}
            {/* Quick status change buttons */}
            {ticket.status !== 'archived' && (
              <>
                <button
                  onClick={(e) => handleResolveClick(ticket.id, ticket.title, e)}
                  className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                  title="Resolve ticket"
                >
                  Resolve
                </button>
                <button
                  onClick={(e) => handleFlagToggle(ticket.id, ticket.is_flagged, e)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    ticket.is_flagged
                      ? 'text-red-600 bg-red-50 hover:bg-red-100'
                      : 'text-gray-400 bg-gray-50 hover:bg-gray-100 hover:text-gray-600'
                  }`}
                  title={ticket.is_flagged ? 'Remove flag' : 'Flag ticket'}
                >
                  <svg className="w-4 h-4" fill={ticket.is_flagged ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Tickets</h1>
          <p className="mt-1 text-sm sm:text-base text-gray-500 hidden sm:block">Manage partner tasks and follow-ups</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base"
        >
          + Create Ticket
        </button>
      </div>

      {/* Main Layout: Content Left, Stats Right on desktop */}
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Left side - Main content */}
        <div className="flex-1 min-w-0 order-2 lg:order-1">

      {/* Filters & Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-0 rounded-b-none border-b-0">
        <div className="flex flex-col gap-4">
          {/* Search bar */}
          <input
            type="text"
            placeholder="Search tickets by title, description, company, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
          />

          {/* Status tabs - horizontally scrollable on mobile */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            <button
              onClick={() => {
                setStatusFilter('active')
                setAssignedFilter(currentUserId)
              }}
              className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                statusFilter === 'active'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Active ({stats.open + stats.inProgress})
            </button>
            {/* Intake tab - founder feedback needing triage */}
            <button
              onClick={() => {
                setStatusFilter('intake')
                setAssignedFilter('all')
              }}
              className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                statusFilter === 'intake'
                  ? 'bg-purple-600 text-white'
                  : stats.intake > 0
                  ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Intake ({stats.intake})
            </button>
            <button
              onClick={() => {
                setStatusFilter('archived')
                setAssignedFilter('all')
              }}
              className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                statusFilter === 'archived'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Archived ({stats.archived})
            </button>
            <button
              onClick={() => {
                setStatusFilter('unassigned')
                setAssignedFilter('unassigned')
              }}
              className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                statusFilter === 'unassigned'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Unassigned ({stats.unassigned})
            </button>
            <button
              onClick={() => {
                setStatusFilter('all')
                setAssignedFilter('all')
              }}
              className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                statusFilter === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({stats.total})
            </button>
          </div>

          {/* Filters row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 flex-1">
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value as StageFilter)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
              >
                <option value="all">All Stages</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as TicketPriority | 'all')}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
              >
                <option value="all">All Priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              <select
                value={assignedFilter}
                onChange={(e) => setAssignedFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
              >
                <option value="all">All Assignees</option>
                <option value="unassigned">Unassigned</option>
                {partners.map(partner => (
                  <option key={partner.id} value={partner.id}>
                    {getPartnerName(partner)}
                  </option>
                ))}
              </select>

              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900 col-span-2 sm:col-span-1"
              >
                <option value="date-newest">Newest First</option>
                <option value="date-oldest">Oldest First</option>
                <option value="flagged">Flagged First</option>
                <option value="priority">Priority</option>
                <option value="due-date">Due Date</option>
                <option value="title">Title (A-Z)</option>
              </select>
            </div>
            <p className="text-xs sm:text-sm font-medium text-gray-500 sm:text-gray-700 whitespace-nowrap">
              {filteredTickets.length} {filteredTickets.length === 1 ? 'result' : 'results'}
            </p>
          </div>
        </div>
      </div>

      {/* Tickets List */}
      <div className="bg-white rounded-xl rounded-t-none border border-gray-200 overflow-hidden">
        {filteredTickets.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-gray-400 text-xl">🎫</span>
            </div>
            <p className="text-gray-600">No tickets found</p>
            <p className="text-sm text-gray-400 mt-1">
              {searchQuery || priorityFilter !== 'all' || assignedFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create a ticket to get started'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredTickets.map(renderTicketCard)}
          </div>
        )}
      </div>
        </div>

        {/* Right side - Stats (horizontal on mobile, vertical sidebar on desktop) */}
        <div className="w-full lg:w-48 flex-shrink-0 order-1 lg:order-2">
          <div className="lg:sticky lg:top-20 flex flex-col gap-3">
            {/* Stats row - horizontal scroll on mobile, vertical on desktop */}
            <div className="flex lg:flex-col gap-2 lg:gap-3 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide -mx-1 px-1 lg:mx-0 lg:px-0">
              <StatCard label="Total" value={stats.total} color="gray" />
              <StatCard label="Open" value={stats.open} color="blue" />
              <StatCard label="In Progress" value={stats.inProgress} color="amber" />
              <StatCard label="Flagged" value={stats.flagged} color="red" />
              <StatCard label="Archived" value={stats.archived} color="green" />
              <StatCard label="Overdue" value={stats.overdue} color="orange" />
            </div>

            {/* Action buttons - row on mobile, column on desktop */}
            <div className="flex lg:flex-col gap-2 lg:gap-3">
              {/* Reports Button */}
              <button
                onClick={() => setShowReports(true)}
                className="flex-1 lg:w-full px-3 py-2.5 bg-gradient-to-r from-blue-100 to-indigo-100 hover:from-blue-200 hover:to-indigo-200 border border-blue-200 rounded-lg text-sm font-medium text-blue-800 transition-all flex items-center justify-center gap-2"
              >
                <span>📊</span>
                <span>Reports</span>
              </button>

              {/* Leaderboard Button */}
              <button
                onClick={() => setShowLeaderboard(true)}
                className="flex-1 lg:w-full px-3 py-2.5 bg-gradient-to-r from-amber-100 to-yellow-100 hover:from-amber-200 hover:to-yellow-200 border border-amber-200 rounded-lg text-sm font-medium text-amber-800 transition-all flex items-center justify-center gap-2"
              >
                <span>🏆</span>
                <span>Leaderboard</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateTicketModal
          partners={partners}
          companies={companies}
          people={people}
          currentUserId={currentUserId}
          currentUserName={userName}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            router.refresh()
          }}
        />
      )}

      {/* Resolve Ticket Modal */}
      {resolvingTicket && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setResolvingTicket(null)}
          />

          {/* Modal */}
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.3)] z-[60] border-2 border-gray-200">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Resolve Ticket
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {resolvingTicket.title}
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Final Comment (Optional)
              </label>
              <textarea
                value={resolveComment}
                onChange={(e) => setResolveComment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
                rows={4}
                placeholder="Add any final notes before resolving..."
                autoFocus
              />
              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => setResolvingTicket(null)}
                  disabled={isResolving}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResolveSubmit}
                  disabled={isResolving}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isResolving ? 'Resolving...' : 'Resolve Ticket'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket as any}
          partners={partners}
          companies={companies}
          people={people}
          currentUserId={currentUserId}
          currentUserName={userName}
          onClose={() => setSelectedTicket(null)}
          onUpdate={() => {
            setSelectedTicket(null)
            router.refresh()
          }}
        />
      )}

      {showLeaderboard && (
        <LeaderboardModal
          partners={partners}
          onClose={() => setShowLeaderboard(false)}
        />
      )}

      {showReports && (
        <ReportsModal
          onClose={() => setShowReports(false)}
        />
      )}
    </div>
  )
}

// Helper component for stat cards
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClasses: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-900',
    blue: 'bg-blue-100 text-blue-900',
    amber: 'bg-amber-100 text-amber-900',
    green: 'bg-emerald-100 text-emerald-900',
    red: 'bg-red-100 text-red-900',
    orange: 'bg-orange-100 text-orange-900',
  }

  return (
    <div className={`rounded-lg p-2 lg:p-3 min-w-[70px] lg:min-w-0 flex-shrink-0 ${colorClasses[color] || colorClasses.gray}`}>
      <div className="text-lg lg:text-xl font-bold">{value}</div>
      <div className="text-[10px] lg:text-xs font-medium whitespace-nowrap">{label}</div>
    </div>
  )
}
