'use client'

import { useState, useCallback } from 'react'
import CollaborativeNoteEditor, { type NoteContextType } from './collaborative/CollaborativeNoteEditor'
import NotesList from './shared/NotesList'

// ============================================================================
// TYPES
// ============================================================================

type CompanyNotesProps = {
  companyId: string
  companyName: string
  userId: string
  userName: string
  // Context for where notes are being created
  contextType: NoteContextType
  contextId?: string  // Required for deal/portfolio/person, not needed for company
  // Optional: imported notes to display
  deliberationNotes?: string | null
  // Optional: filter displayed notes to specific context only
  filterByContext?: NoteContextType
  // Optional UI customization
  showDatePicker?: boolean
  placeholder?: string
  minHeight?: string
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CompanyNotes({
  companyId,
  companyName,
  userId,
  userName,
  contextType,
  contextId,
  deliberationNotes,
  filterByContext,
  showDatePicker = true,
  placeholder,
  minHeight = '200px',
}: CompanyNotesProps) {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null)

  const handleNoteSaved = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1)
  }, [])

  const handleCurrentNoteIdChange = useCallback((noteId: string | null) => {
    setCurrentNoteId(noteId)
  }, [])

  // Build the context for the editor
  const context = contextType === 'company'
    ? { type: 'company' as const, id: companyId, companyId }
    : { type: contextType, id: contextId!, companyId }

  return (
    <div className="space-y-6">
      {/* Note Editor */}
      <CollaborativeNoteEditor
        context={context}
        userId={userId}
        userName={userName}
        showDatePicker={showDatePicker}
        placeholder={placeholder || `Add notes about ${companyName}...`}
        minHeight={minHeight}
        onNoteSaved={handleNoteSaved}
        onCurrentNoteIdChange={handleCurrentNoteIdChange}
      />

      {/* Notes List */}
      <div>
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
          Previous Notes
        </h3>
        <NotesList
          companyId={companyId}
          refreshTrigger={refreshTrigger}
          excludeNoteId={currentNoteId}
          deliberationNotes={deliberationNotes}
          filterByContext={filterByContext}
        />
      </div>
    </div>
  )
}
