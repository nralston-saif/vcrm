'use client'

type DeleteNoteModalProps = {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isDeleting: boolean
  notePreview?: string
  error?: string | null
}

export default function DeleteNoteModal({
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
  notePreview,
  error,
}: DeleteNoteModalProps) {
  if (!isOpen) return null

  // Truncate note preview if too long
  const truncatedPreview = notePreview && notePreview.length > 100
    ? notePreview.substring(0, 100) + '...'
    : notePreview

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Delete Note</h3>
              <p className="text-sm text-gray-500 mt-1">This action cannot be undone</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-4">
          <p className="text-gray-600">
            Are you sure you want to delete this note? This will permanently remove it from the system.
          </p>

          {truncatedPreview && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
              <p className="text-sm text-gray-500 font-medium mb-1">Note preview:</p>
              <p className="text-sm text-gray-700 italic break-words overflow-wrap-anywhere">&ldquo;{truncatedPreview}&rdquo;</p>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
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
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {isDeleting ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Deleting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Note
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
