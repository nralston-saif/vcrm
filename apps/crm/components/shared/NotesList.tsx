'use client'

import { useState, useEffect, useCallback } from 'react'
import DOMPurify from 'dompurify'
import { createClient } from '@/lib/supabase/client'
import DeleteNoteModal from '../DeleteNoteModal'
import EditNoteModal from '../EditNoteModal'

// ============================================================================
// TYPES
// ============================================================================

export type NoteContextType = 'deal' | 'portfolio' | 'person' | 'company'

type BaseNote = {
  id: string
  company_id?: string
  person_id?: string
  user_id: string
  content: string
  meeting_date: string
  context_type: NoteContextType | null
  context_id: string | null
  created_at: string
  updated_at?: string | null
  user_name?: string
}

// For company-linked notes (deal, portfolio, company pages)
type CompanyNotesListProps = {
  mode?: 'company'  // Default mode
  companyId: string  // Required: fetch all notes for this company
  personId?: never
  refreshTrigger: number
  excludeNoteId?: string | null
  deliberationNotes?: string | null
  showHeader?: boolean
  filterByContext?: NoteContextType
}

// For person-only notes (people page)
type PersonNotesListProps = {
  mode: 'person-only'
  personId: string  // Required: fetch notes for this person
  companyId?: never
  refreshTrigger: number
  excludeNoteId?: string | null
  deliberationNotes?: string | null
  showHeader?: boolean
  filterByContext?: never
}

type NotesListProps = CompanyNotesListProps | PersonNotesListProps

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getAuthorName(author: { name?: string; first_name?: string; last_name?: string } | null): string {
  if (!author) return 'Unknown'
  if (author.first_name && author.last_name) {
    return `${author.first_name} ${author.last_name}`
  }
  return author.name || 'Unknown'
}

function groupNotesByDate<T extends { meeting_date: string }>(notes: T[]): Record<string, T[]> {
  const grouped: Record<string, T[]> = {}
  for (const note of notes) {
    const date = note.meeting_date
    if (!grouped[date]) {
      grouped[date] = []
    }
    grouped[date].push(note)
  }
  return grouped
}

function getContextBadge(contextType: NoteContextType | null): { label: string; color: string } | null {
  switch (contextType) {
    case 'deal':
      return { label: 'Deal', color: 'bg-blue-100 text-blue-700' }
    case 'portfolio':
      return { label: 'Portfolio', color: 'bg-green-100 text-green-700' }
    case 'person':
      return { label: 'Person', color: 'bg-purple-100 text-purple-700' }
    case 'company':
      return { label: 'Company', color: 'bg-gray-100 text-gray-700' }
    default:
      return null
  }
}

// ============================================================================
// COMPONENTS
// ============================================================================

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <svg className="animate-spin h-6 w-6 text-gray-400" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    </div>
  )
}

function EmptyState({ hasDeliberationNotes }: { hasDeliberationNotes: boolean }) {
  if (hasDeliberationNotes) {
    return <></>
  }

  return (
    <div className="text-center py-8 text-gray-500">
      <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p>No meeting notes yet</p>
      <p className="text-sm">Start typing above to create your first note</p>
    </div>
  )
}

function DeliberationNotesSection({ notes }: { notes: string }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <h4 className="text-sm font-medium text-amber-800 mb-2 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Imported Notes
      </h4>
      <p className="text-amber-900 whitespace-pre-wrap">{notes}</p>
    </div>
  )
}

function NoteCard({ note, onDelete, onEdit, showContextBadge = true }: { note: BaseNote; onDelete: (note: BaseNote) => void; onEdit: (note: BaseNote) => void; showContextBadge?: boolean }) {
  const badge = showContextBadge ? getContextBadge(note.context_type) : null

  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 group">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          {badge && (
            <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded mb-2 ${badge.color}`}>
              {badge.label}
            </span>
          )}
          {note.content.includes('<') ? (
            <div
              className="prose prose-sm max-w-none text-gray-700 break-words [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_p]:my-1 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1 [&_blockquote]:border-l-2 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_a]:text-blue-600 [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(note.content) }}
            />
          ) : (
            <p className="text-gray-700 whitespace-pre-wrap break-words">
              {note.content}
            </p>
          )}
          {note.user_name && (
            <p className="text-xs text-gray-400 mt-2">— {note.user_name}</p>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
          <button
            onClick={() => onEdit(note)}
            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
            title="Edit note"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(note)}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
            title="Delete note"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

function DateGroup({
  date,
  notes,
  onDeleteNote,
  onEditNote,
  useLongDate = true,
  showContextBadge = true,
}: {
  date: string
  notes: BaseNote[]
  onDeleteNote: (note: BaseNote) => void
  onEditNote: (note: BaseNote) => void
  useLongDate?: boolean
  showContextBadge?: boolean
}) {
  return (
    <div>
      <h4 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {useLongDate ? formatDate(date) : formatShortDate(date)}
      </h4>
      <div className="space-y-3">
        {notes.map((note) => (
          <NoteCard key={note.id} note={note} onDelete={onDeleteNote} onEdit={onEditNote} showContextBadge={showContextBadge} />
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function NotesList(props: NotesListProps) {
  const {
    refreshTrigger,
    excludeNoteId,
    deliberationNotes,
    showHeader = false,
  } = props

  const mode = props.mode || 'company'
  const companyId = mode === 'company' ? (props as CompanyNotesListProps).companyId : undefined
  const personId = mode === 'person-only' ? (props as PersonNotesListProps).personId : undefined
  const filterByContext = mode === 'company' ? (props as CompanyNotesListProps).filterByContext : undefined

  const [notes, setNotes] = useState<BaseNote[]>([])
  const [loading, setLoading] = useState(true)
  const [noteToDelete, setNoteToDelete] = useState<BaseNote | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [noteToEdit, setNoteToEdit] = useState<BaseNote | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const supabase = createClient()

  const fetchNotes = useCallback(async () => {
    if (mode === 'person-only' && personId) {
      // Fetch person-only notes from people_notes
      const { data, error } = await supabase
        .from('people_notes')
        .select(`*, author:people!people_notes_user_id_fkey(name, first_name, last_name)`)
        .eq('person_id', personId)
        .order('meeting_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching people notes:', error)
      }

      if (!error && data) {
        setNotes(
          data.map((note: any) => ({
            ...note,
            context_type: null,
            context_id: null,
            user_name: getAuthorName(note.author),
          }))
        )
      }
    } else if (companyId) {
      // Fetch company-linked notes from company_notes
      let query = supabase
        .from('company_notes')
        .select(`*, author:people!company_notes_user_id_fkey(name, first_name, last_name)`)
        .eq('company_id', companyId)
        .order('meeting_date', { ascending: false })
        .order('created_at', { ascending: false })

      // Optionally filter by context type
      if (filterByContext) {
        query = query.eq('context_type', filterByContext)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching company notes:', error)
      }

      if (!error && data) {
        setNotes(
          data.map((note: any) => ({
            ...note,
            user_name: getAuthorName(note.author),
          }))
        )
      }
    }
    setLoading(false)
  }, [mode, companyId, personId, supabase, filterByContext])

  // Fetch notes on mount and when refreshTrigger changes
  useEffect(() => {
    fetchNotes()
  }, [fetchNotes, refreshTrigger])

  // Real-time subscription for changes
  useEffect(() => {
    const tableName = mode === 'person-only' ? 'people_notes' : 'company_notes'
    const filterColumn = mode === 'person-only' ? 'person_id' : 'company_id'
    const filterId = mode === 'person-only' ? personId : companyId

    if (!filterId) return

    const channel = supabase
      .channel(`notes-${mode}-${filterId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
          filter: `${filterColumn}=eq.${filterId}`,
        },
        () => {
          fetchNotes()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [mode, companyId, personId, supabase, fetchNotes])

  async function handleDeleteNote(): Promise<void> {
    if (!noteToDelete) return

    setIsDeleting(true)
    setDeleteError(null)

    const tableName = mode === 'person-only' ? 'people_notes' : 'company_notes'

    const { data, error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', noteToDelete.id)
      .select()

    if (error) {
      console.error('Error deleting note:', error)
      setDeleteError(error.message || 'Failed to delete note. Please try again.')
      setIsDeleting(false)
      return
    }

    if (!data || data.length === 0) {
      console.error('Delete returned no rows - likely blocked by RLS')
      setDeleteError('You do not have permission to delete this note.')
      setIsDeleting(false)
      return
    }

    fetchNotes()
    setIsDeleting(false)
    setNoteToDelete(null)
  }

  function handleCloseDeleteModal(): void {
    setNoteToDelete(null)
    setDeleteError(null)
  }

  async function handleEditNote(content: string, meetingDate: string): Promise<void> {
    if (!noteToEdit) return

    setIsEditing(true)
    setEditError(null)

    const tableName = mode === 'person-only' ? 'people_notes' : 'company_notes'

    const { data, error } = await supabase
      .from(tableName)
      .update({ content, meeting_date: meetingDate })
      .eq('id', noteToEdit.id)
      .select()

    if (error) {
      console.error('Error updating note:', error)
      setEditError(error.message || 'Failed to update note. Please try again.')
      setIsEditing(false)
      return
    }

    if (!data || data.length === 0) {
      console.error('Update returned no rows - likely blocked by RLS')
      setEditError('You do not have permission to edit this note.')
      setIsEditing(false)
      return
    }

    fetchNotes()
    setIsEditing(false)
    setNoteToEdit(null)
  }

  function handleCloseEditModal(): void {
    setNoteToEdit(null)
    setEditError(null)
  }

  if (loading) {
    return <LoadingSpinner />
  }

  const filteredNotes = excludeNoteId
    ? notes.filter((note) => note.id !== excludeNoteId)
    : notes

  const hasDeliberationNotes = Boolean(deliberationNotes)

  if (filteredNotes.length === 0 && !hasDeliberationNotes) {
    return <EmptyState hasDeliberationNotes={hasDeliberationNotes} />
  }

  const groupedNotes = groupNotesByDate(filteredNotes)
  // Show context badge only if not filtering by a specific context
  const showContextBadge = !filterByContext

  return (
    <div className="space-y-6">
      {showHeader && filteredNotes.length > 0 && (
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
          Previous Notes ({notes.length})
        </h3>
      )}

      {Object.entries(groupedNotes).map(([date, dateNotes]) => (
        <DateGroup
          key={date}
          date={date}
          notes={dateNotes}
          onDeleteNote={setNoteToDelete}
          onEditNote={setNoteToEdit}
          useLongDate={true}
          showContextBadge={showContextBadge}
        />
      ))}

      {hasDeliberationNotes && (
        <DeliberationNotesSection notes={deliberationNotes!} />
      )}

      <DeleteNoteModal
        isOpen={!!noteToDelete}
        onClose={handleCloseDeleteModal}
        onConfirm={handleDeleteNote}
        isDeleting={isDeleting}
        notePreview={noteToDelete?.content}
        error={deleteError}
      />

      <EditNoteModal
        isOpen={!!noteToEdit}
        onClose={handleCloseEditModal}
        onSave={handleEditNote}
        isSaving={isEditing}
        initialContent={noteToEdit?.content || ''}
        initialMeetingDate={noteToEdit?.meeting_date || new Date().toISOString().split('T')[0]}
        error={editError}
      />
    </div>
  )
}
