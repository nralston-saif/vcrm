'use client'

import { useState, useEffect } from 'react'

type EditNoteModalProps = {
  isOpen: boolean
  onClose: () => void
  onSave: (content: string, meetingDate: string) => Promise<void>
  isSaving: boolean
  initialContent: string
  initialMeetingDate: string
  error?: string | null
}

export default function EditNoteModal({
  isOpen,
  onClose,
  onSave,
  isSaving,
  initialContent,
  initialMeetingDate,
  error,
}: EditNoteModalProps) {
  const [content, setContent] = useState(initialContent)
  const [meetingDate, setMeetingDate] = useState(initialMeetingDate)

  // Reset form when modal opens with new data
  useEffect(() => {
    if (isOpen) {
      setContent(initialContent)
      setMeetingDate(initialMeetingDate)
    }
  }, [isOpen, initialContent, initialMeetingDate])

  if (!isOpen) return null

  const handleSave = async () => {
    await onSave(content, meetingDate)
  }

  const hasChanges = content !== initialContent || meetingDate !== initialMeetingDate

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Edit Note</h3>
              <p className="text-sm text-gray-500 mt-1">Update the note content and date</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-4 space-y-4">
          {/* Meeting Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meeting Date
            </label>
            <input
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Note Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
              placeholder="Enter note content..."
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm text-red-600 font-medium flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !content.trim() || !hasChanges}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
