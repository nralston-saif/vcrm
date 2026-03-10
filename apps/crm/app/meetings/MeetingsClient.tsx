'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RoomProvider, useOthers, ClientSideSuspense, useStatus } from '@/lib/liveblocks'
import { CollaborativeTiptapEditor } from '@/components/collaborative'
import type { Meeting, Person, Company, TicketStatus, TicketPriority } from '@vcrm/supabase'
import { useToast } from '@vcrm/ui'
import TagSelector from '../tickets/TagSelector'

// ============================================================================
// TYPES
// ============================================================================

type MeetingsClientProps = {
  meetings: Meeting[]
  currentUser: Person
  partners: Person[]
}

type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error'

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split('T')[0].split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatMeetingDate(dateString: string): string {
  const [year, month, day] = dateString.split('T')[0].split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function getPersonName(person: Person): string {
  if (person.first_name && person.last_name) {
    return `${person.first_name} ${person.last_name}`
  }
  return person.email || 'Unknown'
}

function getTodayLocalDate(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ============================================================================
// SAVE STATUS INDICATOR
// ============================================================================

function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null

  const config = {
    saved: { text: 'Saved', color: 'text-green-600', prefix: '\u2713 ' },
    saving: { text: 'Saving...', color: 'text-blue-600', prefix: '' },
    error: { text: 'Error saving', color: 'text-red-600', prefix: '\u26A0 ' },
    unsaved: { text: 'Unsaved changes', color: 'text-gray-500', prefix: '' },
  }[status]

  if (!config) return null

  return (
    <span className={`text-xs ${config.color}`}>
      {config.prefix}{config.text}
    </span>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MeetingsClient({ meetings, currentUser, partners }: MeetingsClientProps) {
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(meetings[0] || null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showTicketModal, setShowTicketModal] = useState(false)
  const [meetingsList, setMeetingsList] = useState<Meeting[]>(meetings)
  const [companies, setCompanies] = useState<Company[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [meetingToDelete, setMeetingToDelete] = useState<Meeting | null>(null)

  const supabase = createClient()
  const hasLiveblocks = !!process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY

  // Fetch meetings with full content
  useEffect(() => {
    async function fetchMeetings(): Promise<void> {
      const { data } = await supabase
        .from('meetings')
        .select('id, title, meeting_date, content, created_by, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(100)

      if (data) {
        setMeetingsList(data as Meeting[])
      }
    }
    fetchMeetings()
  }, [supabase])

  // Fetch companies and people for ticket creation
  useEffect(() => {
    async function fetchData(): Promise<void> {
      const [companiesResult, peopleResult] = await Promise.all([
        supabase.from('companies').select('id, name, logo_url').order('name'),
        supabase.from('people').select('id, first_name, last_name, email').in('status', ['active', 'eligible']).order('first_name'),
      ])

      if (companiesResult.data) setCompanies(companiesResult.data as Company[])
      if (peopleResult.data) setPeople(peopleResult.data as Person[])
    }
    fetchData()
  }, [supabase])

  // Subscribe to meeting changes
  useEffect(() => {
    const channel = supabase
      .channel('meetings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings' }, async (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const { data } = await supabase
            .from('meetings')
            .select('id, title, meeting_date, content, created_by, created_at, updated_at')
            .eq('id', payload.new.id)
            .single()

          if (data) {
            if (payload.eventType === 'INSERT') {
              setMeetingsList((prev) => [data as Meeting, ...prev])
            } else {
              setMeetingsList((prev) => prev.map((m) => (m.id === data.id ? (data as Meeting) : m)))
              setSelectedMeeting((prev) => prev?.id === data.id ? (data as Meeting) : prev)
            }
          }
        } else if (payload.eventType === 'DELETE') {
          setMeetingsList((prev) => prev.filter((m) => m.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  function handleContentSaved(meetingId: string, content: string): void {
    setMeetingsList((prev) => prev.map((m) => (m.id === meetingId ? { ...m, content } : m)))
  }

  function handleTitleSaved(meetingId: string, title: string): void {
    setMeetingsList((prev) => prev.map((m) => (m.id === meetingId ? { ...m, title } : m)))
    if (selectedMeeting?.id === meetingId) {
      setSelectedMeeting((prev) => prev ? { ...prev, title } : null)
    }
  }

  async function handleDeleteMeeting(): Promise<void> {
    if (!meetingToDelete) return

    const meetingId = meetingToDelete.id
    setMeetingsList((prev) => prev.filter((m) => m.id !== meetingId))
    if (selectedMeeting?.id === meetingId) {
      setSelectedMeeting(meetingsList.find((m) => m.id !== meetingId) || null)
    }
    setMeetingToDelete(null)

    const { error } = await supabase.from('meetings').delete().eq('id', meetingId)
    if (error) {
      console.error('Error deleting meeting:', error)
      setMeetingsList(meetings)
    }
  }

  const filteredMeetings = meetingsList.filter((meeting) => {
    if (!searchTerm.trim()) return true
    const search = searchTerm.toLowerCase()
    return meeting.title.toLowerCase().includes(search) || (meeting.content && meeting.content.toLowerCase().includes(search))
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Meetings</h1>
          <p className="mt-1 text-gray-500">Shared notes and collaboration</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowTicketModal(true)}
            className="px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base"
          >
            + Create Ticket
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            + New Meeting
          </button>
        </div>
      </div>

      {meetingsList.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="flex justify-center mb-4">
            <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No meetings yet</h3>
          <p className="text-gray-500">Create a meeting to start taking collaborative notes.</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Meetings List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">All Meetings</h2>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search meetings..."
                  className="w-full px-3 py-2 pl-9 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
                />
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            <div className="divide-y divide-gray-100 max-h-[calc(100vh-300px)] overflow-y-auto">
              {filteredMeetings.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-gray-500 text-sm">{searchTerm.trim() ? 'No meetings found' : 'No meetings yet'}</p>
                  <p className="text-gray-400 text-xs mt-1">{searchTerm.trim() ? 'Try a different search term' : 'Create one to get started'}</p>
                </div>
              ) : (
                filteredMeetings.map((meeting) => (
                  <MeetingListItem
                    key={meeting.id}
                    meeting={meeting}
                    isSelected={selectedMeeting?.id === meeting.id}
                    onSelect={() => setSelectedMeeting(meeting)}
                    onDelete={() => setMeetingToDelete(meeting)}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Meeting Notes Area */}
        <div className="lg:col-span-3">
          {selectedMeeting ? (
            hasLiveblocks ? (
              <LiveblocksWrapper
                key={selectedMeeting.id}
                meeting={selectedMeeting}
                currentUser={currentUser}
                partners={partners}
                onContentSaved={handleContentSaved}
                onTitleSaved={handleTitleSaved}
              />
            ) : (
              <SimpleMeetingEditor
                meeting={selectedMeeting}
                onContentSaved={handleContentSaved}
                onTitleSaved={handleTitleSaved}
              />
            )
          ) : (
            <EmptyMeetingState />
          )}
        </div>
      </div>
      )}

      {showCreateModal && (
        <CreateMeetingModal
          onClose={() => setShowCreateModal(false)}
          currentUserId={currentUser.id}
          onMeetingCreated={(meeting) => {
            setMeetingsList([meeting, ...meetingsList])
            setSelectedMeeting(meeting)
            setShowCreateModal(false)
          }}
        />
      )}

      {showTicketModal && (
        <QuickTicketModal
          onClose={() => setShowTicketModal(false)}
          currentUserId={currentUser.id}
          partners={partners}
          companies={companies}
          people={people}
        />
      )}

      {meetingToDelete && (
        <DeleteMeetingModal
          meeting={meetingToDelete}
          onClose={() => setMeetingToDelete(null)}
          onConfirm={handleDeleteMeeting}
        />
      )}
    </div>
  )
}

// ============================================================================
// MEETING LIST ITEM
// ============================================================================

function MeetingListItem({
  meeting,
  isSelected,
  onSelect,
  onDelete,
}: {
  meeting: Meeting
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  return (
    <div className={`relative group ${isSelected ? 'bg-gray-50 border-l-4 border-black' : ''}`}>
      <button onClick={onSelect} className="w-full text-left p-4 hover:bg-gray-50 transition-colors">
        <h3 className="font-medium text-gray-900 text-sm truncate pr-8">{meeting.title}</h3>
        <p className="text-xs text-gray-500 mt-1">{formatDate(meeting.meeting_date)}</p>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all"
        title="Delete meeting"
      >
        <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  )
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function EmptyMeetingState() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-gray-400 text-2xl">&#x1F4DD;</span>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Meeting Selected</h3>
      <p className="text-gray-500">Select a meeting from the list or create a new one</p>
    </div>
  )
}

// ============================================================================
// LIVEBLOCKS WRAPPER
// ============================================================================

function LiveblocksWrapper({
  meeting,
  currentUser,
  partners,
  onContentSaved,
  onTitleSaved,
}: {
  meeting: Meeting
  currentUser: Person
  partners: Person[]
  onContentSaved: (meetingId: string, content: string) => void
  onTitleSaved: (meetingId: string, newTitle: string) => void
}) {
  const [hasTimedOut, setHasTimedOut] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (isConnected) return

    timeoutRef.current = setTimeout(() => {
      if (!isConnected) {
        setHasTimedOut(true)
      }
    }, 15000)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [meeting.id, isConnected])

  function handleConnected(): void {
    setIsConnected(true)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  if (hasTimedOut) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="text-center mb-4">
          <p className="text-amber-600 mb-2">Real-time collaboration is taking longer than expected to connect.</p>
          <p className="text-gray-500 text-sm">You can continue editing without real-time sync:</p>
        </div>
        <SimpleMeetingEditor meeting={meeting} onContentSaved={onContentSaved} onTitleSaved={onTitleSaved} />
      </div>
    )
  }

  const userName = currentUser.name || `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || 'Unknown'

  return (
    <RoomProvider
      id={`notes-meeting-${meeting.id}`}
      initialPresence={{ cursor: null, name: userName, isTyping: false }}
      initialStorage={{ draft: '', sharedNoteId: null, meetingDate: getTodayLocalDate(), creatingNoteBy: null }}
    >
      <ClientSideSuspense
        fallback={
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-black rounded-full" />
              <span className="text-gray-600">Connecting to real-time collaboration...</span>
            </div>
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
              <div className="h-64 bg-gray-200 rounded" />
            </div>
          </div>
        }
      >
        {() => (
          <MeetingNotesEditor
            meeting={meeting}
            currentUser={currentUser}
            partners={partners}
            onContentSaved={onContentSaved}
            onTitleSaved={onTitleSaved}
            onConnected={handleConnected}
          />
        )}
      </ClientSideSuspense>
    </RoomProvider>
  )
}

// ============================================================================
// EDITABLE TITLE COMPONENT
// ============================================================================

function EditableTitle({
  title,
  meetingId,
  onTitleSaved,
}: {
  title: string
  meetingId: string
  onTitleSaved: (meetingId: string, newTitle: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(title)
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()
  const { showToast } = useToast()

  useEffect(() => {
    setEditValue(title)
  }, [title])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  async function handleSave(): Promise<void> {
    const trimmedValue = editValue.trim()
    if (!trimmedValue) {
      setEditValue(title)
      setIsEditing(false)
      return
    }

    if (trimmedValue === title) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    const { error } = await supabase
      .from('meetings')
      .update({ title: trimmedValue })
      .eq('id', meetingId)

    setIsSaving(false)

    if (error) {
      console.error('Error updating title:', error)
      showToast('Failed to update title', 'error')
      setEditValue(title)
    } else {
      onTitleSaved(meetingId, trimmedValue)
    }
    setIsEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      setEditValue(title)
      setIsEditing(false)
    }
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        disabled={isSaving}
        className="text-xl font-semibold text-gray-900 bg-transparent border-b-2 border-gray-300 focus:border-black focus:outline-none w-full max-w-md"
      />
    )
  }

  return (
    <h2
      onClick={() => setIsEditing(true)}
      className="text-xl font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 px-1 -mx-1 rounded transition-colors"
      title="Click to edit title"
    >
      {title}
    </h2>
  )
}

// ============================================================================
// MEETING NOTES EDITOR (COLLABORATIVE)
// ============================================================================

function MeetingNotesEditor({
  meeting,
  currentUser,
  partners,
  onContentSaved,
  onTitleSaved,
  onConnected,
}: {
  meeting: Meeting
  currentUser: Person
  partners: Person[]
  onContentSaved: (meetingId: string, content: string) => void
  onTitleSaved: (meetingId: string, newTitle: string) => void
  onConnected?: () => void
}) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)

  const supabase = createClient()
  const others = useOthers()

  useEffect(() => {
    onConnected?.()
  }, [onConnected])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  function handleContentChange(content: string): void {
    setSaveStatus('unsaved')

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving')

      const { error } = await supabase.from('meetings').update({ content }).eq('id', meeting.id)

      if (error) {
        console.error('Error saving content:', error)
        setSaveStatus('error')
      } else {
        onContentSaved(meeting.id, content)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      }
    }, 2000)
  }

  const typingUsers = others
    .filter((other) => other.presence.isTyping)
    .map((other) => other.presence.name || 'Someone')

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <EditableTitle
              title={meeting.title}
              meetingId={meeting.id}
              onTitleSaved={onTitleSaved}
            />
            <p className="text-sm text-gray-500 mt-1">{formatMeetingDate(meeting.meeting_date)}</p>
          </div>
          <div className="flex items-center gap-3">
            {others.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Also here:</span>
                <div className="flex -space-x-2">
                  {others.slice(0, 5).map((other) => (
                    <div
                      key={other.connectionId}
                      className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center ring-2 ring-white"
                      title={other.presence.name || 'Anonymous'}
                    >
                      <span className="text-white text-xs font-medium">
                        {(other.presence.name || '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  ))}
                  {others.length > 5 && (
                    <div className="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center ring-2 ring-white">
                      <span className="text-gray-600 text-xs">+{others.length - 5}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {typingUsers.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <div className="flex gap-0.5">
                  <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span>{typingUsers.join(', ')} typing...</span>
              </div>
            )}
            <SaveStatusIndicator status={saveStatus} />
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        <CollaborativeTiptapEditor
          onContentChange={handleContentChange}
          placeholder="Start typing your meeting notes here... Everyone can edit this document together in real-time!"
          minHeight="400px"
        />
      </div>
    </div>
  )
}

// ============================================================================
// SIMPLE MEETING EDITOR (FALLBACK)
// ============================================================================

function SimpleMeetingEditor({
  meeting,
  onContentSaved,
  onTitleSaved,
}: {
  meeting: Meeting
  onContentSaved: (meetingId: string, content: string) => void
  onTitleSaved: (meetingId: string, newTitle: string) => void
}) {
  const [content, setContent] = useState(meeting.content || '')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)

  const supabase = createClient()

  useEffect(() => {
    setContent(meeting.content || '')
    setSaveStatus('idle')
  }, [meeting.id, meeting.content])

  useEffect(() => {
    if (content === meeting.content) return

    setSaveStatus('unsaved')

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving')

      const { error } = await supabase.from('meetings').update({ content }).eq('id', meeting.id)

      if (error) {
        console.error('Error saving:', error)
        setSaveStatus('error')
      } else {
        onContentSaved(meeting.id, content)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      }
    }, 2000)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [content, meeting.id, meeting.content, supabase, onContentSaved])

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <EditableTitle
              title={meeting.title}
              meetingId={meeting.id}
              onTitleSaved={onTitleSaved}
            />
            <p className="text-sm text-gray-500 mt-1">{formatMeetingDate(meeting.meeting_date)}</p>
          </div>
          <SaveStatusIndicator status={saveStatus} />
        </div>
      </div>
      <div className="flex-1 p-6 overflow-auto">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Start typing your meeting notes here..."
          className="w-full min-h-[300px] px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent resize-y font-mono text-sm"
        />
      </div>
    </div>
  )
}

// ============================================================================
// CREATE MEETING MODAL
// ============================================================================

function CreateMeetingModal({
  onClose,
  currentUserId,
  onMeetingCreated,
}: {
  onClose: () => void
  currentUserId: string
  onMeetingCreated: (meeting: Meeting) => void
}) {
  const [title, setTitle] = useState('')
  const [meetingDate, setMeetingDate] = useState(getTodayLocalDate())
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!title.trim()) return

    setIsSubmitting(true)

    const { data, error } = await supabase
      .from('meetings')
      .insert({ title: title.trim(), meeting_date: meetingDate, created_by: currentUserId })
      .select()
      .single()

    if (error) {
      console.error('Error creating meeting:', error)
      setIsSubmitting(false)
      return
    }

    onMeetingCreated(data as Meeting)
    setIsSubmitting(false)
  }

  return (
    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.3)] z-50 border-2 border-gray-200">
      <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">New Meeting</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100" disabled={isSubmitting}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Weekly Partner Sync"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
            required
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
            required
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors text-sm"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-3 py-1.5 bg-black text-white rounded-lg hover:bg-gray-800 font-medium transition-colors disabled:opacity-50 text-sm"
            disabled={isSubmitting || !title.trim()}
          >
            {isSubmitting ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ============================================================================
// DELETE MEETING MODAL
// ============================================================================

function DeleteMeetingModal({
  meeting,
  onClose,
  onConfirm,
}: {
  meeting: Meeting
  onClose: () => void
  onConfirm: () => void
}) {
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleConfirm(): Promise<void> {
    setIsDeleting(true)
    await onConfirm()
  }

  return (
    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.3)] z-50 border-2 border-gray-200">
      <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-gray-900">Delete Meeting</h2>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100" disabled={isDeleting}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4">
        <p className="text-gray-700 text-sm mb-4">
          Are you sure you want to delete <span className="font-medium">"{meeting.title}"</span>? This cannot be undone.
        </p>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors text-sm"
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50 text-sm"
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// QUICK TICKET MODAL
// ============================================================================

function QuickTicketModal({
  onClose,
  currentUserId,
  partners,
  companies,
  people,
}: {
  onClose: () => void
  currentUserId: string
  partners: Person[]
  companies: Company[]
  people: Person[]
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

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()

    if (!formData.title.trim()) {
      showToast('Title is required', 'error')
      return
    }

    setLoading(true)

    const { error } = await supabase.from('tickets').insert({
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
    })

    setLoading(false)

    if (error) {
      showToast('Failed to create ticket', 'error')
      console.error(error)
    } else {
      showToast('Ticket created successfully', 'success')
      onClose()
    }
  }

  return (
    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.3)] z-50 max-h-[85vh] overflow-y-auto border-2 border-gray-200">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between rounded-t-xl">
        <h2 className="text-base font-semibold text-gray-900">Quick Ticket</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-3">
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
            rows={2}
            placeholder="Add details..."
          />
        </div>

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
            <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
            <select
              value={formData.assigned_to}
              onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
            >
              <option value="">Unassigned</option>
              {partners.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {getPersonName(partner)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Related Company</label>
            <select
              value={formData.related_company}
              onChange={(e) => setFormData({ ...formData, related_company: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
            >
              <option value="">None</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Related Person</label>
            <select
              value={formData.related_person}
              onChange={(e) => setFormData({ ...formData, related_person: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
            >
              <option value="">None</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {getPersonName(person)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
          <TagSelector
            selectedTags={formData.tags}
            onChange={(tags) => setFormData({ ...formData, tags })}
            currentUserId={currentUserId}
          />
        </div>

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
  )
}
