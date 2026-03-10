'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import FocusTagSelector from '@/components/FocusTagSelector'
import type { BioMapPerson, BioMapOrganization, FocusTag } from './page'

const ENTITY_TYPE_LABELS: Record<string, string> = {
  for_profit: 'For-Profit',
  pbc: 'Public Benefit Corp',
  nonprofit: 'Nonprofit',
  government: 'Government',
  other: 'Other',
}

const ROLE_LABELS: Record<string, string> = {
  partner: 'Partner',
  founder: 'Founder',
  advisor: 'Advisor',
  employee: 'Employee',
  board_member: 'Board Member',
  investor: 'Investor',
  contact: 'Contact',
}

type Props = {
  organization?: BioMapOrganization | null
  person?: BioMapPerson | null
  focusTags: FocusTag[]
  userId: string
  onClose: () => void
  onUpdate?: () => void
}

// Editable text field component with auto-save
function EditableField({
  label,
  value,
  onChange,
  multiline = false,
  placeholder = 'Click to add...',
}: {
  label: string
  value: string
  onChange: (value: string) => Promise<void>
  multiline?: boolean
  placeholder?: string
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [localValue, setLocalValue] = useState(value)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isEditing])

  const handleSave = async () => {
    if (localValue !== value) {
      setSaving(true)
      await onChange(localValue)
      setSaving(false)
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      handleSave()
    }
    if (e.key === 'Escape') {
      setLocalValue(value)
      setIsEditing(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-medium text-gray-500">{label}</h3>
        {saving && <span className="text-xs text-gray-400">(saving...)</span>}
      </div>
      {isEditing ? (
        multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
            rows={3}
            placeholder={placeholder}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-sm"
            placeholder={placeholder}
          />
        )
      ) : (
        <div
          onClick={() => setIsEditing(true)}
          className="cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors group"
        >
          {localValue ? (
            <p className="text-gray-900">{localValue}</p>
          ) : (
            <p className="text-gray-400 italic">{placeholder}</p>
          )}
          <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
            Click to edit
          </span>
        </div>
      )}
    </div>
  )
}

export default function BioMapDetailModal({ organization, person, focusTags, userId, onClose, onUpdate }: Props) {
  const router = useRouter()
  const supabase = createClient()

  // Get initial tags
  const initialTags = organization?.tags || person?.tags || []
  const [tags, setTags] = useState<string[]>(initialTags)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Editable organization fields
  const [description, setDescription] = useState(organization?.short_description || '')
  const [website, setWebsite] = useState(organization?.website || '')

  // Editable person fields
  const [personEmail, setPersonEmail] = useState(person?.email || '')
  const [personBio, setPersonBio] = useState(person?.bio || '')
  const [personLinkedin, setPersonLinkedin] = useState(person?.linkedin_url || '')

  // Handle close - refresh if changes were made
  const handleClose = () => {
    if (hasChanges && onUpdate) {
      onUpdate()
    }
    onClose()
  }

  if (!organization && !person) return null

  const focusTagNames = focusTags.map(t => t.name.toLowerCase())

  const handleTagsChange = async (newTags: string[]) => {
    setTags(newTags)
    setSaving(true)
    setError(null)

    try {
      if (organization) {
        const { error: updateError } = await supabase
          .from('companies')
          .update({ tags: newTags, updated_at: new Date().toISOString() })
          .eq('id', organization.id)

        if (updateError) throw updateError
      } else if (person) {
        const { error: updateError } = await supabase
          .from('people')
          .update({ tags: newTags, updated_at: new Date().toISOString() })
          .eq('id', person.id)

        if (updateError) throw updateError
      }

      setHasChanges(true)
    } catch (err: any) {
      console.error('Error saving tags:', err)
      setError(err?.message || 'Failed to save tags')
      setTags(tags)
    } finally {
      setSaving(false)
    }
  }

  const handleOrgFieldUpdate = async (field: string, value: string) => {
    if (!organization) return

    try {
      const { error: updateError } = await supabase
        .from('companies')
        .update({ [field]: value || null, updated_at: new Date().toISOString() })
        .eq('id', organization.id)

      if (updateError) throw updateError
      setHasChanges(true)
    } catch (err: any) {
      console.error(`Error saving ${field}:`, err)
      setError(err?.message || `Failed to save ${field}`)
    }
  }

  const handlePersonFieldUpdate = async (field: string, value: string) => {
    if (!person) return

    try {
      const { error: updateError } = await supabase
        .from('people')
        .update({ [field]: value || null, updated_at: new Date().toISOString() })
        .eq('id', person.id)

      if (updateError) throw updateError
      setHasChanges(true)
    } catch (err: any) {
      console.error(`Error saving ${field}:`, err)
      setError(err?.message || `Failed to save ${field}`)
    }
  }

  const handleContactEmailUpdate = async (contactId: string, newEmail: string) => {
    try {
      const { error: updateError } = await supabase
        .from('people')
        .update({ email: newEmail || null, updated_at: new Date().toISOString() })
        .eq('id', contactId)

      if (updateError) throw updateError
      setHasChanges(true)
    } catch (err: any) {
      console.error('Error saving contact email:', err)
      setError(err?.message || 'Failed to save contact email')
    }
  }

  if (organization) {
    return (
      <div className="modal-backdrop" onClick={handleClose}>
        <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900">{organization.name}</h2>
                {organization.entity_type && (
                  <span className="inline-block mt-2 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                    {ENTITY_TYPE_LABELS[organization.entity_type] || organization.entity_type}
                  </span>
                )}
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 p-2 -m-2 ml-4"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Focus/Tags */}
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-medium text-gray-500">Focus</h3>
                {saving && <span className="text-xs text-gray-400">(saving...)</span>}
              </div>
              {error && (
                <p className="text-xs text-red-600 mb-2">{error}</p>
              )}
              <FocusTagSelector
                selectedTags={tags}
                onChange={handleTagsChange}
                currentUserId={userId}
                availableFocusTags={focusTags}
              />
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 max-h-[50vh] overflow-y-auto">
            {/* Description - Editable */}
            <EditableField
              label="Description"
              value={description}
              onChange={async (value) => {
                setDescription(value)
                await handleOrgFieldUpdate('short_description', value)
              }}
              multiline
              placeholder="Add a description..."
            />

            {/* Website - Editable */}
            <EditableField
              label="Website"
              value={website}
              onChange={async (value) => {
                setWebsite(value)
                await handleOrgFieldUpdate('website', value)
              }}
              placeholder="Add website URL..."
            />

            {/* Location */}
            {(organization.city || organization.country) && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Location</h3>
                <p className="text-gray-900">
                  {[organization.city, organization.country].filter(Boolean).join(', ')}
                </p>
              </div>
            )}

            {/* Contacts - Editable emails */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Contacts</h3>
              {organization.contacts.length > 0 ? (
                <div className="space-y-3">
                  {organization.contacts.map(contact => (
                    <ContactCard
                      key={contact.id}
                      contact={contact}
                      onEmailUpdate={handleContactEmailUpdate}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 italic">No contacts added</p>
              )}
            </div>

            {/* Founded Year */}
            {organization.founded_year && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Founded</h3>
                <p className="text-gray-900">{organization.founded_year}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-100 flex justify-between">
            <button
              onClick={() => router.push(`/companies/${organization.id}`)}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              View Full Profile
            </button>
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (person) {
    return (
      <div className="modal-backdrop" onClick={handleClose}>
        <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-[#1a1a1a] rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-2xl font-medium">
                    {person.displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{person.displayName}</h2>
                  {person.title && (
                    <p className="text-gray-500 mt-1">{person.title}</p>
                  )}
                </div>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 p-2 -m-2 ml-4"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Focus/Tags */}
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-medium text-gray-500">Focus</h3>
                {saving && <span className="text-xs text-gray-400">(saving...)</span>}
              </div>
              {error && (
                <p className="text-xs text-red-600 mb-2">{error}</p>
              )}
              <FocusTagSelector
                selectedTags={tags}
                onChange={handleTagsChange}
                currentUserId={userId}
                availableFocusTags={focusTags}
              />
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 max-h-[50vh] overflow-y-auto">
            {/* Role */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Role</h3>
              <span className="px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800">
                {ROLE_LABELS[person.role] || person.role}
              </span>
            </div>

            {/* Bio - Editable */}
            <EditableField
              label="Bio"
              value={personBio}
              onChange={async (value) => {
                setPersonBio(value)
                await handlePersonFieldUpdate('bio', value)
              }}
              multiline
              placeholder="Add a bio..."
            />

            {/* Email - Editable */}
            <EditableField
              label="Email"
              value={personEmail}
              onChange={async (value) => {
                setPersonEmail(value)
                await handlePersonFieldUpdate('email', value)
              }}
              placeholder="Add email..."
            />

            {/* Location */}
            {person.location && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Location</h3>
                <p className="text-gray-900">{person.location}</p>
              </div>
            )}

            {/* LinkedIn - Editable */}
            <EditableField
              label="LinkedIn"
              value={personLinkedin}
              onChange={async (value) => {
                setPersonLinkedin(value)
                await handlePersonFieldUpdate('linkedin_url', value)
              }}
              placeholder="Add LinkedIn URL..."
            />

            {/* Organizations */}
            {person.company_associations.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Organizations</h3>
                <div className="space-y-2">
                  {person.company_associations.map((assoc, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{assoc.company?.name || 'Unknown'}</p>
                        {assoc.title && (
                          <p className="text-sm text-gray-500">{assoc.title}</p>
                        )}
                      </div>
                      {assoc.relationship_type && (
                        <span className="text-xs text-gray-500 capitalize">
                          {assoc.relationship_type.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-100 flex justify-between">
            <button
              onClick={() => router.push(`/people/${person.id}`)}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              View Full Profile
            </button>
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}

// Contact card with editable email
function ContactCard({
  contact,
  onEmailUpdate,
}: {
  contact: { id: string; name: string; title: string | null; email: string | null; relationship_type: string | null }
  onEmailUpdate: (contactId: string, email: string) => Promise<void>
}) {
  const [isEditingEmail, setIsEditingEmail] = useState(false)
  const [email, setEmail] = useState(contact.email || '')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditingEmail && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isEditingEmail])

  const handleSave = async () => {
    if (email !== (contact.email || '')) {
      setSaving(true)
      await onEmailUpdate(contact.id, email)
      setSaving(false)
    }
    setIsEditingEmail(false)
  }

  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="font-medium text-gray-900">{contact.name}</p>
          {contact.title && (
            <p className="text-sm text-gray-500">{contact.title}</p>
          )}
          {contact.relationship_type && (
            <p className="text-xs text-gray-400 capitalize">{contact.relationship_type.replace('_', ' ')}</p>
          )}
        </div>
      </div>
      <div className="mt-2">
        {isEditingEmail ? (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
                if (e.key === 'Escape') {
                  setEmail(contact.email || '')
                  setIsEditingEmail(false)
                }
              }}
              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-black focus:border-transparent"
              placeholder="Add email..."
            />
            {saving && <span className="text-xs text-gray-400">Saving...</span>}
          </div>
        ) : (
          <div
            onClick={() => setIsEditingEmail(true)}
            className="cursor-pointer hover:bg-gray-100 rounded px-2 py-1 -mx-2 -my-1 transition-colors group"
          >
            {email ? (
              <span className="text-sm text-blue-600">{email}</span>
            ) : (
              <span className="text-sm text-gray-400 italic">Add email...</span>
            )}
            <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 ml-2 transition-opacity">
              (click to edit)
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
