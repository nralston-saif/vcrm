'use client'

import React, { useState, useEffect, useCallback, useRef, Component } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  RoomProvider,
  useOthers,
  useUpdateMyPresence,
  ClientSideSuspense,
  useSelf,
  useStorage,
  useMutation,
} from '@/lib/liveblocks'
import { CollaborativeTiptapEditor } from './CollaborativeTiptapEditor'

// ============================================================================
// HELPERS
// ============================================================================

// Check if content has actual text (handles both plain text and HTML)
function hasContent(content: string): boolean {
  if (!content || !content.trim()) return false
  // Strip HTML tags and check if any visible text remains
  const textOnly = content.replace(/<[^>]*>/g, '').trim()
  return textOnly.length > 0
}

// ============================================================================
// TYPES
// ============================================================================

// Context types for company-linked notes - matches database context_type
export type NoteContextType = 'deal' | 'portfolio' | 'person' | 'company'

// For general meeting notes (not company-specific)
export type MeetingNoteContext = {
  type: 'meeting'
  id: string  // meetingId
}

// For person-only notes (stored in people_notes, not company-linked)
export type PersonNoteContext = {
  type: 'person-only'
  id: string  // personId
}

// For company-linked notes (stored in company_notes)
export type CompanyNoteContext = {
  type: NoteContextType
  id: string  // applicationId, investmentId, personId, or companyId
  companyId: string  // Required: the company this note belongs to
}

export type NoteContext = CompanyNoteContext | MeetingNoteContext | PersonNoteContext

export type SavedNote = {
  id: string
  content: string
  meeting_date: string | null
  created_at: string
  updated_at?: string
  last_edited_by?: string
  last_edited_by_name?: string
  context_type?: NoteContextType | null
}

type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error'

type CollaborativeNoteEditorProps = {
  context: NoteContext
  userId: string
  userName: string
  showDatePicker?: boolean
  placeholder?: string
  minHeight?: string
  onNoteSaved?: () => void
  onCurrentNoteIdChange?: (noteId: string | null) => void
}

// ============================================================================
// PRESENCE & TYPING INDICATORS
// ============================================================================

function PresenceIndicators() {
  const others = useOthers()
  const typingUsers = others.filter((user) => user.presence.isTyping)

  return (
    <div className="flex flex-col gap-2">
      {/* Typing indicators */}
      {typingUsers.length > 0 && (
        <div className="text-sm text-gray-500 flex items-center gap-2">
          <span className="flex gap-1">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
          <span>
            {typingUsers.map((user) => user.presence.name || 'Someone').join(', ')}
            {typingUsers.length === 1 ? ' is' : ' are'} typing...
          </span>
        </div>
      )}

      {/* Connected users */}
      {others.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Also here:</span>
          <div className="flex -space-x-2">
            {others.slice(0, 5).map((user) => (
              <div
                key={user.connectionId}
                className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center ring-2 ring-white"
                title={user.presence.name || 'Anonymous'}
              >
                <span className="text-white text-xs font-medium">
                  {(user.presence.name || '?').charAt(0).toUpperCase()}
                </span>
              </div>
            ))}
            {others.length > 5 && (
              <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center ring-2 ring-white">
                <span className="text-gray-600 text-xs">+{others.length - 5}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// SAVE STATUS INDICATOR
// ============================================================================

function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {status === 'idle' && (
        <span className="text-gray-400">Ready</span>
      )}
      {status === 'unsaved' && (
        <>
          <span className="w-2 h-2 bg-yellow-500 rounded-full" />
          <span className="text-yellow-600">Unsaved changes</span>
        </>
      )}
      {status === 'saving' && (
        <>
          <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-blue-600">Saving...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-green-600">Saved</span>
        </>
      )}
      {status === 'error' && (
        <>
          <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span className="text-red-600">Error saving</span>
        </>
      )}
    </div>
  )
}

// ============================================================================
// MAIN EDITOR (INSIDE ROOM)
// ============================================================================

function EditorContent({
  context,
  userId,
  userName,
  showDatePicker = true,
  placeholder = "Type your notes here... Changes auto-save every 2 seconds.",
  minHeight = '300px',
  onNoteSaved,
  onCurrentNoteIdChange,
}: CollaborativeNoteEditorProps) {
  const supabase = createClient()
  const updateMyPresence = useUpdateMyPresence()

  // Local content state - Yjs handles real-time sync, this is for database saving
  const [content, setContent] = useState('')

  // Shared state via Liveblocks storage - all collaborators see the same note ID
  const sharedNoteId = useStorage((root) => root.sharedNoteId)
  const storedMeetingDate = useStorage((root) => root.meetingDate)
  const creatingNoteBy = useStorage((root) => root.creatingNoteBy)

  // Local state for UI
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [isInitialized, setIsInitialized] = useState(false)
  const [clearTrigger, setClearTrigger] = useState(0)

  // Refs for save coordination
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedContentRef = useRef<string>('')
  const isSavingRef = useRef(false)

  // Mutations to update shared storage
  const setSharedNoteId = useMutation(({ storage }, noteId: string | null) => {
    storage.set('sharedNoteId', noteId)
  }, [])

  const setStoredMeetingDate = useMutation(({ storage }, date: string) => {
    storage.set('meetingDate', date)
  }, [])

  // Atomic mutation to claim creation lock - returns true if we got the lock
  const tryClaimCreationLock = useMutation(({ storage }, claimingUserId: string): boolean => {
    const currentLock = storage.get('creatingNoteBy')
    const currentNoteId = storage.get('sharedNoteId')

    // If there's already a note ID, no need to create
    if (currentNoteId) return false

    // If someone else is already creating, don't proceed
    if (currentLock && currentLock !== claimingUserId) return false

    // Claim the lock
    storage.set('creatingNoteBy', claimingUserId)
    return true
  }, [])

  // Release creation lock after note is created
  const releaseCreationLock = useMutation(({ storage }, noteId: string) => {
    storage.set('sharedNoteId', noteId)
    storage.set('creatingNoteBy', null)
  }, [])

  // Use stored meeting date or default to today
  const meetingDate = storedMeetingDate || new Date().toISOString().split('T')[0]
  const setMeetingDate = useCallback((date: string) => {
    setStoredMeetingDate(date)
  }, [setStoredMeetingDate])

  // Set initial presence
  useEffect(() => {
    updateMyPresence({ name: userName, isTyping: false, cursor: null })
  }, [userName, updateMyPresence])

  // Notify parent when current note ID changes (so it can be excluded from list)
  useEffect(() => {
    onCurrentNoteIdChange?.(sharedNoteId)
  }, [sharedNoteId, onCurrentNoteIdChange])

  // Mark as initialized immediately - the Yjs document is the source of truth
  // for any in-progress draft. Saved notes appear in the Previous Notes list below.
  useEffect(() => {
    setIsInitialized(true)
  }, [context.id, context.type])

  // Reset meeting date to today when there's no active note being edited
  // This prevents stale dates from previous sessions persisting in Liveblocks storage
  useEffect(() => {
    if (!sharedNoteId && storedMeetingDate) {
      const today = new Date().toISOString().split('T')[0]
      if (storedMeetingDate !== today) {
        setStoredMeetingDate(today)
      }
    }
  }, [sharedNoteId, storedMeetingDate, setStoredMeetingDate])

  // Auto-save with debounce - triggered by content changes
  useEffect(() => {
    if (!isInitialized) return

    // Nothing to save - empty content should never trigger a save
    // This prevents blank notes being created when Save & New clears the editor
    if (!hasContent(content)) {
      setSaveStatus('idle')
      return
    }

    // Content unchanged from last save
    if (content.trim() === lastSavedContentRef.current) {
      setSaveStatus('saved')
      return
    }

    setSaveStatus('unsaved')

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Set new save timeout
    saveTimeoutRef.current = setTimeout(() => {
      saveNote(content.trim())
    }, 2000)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [content, isInitialized, sharedNoteId, meetingDate])

  // Save note function with conflict prevention
  const saveNote = async (content: string) => {
    // Never save empty content
    if (!hasContent(content)) return

    // Prevent concurrent saves
    if (isSavingRef.current) return
    isSavingRef.current = true

    setSaveStatus('saving')

    try {
      if (sharedNoteId) {
        // Update existing shared note
        let error: Error | null = null

        if (context.type === 'meeting') {
          // Meeting notes use the separate meeting notes table
          const result = await supabase
            .from('meeting_notes')
            .update({ content })
            .eq('id', sharedNoteId)
          error = result.error
        } else if (context.type === 'person-only') {
          // Person-only notes use the people notes table
          const result = await supabase
            .from('people_notes')
            .update({ content, meeting_date: meetingDate })
            .eq('id', sharedNoteId)
          error = result.error
        } else {
          // Company-linked notes use the unified company notes table
          const result = await supabase
            .from('company_notes')
            .update({ content, meeting_date: meetingDate, user_id: userId })
            .eq('id', sharedNoteId)
          error = result.error
        }

        if (error) throw error
      } else if (content) {
        // Try to claim the creation lock to prevent duplicate notes
        const gotLock = tryClaimCreationLock(userId)
        if (!gotLock) {
          // Another user is already creating a note, wait for sharedNoteId to sync
          isSavingRef.current = false
          setSaveStatus('unsaved')
          return
        }

        // Create new shared note
        let newNoteId: string | null = null
        let error: Error | null = null

        if (context.type === 'meeting') {
          // Meeting notes use the separate meeting notes table
          const result = await supabase
            .from('meeting_notes')
            .insert({ meeting_id: context.id, content, author_id: userId })
            .select('id')
            .single()
          error = result.error
          newNoteId = result.data?.id || null
        } else if (context.type === 'person-only') {
          // Person-only notes use the people notes table
          const result = await supabase
            .from('people_notes')
            .insert({
              person_id: context.id,
              content,
              meeting_date: meetingDate,
              user_id: userId,
            })
            .select('id')
            .single()
          error = result.error
          newNoteId = result.data?.id || null
        } else {
          // Company-linked notes use the unified company notes table
          // context is CompanyNoteContext here (has companyId)
          const companyContext = context as CompanyNoteContext
          const result = await supabase
            .from('company_notes')
            .insert({
              company_id: companyContext.companyId,
              content,
              meeting_date: meetingDate,
              user_id: userId,
              context_type: companyContext.type,
              context_id: companyContext.type === 'company' ? null : companyContext.id,
            })
            .select('id')
            .single()
          error = result.error
          newNoteId = result.data?.id || null
        }

        if (error) throw error
        if (newNoteId) {
          // Release lock and set the shared note ID atomically
          releaseCreationLock(newNoteId)
        }
      }

      lastSavedContentRef.current = content
      setSaveStatus('saved')
      // Don't call onNoteSaved here - only call it from handleSaveAndStartNew
      // This keeps the note in the editor until explicitly saved and started new

    } catch (error) {
      console.error('Error saving note:', error)
      setSaveStatus('error')
    } finally {
      isSavingRef.current = false
    }
  }

  // Handle content change from Tiptap editor
  const handleContentChange = useCallback((value: string) => {
    setContent(value)
    // Typing presence is now handled by the Tiptap editor itself
  }, [])

  const handleBlur = useCallback(() => {
    updateMyPresence({ isTyping: false })
  }, [updateMyPresence])

  // Mutation to reset all shared state for a new note
  const resetSharedState = useMutation(({ storage }) => {
    storage.set('sharedNoteId', null)
    storage.set('creatingNoteBy', null)
    storage.set('meetingDate', new Date().toISOString().split('T')[0])
  }, [])

  // Save current note and start a fresh one
  const handleSaveAndStartNew = useCallback(async () => {
    const trimmedContent = content.trim()

    // If there's content, make sure it's saved first
    if (hasContent(trimmedContent) && trimmedContent !== lastSavedContentRef.current) {
      await saveNote(trimmedContent)
    }

    // Only start new if there was actually content
    if (hasContent(trimmedContent)) {
      // Clear the local content
      setContent('')

      // Clear the Tiptap editor (this will sync to all users via Yjs)
      setClearTrigger(prev => prev + 1)

      // Reset all shared state atomically for a new note (syncs to all users via Liveblocks)
      resetSharedState()
      lastSavedContentRef.current = ''
      setSaveStatus('idle')

      // Trigger refresh of notes list
      onNoteSaved?.()
    }
  }, [content, onNoteSaved, saveNote, resetSharedState])

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      {/* Header with date picker and status */}
      <div className="flex items-center gap-4 mb-4">
        {showDatePicker && (
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meeting Date
            </label>
            <input
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="input"
            />
          </div>
        )}
        <div className={`flex items-center gap-3 ${showDatePicker ? 'pt-6' : ''}`}>
          <SaveStatusIndicator status={saveStatus} />
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-gray-500">Live sync</span>
          </div>
          {hasContent(content) && (
            <button
              onClick={handleSaveAndStartNew}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              title="Save this note and start a new one"
            >
              Save & New
            </button>
          )}
        </div>
      </div>

      {/* Collaborative Tiptap editor with Yjs */}
      <CollaborativeTiptapEditor
        onContentChange={handleContentChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        minHeight={minHeight}
        clearTrigger={clearTrigger}
      />

      {/* Presence indicators */}
      <div className="mt-3">
        <PresenceIndicators />
      </div>
    </div>
  )
}

// ============================================================================
// ERROR BOUNDARY FOR LIVEBLOCKS
// ============================================================================

type ErrorBoundaryProps = {
  children: React.ReactNode
  fallback: React.ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
}

class LiveblocksErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Liveblocks] Error in collaborative editor:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

// ============================================================================
// ROOM WRAPPER
// ============================================================================

function EditorWithRoom(props: CollaborativeNoteEditorProps) {
  const roomId = `notes-${props.context.type}-${props.context.id}`

  return (
    <LiveblocksErrorBoundary fallback={<EditorWithoutLiveblocks {...props} />}>
      <RoomProvider
        id={roomId}
        initialPresence={{ cursor: null, name: props.userName, isTyping: false }}
        initialStorage={{ draft: '', sharedNoteId: null, meetingDate: new Date().toISOString().split('T')[0], creatingNoteBy: null }}
      >
        <ClientSideSuspense fallback={
          <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
            <div className="h-10 bg-gray-200 rounded mb-4 w-1/3" />
            <div className="h-32 bg-gray-200 rounded" />
          </div>
        }>
          {() => <EditorContent {...props} />}
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksErrorBoundary>
  )
}

// ============================================================================
// FALLBACK WITHOUT LIVEBLOCKS
// ============================================================================

function EditorWithoutLiveblocks({
  context,
  userId,
  userName,
  showDatePicker = true,
  placeholder = "Type your notes here... Changes auto-save every 2 seconds.",
  minHeight = '300px',
  onNoteSaved,
  onCurrentNoteIdChange,
}: CollaborativeNoteEditorProps) {
  const supabase = createClient()

  const [content, setContent] = useState('')
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().split('T')[0])
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [sharedNoteId, setSharedNoteId] = useState<string | null>(null)

  const contentRef = useRef('')
  const lastSavedContentRef = useRef('')

  // Notify parent when current note ID changes (so it can be excluded from list)
  useEffect(() => {
    onCurrentNoteIdChange?.(sharedNoteId)
  }, [sharedNoteId, onCurrentNoteIdChange])

  // Editor starts fresh - saved notes appear in the Previous Notes list below
  // No need to load existing notes into the editor

  // Auto-save
  useEffect(() => {
    const trimmedContent = content.trim()

    if (!trimmedContent && !sharedNoteId) {
      setSaveStatus('idle')
      return
    }

    if (trimmedContent === lastSavedContentRef.current) {
      setSaveStatus('saved')
      return
    }

    setSaveStatus('unsaved')
    contentRef.current = content

    const timer = setTimeout(async () => {
      await saveNote()
    }, 2000)

    return () => clearTimeout(timer)
  }, [content, meetingDate])

  const saveNote = async () => {
    const noteContent = contentRef.current.trim()
    if (!noteContent && !sharedNoteId) return

    setSaveStatus('saving')

    try {
      if (sharedNoteId) {
        // Update existing note
        let error: Error | null = null

        if (context.type === 'meeting') {
          // Meeting notes use the separate meeting notes table
          const result = await supabase
            .from('meeting_notes')
            .update({ content: noteContent })
            .eq('id', sharedNoteId)
          error = result.error
        } else if (context.type === 'person-only') {
          // Person-only notes use the people notes table
          const result = await supabase
            .from('people_notes')
            .update({ content: noteContent, meeting_date: meetingDate })
            .eq('id', sharedNoteId)
          error = result.error
        } else {
          // Company-linked notes use the unified company notes table
          const result = await supabase
            .from('company_notes')
            .update({ content: noteContent, meeting_date: meetingDate, user_id: userId })
            .eq('id', sharedNoteId)
          error = result.error
        }

        if (error) throw error
      } else if (noteContent) {
        // Create new note
        let newNoteId: string | null = null
        let error: Error | null = null

        if (context.type === 'meeting') {
          // Meeting notes use the separate meeting notes table
          const result = await supabase
            .from('meeting_notes')
            .insert({ meeting_id: context.id, content: noteContent, author_id: userId })
            .select('id')
            .single()
          error = result.error
          newNoteId = result.data?.id || null
        } else if (context.type === 'person-only') {
          // Person-only notes use the people notes table
          const result = await supabase
            .from('people_notes')
            .insert({
              person_id: context.id,
              content: noteContent,
              meeting_date: meetingDate,
              user_id: userId,
            })
            .select('id')
            .single()
          error = result.error
          newNoteId = result.data?.id || null
        } else {
          // Company-linked notes use the unified company notes table
          const companyContext = context as CompanyNoteContext
          const result = await supabase
            .from('company_notes')
            .insert({
              company_id: companyContext.companyId,
              content: noteContent,
              meeting_date: meetingDate,
              user_id: userId,
              context_type: companyContext.type,
              context_id: companyContext.type === 'company' ? null : companyContext.id,
            })
            .select('id')
            .single()
          error = result.error
          newNoteId = result.data?.id || null
        }

        if (error) throw error
        if (newNoteId) {
          setSharedNoteId(newNoteId)
        }
      }

      lastSavedContentRef.current = noteContent
      setSaveStatus('saved')
      // Don't call onNoteSaved here - only call it from handleSaveAndStartNew
      // This keeps the note in the editor until explicitly saved and started new
    } catch (error) {
      console.error('Error saving note:', error)
      setSaveStatus('error')
    }
  }

  // Save current note and start a fresh one
  const handleSaveAndStartNew = async () => {
    const noteContent = content.trim()

    // If there's content, make sure it's saved first
    if (noteContent && noteContent !== lastSavedContentRef.current) {
      await saveNote()
    }

    // Only start new if there was actually content
    if (noteContent) {
      // Reset state for a new note
      setContent('')
      setSharedNoteId(null)
      setMeetingDate(new Date().toISOString().split('T')[0])
      contentRef.current = ''
      lastSavedContentRef.current = ''
      setSaveStatus('idle')

      // Trigger refresh of notes list
      onNoteSaved?.()
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-4 mb-4">
        {showDatePicker && (
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meeting Date
            </label>
            <input
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="input"
            />
          </div>
        )}
        <div className={`flex items-center gap-3 ${showDatePicker ? 'pt-6' : ''}`}>
          <SaveStatusIndicator status={saveStatus} />
          {content.trim() && (
            <button
              onClick={handleSaveAndStartNew}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              title="Save this note and start a new one"
            >
              Save & New
            </button>
          )}
        </div>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          // Handle Tab key for indentation
          if (e.key === 'Tab') {
            e.preventDefault()
            const target = e.target as HTMLTextAreaElement
            const start = target.selectionStart
            const end = target.selectionEnd
            const newValue = content.substring(0, start) + '\t' + content.substring(end)
            setContent(newValue)
            // Move cursor after inserted tab
            requestAnimationFrame(() => {
              target.selectionStart = target.selectionEnd = start + 1
            })
          }
        }}
        rows={12}
        className="input resize-y w-full"
        style={{ minHeight }}
        placeholder={placeholder}
      />
    </div>
  )
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export default function CollaborativeNoteEditor(props: CollaborativeNoteEditorProps) {
  const hasLiveblocks = !!process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY

  if (!hasLiveblocks) {
    return <EditorWithoutLiveblocks {...props} />
  }

  return <EditorWithRoom {...props} />
}
