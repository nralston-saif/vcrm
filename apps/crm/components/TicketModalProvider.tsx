'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import TicketDetailModal from '@/app/tickets/TicketDetailModal'
import type { TicketStatus, TicketPriority } from '@/lib/types/database'

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

type TicketComment = {
  id: string
  ticket_id: string
  author_id: string
  content: string
  is_final_comment: boolean
  is_testing_comment: boolean
  is_reactivated_comment: boolean
  created_at: string
  updated_at: string
  author?: Partner | null
}

type Ticket = {
  id: string
  title: string
  description: string | null
  status: TicketStatus
  priority: TicketPriority
  due_date: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
  assigned_to: string | null
  created_by: string
  related_company: string | null
  related_person: string | null
  application_id: string | null
  tags: string[] | null
  was_unassigned_at_creation: boolean | null
  is_flagged: boolean
  source: 'partner' | 'founder_feedback'
  feedback_type: 'bug_report' | 'suggestion' | 'question' | null
  assigned_partner?: Partner | null
  creator?: Partner | null
  company?: Company | null
  person?: Person | null
  comments?: TicketComment[]
}

type TicketModalContextType = {
  openTicket: (ticketId: string) => void
  closeTicket: () => void
  isOpen: boolean
  setOnTicketUpdate?: (callback: ((ticketId: string, status: TicketStatus) => void) | null) => void
}

const TicketModalContext = createContext<TicketModalContextType | null>(null)

export function useTicketModal() {
  const context = useContext(TicketModalContext)
  if (!context) {
    throw new Error('useTicketModal must be used within a TicketModalProvider')
  }
  return context
}

export default function TicketModalProvider({ children }: { children: ReactNode }) {
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [partners, setPartners] = useState<Partner[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [currentUserName, setCurrentUserName] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [onTicketUpdateCallback, setOnTicketUpdateCallback] = useState<{ fn: ((ticketId: string, status: TicketStatus) => void) | null }>({ fn: null })

  const supabase = createClient()

  const openTicket = useCallback(async (ticketId: string) => {
    setLoading(true)
    setIsOpen(true)

    try {
      // Fetch current user info
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setIsOpen(false)
        return
      }

      const { data: profile } = await supabase
        .from('people')
        .select('id, first_name, last_name, name')
        .eq('auth_user_id', user.id)
        .single()

      if (profile) {
        setCurrentUserId(profile.id)
        setCurrentUserName(profile.name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'User')
      }

      // Fetch ticket with relationships
      const { data: ticketData, error: ticketError } = await supabase
        .from('tickets')
        .select(`
          *,
          assigned_partner:people!tickets_assigned_to_fkey(id, first_name, last_name, email, avatar_url),
          creator:people!tickets_created_by_fkey(id, first_name, last_name, email, avatar_url),
          company:companies!tickets_related_company_fkey(id, name, logo_url),
          person:people!tickets_related_person_fkey(id, first_name, last_name, email)
        `)
        .eq('id', ticketId)
        .single()

      if (ticketError || !ticketData) {
        console.error('Error fetching ticket:', ticketError)
        setIsOpen(false)
        return
      }

      // Fetch comments for the ticket
      const { data: commentsData } = await supabase
        .from('ticket_comments')
        .select(`
          *,
          author:people!ticket_comments_author_id_fkey(id, first_name, last_name, email, avatar_url)
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })

      // Fetch partners (for assignment dropdown)
      const { data: partnersData } = await supabase
        .from('people')
        .select('id, first_name, last_name, email, avatar_url')
        .eq('role', 'partner')
        .order('first_name')

      // Fetch companies (for linking)
      const { data: companiesData } = await supabase
        .from('companies')
        .select('id, name, logo_url')
        .order('name')
        .limit(500)

      // Fetch people (for linking)
      const { data: peopleData } = await supabase
        .from('people')
        .select('id, first_name, last_name, email')
        .order('first_name')
        .limit(500)

      setTicket({
        ...ticketData,
        comments: commentsData || [],
      } as Ticket)
      setPartners(partnersData || [])
      setCompanies(companiesData || [])
      setPeople(peopleData || [])
    } catch (error) {
      console.error('Error opening ticket:', error)
      setIsOpen(false)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const closeTicket = useCallback(() => {
    setIsOpen(false)
    setTicket(null)
  }, [])

  const handleUpdate = useCallback(async () => {
    // Refresh ticket data and notify callback
    if (ticket) {
      const ticketId = ticket.id

      // Fetch updated ticket to get current status (or check if deleted)
      const { data: updatedTicket, error } = await supabase
        .from('tickets')
        .select('id, status')
        .eq('id', ticketId)
        .single()

      // If ticket was deleted (not found), notify callback with 'archived' status to trigger removal
      if (error && error.code === 'PGRST116') {
        // Ticket was deleted
        if (onTicketUpdateCallback.fn) {
          onTicketUpdateCallback.fn(ticketId, 'archived' as TicketStatus)
        }
        return
      }

      // Notify callback with updated status
      if (onTicketUpdateCallback.fn && updatedTicket) {
        onTicketUpdateCallback.fn(updatedTicket.id, updatedTicket.status)
      }

      // Only refresh full ticket data if it's still open (not archived)
      // If archived or deleted, the modal should stay closed
      if (updatedTicket && updatedTicket.status !== 'archived') {
        openTicket(ticketId)
      }
    }
  }, [ticket, openTicket, onTicketUpdateCallback, supabase])

  const setOnTicketUpdate = useCallback((callback: ((ticketId: string, status: TicketStatus) => void) | null) => {
    setOnTicketUpdateCallback({ fn: callback })
  }, [])

  return (
    <TicketModalContext.Provider value={{ openTicket, closeTicket, isOpen, setOnTicketUpdate }}>
      {children}

      {/* Loading overlay */}
      {isOpen && loading && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
              <span className="text-gray-600">Loading ticket...</span>
            </div>
          </div>
        </div>
      )}

      {/* Ticket modal */}
      {isOpen && !loading && ticket && (
        <TicketDetailModal
          ticket={ticket}
          partners={partners}
          companies={companies}
          people={people}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onClose={closeTicket}
          onUpdate={handleUpdate}
        />
      )}
    </TicketModalContext.Provider>
  )
}
