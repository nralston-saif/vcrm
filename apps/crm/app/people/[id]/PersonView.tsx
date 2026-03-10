'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { UserRole, UserStatus } from '@vcrm/supabase'
import TagSelector from '@/app/tickets/TagSelector'
import CreateTicketButton from '@/components/CreateTicketButton'
import { CollaborativeNoteEditor } from '@/components/collaborative'
import { NotesList } from '@/components/shared'

type CompanyAssociation = {
  id: string
  relationship_type: string
  title: string | null
  is_primary_contact: boolean
  end_date: string | null
  company: {
    id: string
    name: string
    logo_url: string | null
    short_description: string | null
    website: string | null
  } | null
}

type Person = {
  id: string
  first_name: string | null
  last_name: string | null
  name: string | null
  email: string | null
  alternative_emails: string[] | null
  role: UserRole
  status: UserStatus
  title: string | null
  bio: string | null
  avatar_url: string | null
  linkedin_url: string | null
  twitter_url: string | null
  mobile_phone: string | null
  location: string | null
  tags: string[]
  first_met_date: string | null
  introduced_by: string | null
  introduction_context: string | null
  relationship_notes: string | null
  companies?: CompanyAssociation[]
}

interface PersonViewProps {
  person: Person
  introducerName: string | null
  activeCompanies: CompanyAssociation[]
  canEdit: boolean
  isPartner: boolean
  currentUserId: string
  currentUserName: string
}

const ROLE_LABELS: Record<UserRole, string> = {
  partner: 'Partner',
  founder: 'Founder',
  advisor: 'Advisor',
  employee: 'Employee',
  board_member: 'Board Member',
  investor: 'Investor',
  contact: 'Contact',
}

const STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Active',
  eligible: 'Eligible',
  tracked: 'Tracked',
}

export default function PersonView({ person, introducerName, activeCompanies, canEdit, isPartner, currentUserId, currentUserName }: PersonViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Start in edit mode if ?edit=true is in URL
  const [isEditing, setIsEditing] = useState(searchParams.get('edit') === 'true' && canEdit)
  const [saving, setSaving] = useState(false)

  // Notes state (for inline notes section)
  const [notesRefreshTrigger, setNotesRefreshTrigger] = useState(0)
  const [currentNoteId, setCurrentNoteId] = useState<string | null | undefined>(undefined)
  const prevCurrentNoteIdRef = useRef<string | null | undefined>(undefined)

  // Detect when sharedNoteId transitions from a value to null (Save & New clicked)
  useEffect(() => {
    const prev = prevCurrentNoteIdRef.current
    prevCurrentNoteIdRef.current = currentNoteId

    if (prev && prev !== undefined && currentNoteId === null) {
      setNotesRefreshTrigger((p) => p + 1)
    }
  }, [currentNoteId])
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState(person.avatar_url)

  // Awaiting verification indicator (partners only, for eligible people)
  const [awaitingVerification, setAwaitingVerification] = useState(false)
  useEffect(() => {
    if (isPartner && person.status === 'eligible' && person.email) {
      supabase.rpc('get_unverified_signups', { check_emails: [person.email] })
        .then(({ data }) => {
          if (data && data.length > 0) {
            setAwaitingVerification(true)
          }
        })
    }
  }, [isPartner, person.status, person.email, supabase])

  // Resend verification (partners only)
  const [resendingVerification, setResendingVerification] = useState(false)
  const handleResendVerification = async () => {
    if (!person.email) return
    setResendingVerification(true)
    setError(null)
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: person.email.toLowerCase() }),
      })
      const result = await response.json()
      if (result.success) {
        setSuccess('Verification email resent')
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(result.message || 'Failed to resend verification email')
      }
    } catch {
      setError('Failed to resend verification email')
    } finally {
      setResendingVerification(false)
    }
  }

  // Company affiliation management (partners only)
  const [allCompanyAssociations, setAllCompanyAssociations] = useState<CompanyAssociation[]>([])
  const [availableCompanies, setAvailableCompanies] = useState<{ id: string; name: string }[]>([])
  const [showAddCompany, setShowAddCompany] = useState(false)
  const [newCompanyId, setNewCompanyId] = useState('')
  const [newRelationshipType, setNewRelationshipType] = useState('founder')
  const [newTitle, setNewTitle] = useState('')
  const [savingAffiliation, setSavingAffiliation] = useState(false)

  const [copiedEmail, setCopiedEmail] = useState(false)
  const [copiedAltEmail, setCopiedAltEmail] = useState<number | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [impersonating, setImpersonating] = useState(false)

  const copyEmailToClipboard = async () => {
    if (person.email) {
      await navigator.clipboard.writeText(person.email)
      setCopiedEmail(true)
      setTimeout(() => setCopiedEmail(false), 2000)
    }
  }

  const copyAltEmailToClipboard = async (email: string, idx: number) => {
    await navigator.clipboard.writeText(email)
    setCopiedAltEmail(idx)
    setTimeout(() => setCopiedAltEmail(null), 2000)
  }

  const [formData, setFormData] = useState({
    first_name: person.first_name || '',
    last_name: person.last_name || '',
    email: person.email || '',
    alternative_emails: person.alternative_emails?.join(', ') || '',
    title: person.title || '',
    bio: person.bio || '',
    linkedin_url: person.linkedin_url || '',
    twitter_url: person.twitter_url || '',
    mobile_phone: person.mobile_phone || '',
    location: person.location || '',
    role: person.role,
    status: person.status,
    tags: person.tags || [],
    first_met_date: person.first_met_date || '',
    introduction_context: person.introduction_context || '',
    relationship_notes: person.relationship_notes || '',
  })

  // Fetch all company associations when editing (partners only)
  useEffect(() => {
    if (isEditing && isPartner) {
      async function fetchData() {
        // Fetch all associations for this person (including former)
        const { data: associations } = await supabase
          .from('company_people')
          .select(`
            id,
            relationship_type,
            title,
            is_primary_contact,
            end_date,
            company:companies(id, name, logo_url, short_description, website)
          `)
          .eq('user_id', person.id)
          .order('end_date', { ascending: true, nullsFirst: true })

        if (associations) {
          setAllCompanyAssociations(associations as CompanyAssociation[])
        }

        // Fetch all companies for the dropdown
        const { data: companies } = await supabase
          .from('companies')
          .select('id, name')
          .eq('is_active', true)
          .order('name')

        if (companies) {
          setAvailableCompanies(companies)
        }
      }
      fetchData()
    }
  }, [isEditing, isPartner, person.id, supabase])

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Mark someone as former at a company
  const handleMarkAsFormer = async (associationId: string) => {
    setSavingAffiliation(true)
    try {
      const { error } = await supabase
        .from('company_people')
        .update({ end_date: new Date().toISOString().split('T')[0] })
        .eq('id', associationId)

      if (error) throw error

      // Update local state
      setAllCompanyAssociations(prev =>
        prev.map(a => a.id === associationId ? { ...a, end_date: new Date().toISOString().split('T')[0] } : a)
      )
      setSuccess('Marked as former')
      setTimeout(() => setSuccess(null), 2000)
    } catch (err: any) {
      setError(`Failed to update: ${err?.message}`)
    } finally {
      setSavingAffiliation(false)
    }
  }

  // Reinstate someone at a company (remove end_date)
  const handleReinstate = async (associationId: string) => {
    setSavingAffiliation(true)
    try {
      const { error } = await supabase
        .from('company_people')
        .update({ end_date: null })
        .eq('id', associationId)

      if (error) throw error

      setAllCompanyAssociations(prev =>
        prev.map(a => a.id === associationId ? { ...a, end_date: null } : a)
      )
      setSuccess('Reinstated')
      setTimeout(() => setSuccess(null), 2000)
    } catch (err: any) {
      setError(`Failed to update: ${err?.message}`)
    } finally {
      setSavingAffiliation(false)
    }
  }

  // Add new company association
  const handleAddCompanyAssociation = async () => {
    if (!newCompanyId) return

    setSavingAffiliation(true)
    try {
      const { data, error } = await supabase
        .from('company_people')
        .insert({
          user_id: person.id,
          company_id: newCompanyId,
          relationship_type: newRelationshipType,
          title: newTitle || null,
          is_primary_contact: false,
        })
        .select(`
          id,
          relationship_type,
          title,
          is_primary_contact,
          end_date,
          company:companies(id, name, logo_url, short_description, website)
        `)
        .single()

      if (error) throw error

      setAllCompanyAssociations(prev => [...prev, data as CompanyAssociation])
      setShowAddCompany(false)
      setNewCompanyId('')
      setNewRelationshipType('founder')
      setNewTitle('')
      setSuccess('Company association added')
      setTimeout(() => setSuccess(null), 2000)
    } catch (err: any) {
      setError(`Failed to add: ${err?.message}`)
    } finally {
      setSavingAffiliation(false)
    }
  }

  // Remove company association entirely
  const handleRemoveAssociation = async (associationId: string) => {
    if (!confirm('Are you sure you want to remove this company association entirely?')) return

    setSavingAffiliation(true)
    try {
      const { error } = await supabase
        .from('company_people')
        .delete()
        .eq('id', associationId)

      if (error) throw error

      setAllCompanyAssociations(prev => prev.filter(a => a.id !== associationId))
      setSuccess('Association removed')
      setTimeout(() => setSuccess(null), 2000)
    } catch (err: any) {
      setError(`Failed to remove: ${err?.message}`)
    } finally {
      setSavingAffiliation(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingAvatar(true)
    setError(null)

    try {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB')
        setUploadingAvatar(false)
        return
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        setError('File must be an image')
        setUploadingAvatar(false)
        return
      }

      // Delete old avatar if exists
      if (avatarUrl) {
        const oldPath = avatarUrl.includes('/storage/v1/object/public/')
          ? avatarUrl.split('/storage/v1/object/public/avatars/')[1]
          : avatarUrl

        if (oldPath) {
          await supabase.storage
            .from('avatars')
            .remove([oldPath])
        }
      }

      // Upload new avatar
      const fileExt = file.name.split('.').pop()
      const fileName = `avatar-${Date.now()}.${fileExt}`
      const filePath = `${person.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) {
        throw uploadError
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Update person with new avatar URL
      const { error: updateError } = await supabase
        .from('people')
        .update({ avatar_url: publicUrl })
        .eq('id', person.id)

      if (updateError) {
        throw updateError
      }

      setAvatarUrl(`${publicUrl}?t=${Date.now()}`)
      setSuccess('Photo uploaded successfully!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      console.error('Error uploading avatar:', err)
      setError(`Failed to upload photo: ${err?.message || 'Unknown error'}`)
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleImpersonate = async () => {
    setImpersonating(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPersonId: person.id }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Failed to impersonate user')
        return
      }

      // Full page reload to ensure layout re-renders
      window.location.href = '/dashboard'
    } catch (err: any) {
      setError('Failed to impersonate user')
    } finally {
      setImpersonating(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      // Parse alternative_emails from comma-separated string to array
      const alternativeEmailsArray = formData.alternative_emails
        ? formData.alternative_emails.split(',').map(e => e.trim()).filter(Boolean)
        : null

      // Build full name from first and last name
      const fullName = [formData.first_name, formData.last_name]
        .filter(Boolean)
        .join(' ')
        .trim() || null

      const { error: updateError } = await supabase
        .from('people')
        .update({
          first_name: formData.first_name || null,
          last_name: formData.last_name || null,
          name: fullName, // Keep name field in sync with first/last name
          email: formData.email || null,
          alternative_emails: alternativeEmailsArray?.length ? alternativeEmailsArray : null,
          title: formData.title || null,
          bio: formData.bio || null,
          linkedin_url: formData.linkedin_url || null,
          twitter_url: formData.twitter_url || null,
          mobile_phone: formData.mobile_phone || null,
          location: formData.location || null,
          role: formData.role,
          status: formData.status,
          tags: formData.tags,
          first_met_date: formData.first_met_date || null,
          introduction_context: formData.introduction_context || null,
          relationship_notes: formData.relationship_notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', person.id)

      if (updateError) throw updateError

      setSuccess('Profile updated successfully!')
      setIsEditing(false)

      setTimeout(() => {
        router.refresh()
      }, 1000)
    } catch (err: any) {
      console.error('Error updating person:', err)
      setError(`Failed to update: ${err?.message || 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)

    try {
      // Delete company associations first
      await supabase
        .from('company_people')
        .delete()
        .eq('user_id', person.id)

      // Delete the person
      const { error: deleteError } = await supabase
        .from('people')
        .delete()
        .eq('id', person.id)

      if (deleteError) throw deleteError

      // Redirect to people list
      router.push('/people')
    } catch (err: any) {
      console.error('Error deleting person:', err)
      setError(`Failed to delete: ${err?.message || 'Unknown error'}`)
      setShowDeleteConfirm(false)
    } finally {
      setDeleting(false)
    }
  }

  const fullName = `${person.first_name || ''} ${person.last_name || ''}`.trim() || 'Unknown'

  return (
    <>
      {/* Back link */}
      <Link
        href="/people"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to People
      </Link>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-6 rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-md bg-green-50 p-4">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {isEditing ? (
        /* Edit Mode */
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Header (Edit) */}
          <div className="flex items-start space-x-6 mb-8">
            <div className="flex-shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName}
                  className="h-24 w-24 rounded-full object-cover"
                />
              ) : (
                <div className="h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-3xl font-semibold text-gray-500">
                    {formData.first_name?.[0] || '?'}
                  </span>
                </div>
              )}
              <div className="mt-2">
                <label
                  htmlFor="avatar-upload"
                  className="cursor-pointer inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  {uploadingAvatar ? 'Uploading...' : 'Change Photo'}
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  disabled={uploadingAvatar}
                  className="hidden"
                />
              </div>
            </div>
            <div className="flex-1">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">
                    First Name *
                  </label>
                  <input
                    type="text"
                    id="first_name"
                    name="first_name"
                    required
                    value={formData.first_name}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                  />
                </div>
                <div>
                  <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="last_name"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                  Title
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="e.g., CEO, Software Engineer"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                />
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                    Role
                  </label>
                  <select
                    id="role"
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    disabled={!isPartner}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900 disabled:bg-gray-100"
                  >
                    {Object.entries(ROLE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Status
                  </label>
                  <div className="mt-1 px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm text-gray-700">
                    {STATUS_LABELS[formData.status] || formData.status}
                  </div>
                </div>
              </div>

              {/* Invite to Community - Partners only, for tracked/eligible people */}
              {isPartner && formData.status !== 'active' && (
                <div className="flex items-center gap-3 py-2">
                  <input
                    type="checkbox"
                    id="invite_to_community"
                    checked={formData.status === 'eligible'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.checked ? 'eligible' : 'tracked' })}
                    className="h-4 w-4 text-gray-900 focus:ring-gray-900 border-gray-300 rounded"
                  />
                  <label htmlFor="invite_to_community" className="text-sm font-medium text-gray-700">
                    Invite to Community
                  </label>
                  <span className="text-xs text-gray-500">(sets status to eligible, allows signup)</span>
                </div>
              )}

              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                  Location
                </label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="City, Country"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                />
              </div>

              <div>
                <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
                  Bio
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  rows={4}
                  value={formData.bio}
                  onChange={handleInputChange}
                  placeholder="Brief background..."
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags
                </label>
                <TagSelector
                  selectedTags={formData.tags}
                  onChange={(tags) => setFormData({ ...formData, tags })}
                  currentUserId={person.id}
                />
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                />
              </div>
              <div>
                <label htmlFor="alternative_emails" className="block text-sm font-medium text-gray-700">
                  Alternative Emails
                </label>
                <input
                  type="text"
                  id="alternative_emails"
                  name="alternative_emails"
                  value={formData.alternative_emails}
                  onChange={handleInputChange}
                  placeholder="other@email.com, another@email.com"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                />
                <p className="mt-1 text-xs text-gray-500">Separate multiple emails with commas</p>
              </div>
              <div>
                <label htmlFor="mobile_phone" className="block text-sm font-medium text-gray-700">
                  Phone
                </label>
                <input
                  type="tel"
                  id="mobile_phone"
                  name="mobile_phone"
                  value={formData.mobile_phone}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                />
              </div>
              <div>
                <label htmlFor="linkedin_url" className="block text-sm font-medium text-gray-700">
                  LinkedIn URL
                </label>
                <input
                  type="url"
                  id="linkedin_url"
                  name="linkedin_url"
                  value={formData.linkedin_url}
                  onChange={handleInputChange}
                  placeholder="https://linkedin.com/in/username"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                />
              </div>
              <div>
                <label htmlFor="twitter_url" className="block text-sm font-medium text-gray-700">
                  Twitter URL
                </label>
                <input
                  type="url"
                  id="twitter_url"
                  name="twitter_url"
                  value={formData.twitter_url}
                  onChange={handleInputChange}
                  placeholder="https://twitter.com/username"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                />
              </div>
            </div>
          </div>

          {/* Relationship Tracking (Partners Only) */}
          {isPartner && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-blue-900 mb-4">Relationship Tracking</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="first_met_date" className="block text-sm font-medium text-gray-700">
                    First Met Date
                  </label>
                  <input
                    type="date"
                    id="first_met_date"
                    name="first_met_date"
                    value={formData.first_met_date}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                  />
                </div>
                <div>
                  <label htmlFor="introduction_context" className="block text-sm font-medium text-gray-700">
                    How We Met
                  </label>
                  <textarea
                    id="introduction_context"
                    name="introduction_context"
                    rows={2}
                    value={formData.introduction_context}
                    onChange={handleInputChange}
                    placeholder="e.g., Met at YC Demo Day..."
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                  />
                </div>
                <div>
                  <label htmlFor="relationship_notes" className="block text-sm font-medium text-gray-700">
                    Relationship Notes
                  </label>
                  <textarea
                    id="relationship_notes"
                    name="relationship_notes"
                    rows={2}
                    value={formData.relationship_notes}
                    onChange={handleInputChange}
                    placeholder="Ongoing notes..."
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Company Affiliations (Partners Only) */}
          {isPartner && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Company Affiliations</h2>
                <button
                  type="button"
                  onClick={() => setShowAddCompany(true)}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  + Add Company
                </button>
              </div>

              {/* Add Company Form */}
              {showAddCompany && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <select
                      value={newCompanyId}
                      onChange={(e) => setNewCompanyId(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="">Select company...</option>
                      {availableCompanies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <select
                      value={newRelationshipType}
                      onChange={(e) => setNewRelationshipType(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="founder">Founder</option>
                      <option value="employee">Employee</option>
                      <option value="advisor">Advisor</option>
                      <option value="board_member">Board Member</option>
                      <option value="investor">Investor</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Title (optional)"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddCompanyAssociation}
                      disabled={!newCompanyId || savingAffiliation}
                      className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-800 disabled:opacity-50"
                    >
                      {savingAffiliation ? 'Adding...' : 'Add'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddCompany(false)
                        setNewCompanyId('')
                        setNewTitle('')
                      }}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Current Affiliations */}
              {allCompanyAssociations.length === 0 ? (
                <p className="text-sm text-gray-500">No company affiliations</p>
              ) : (
                <div className="space-y-3">
                  {allCompanyAssociations.map((assoc) => (
                    <div
                      key={assoc.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        assoc.end_date ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {assoc.company?.logo_url ? (
                          <img
                            src={assoc.company.logo_url}
                            alt={assoc.company.name}
                            className="w-8 h-8 object-contain"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center">
                            <span className="text-xs font-medium text-gray-500">
                              {assoc.company?.name?.[0] || '?'}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className={`text-sm font-medium ${assoc.end_date ? 'text-gray-500' : 'text-gray-900'}`}>
                            {assoc.company?.name}
                            {assoc.end_date && (
                              <span className="ml-2 text-xs text-gray-400">(Former)</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500">
                            {assoc.title || assoc.relationship_type}
                            {assoc.end_date && ` • Left ${new Date(assoc.end_date).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {assoc.end_date ? (
                          <button
                            type="button"
                            onClick={() => handleReinstate(assoc.id)}
                            disabled={savingAffiliation}
                            className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                          >
                            Reinstate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleMarkAsFormer(assoc.id)}
                            disabled={savingAffiliation}
                            className="text-xs text-amber-600 hover:text-amber-800 disabled:opacity-50"
                          >
                            Mark Former
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveAssociation(assoc.id)}
                          disabled={savingAffiliation}
                          className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setIsEditing(false)
                setError(null)
                setSuccess(null)
                setFormData({
                  first_name: person.first_name || '',
                  last_name: person.last_name || '',
                  email: person.email || '',
                  alternative_emails: person.alternative_emails?.join(', ') || '',
                  title: person.title || '',
                  bio: person.bio || '',
                  linkedin_url: person.linkedin_url || '',
                  twitter_url: person.twitter_url || '',
                  mobile_phone: person.mobile_phone || '',
                  location: person.location || '',
                  role: person.role,
                  status: person.status,
                  tags: person.tags || [],
                  first_met_date: person.first_met_date || '',
                  introduction_context: person.introduction_context || '',
                  relationship_notes: person.relationship_notes || '',
                })
              }}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          {/* Delete Button (Partners Only) */}
          {isPartner && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Delete this person
              </button>
            </div>
          )}
        </form>
      ) : (
        /* View Mode */
        <>
          {/* Profile Header */}
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-start space-x-6">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName}
                  className="h-24 w-24 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-3xl font-semibold text-gray-500">
                    {person.first_name?.[0] || '?'}
                  </span>
                </div>
              )}
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900">{fullName}</h1>
                {person.title && (
                  <p className="mt-1 text-lg text-gray-600">{person.title}</p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {ROLE_LABELS[person.role]}
                  </span>
                  {isPartner && person.status === 'eligible' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Eligible
                    </span>
                  )}
                  {isPartner && awaitingVerification && (
                    <>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        Awaiting Verification
                      </span>
                      <button
                        onClick={handleResendVerification}
                        disabled={resendingVerification}
                        className="text-xs text-amber-700 hover:text-amber-900 underline disabled:opacity-50"
                      >
                        {resendingVerification ? 'Sending...' : 'Resend'}
                      </button>
                    </>
                  )}
                  {person.location && (
                    <span className="text-sm text-gray-500">{person.location}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {/* Impersonate Button (partners only, non-partners who have signed up) */}
              {isPartner && person.role !== 'partner' && person.status === 'active' && (
                <button
                  onClick={handleImpersonate}
                  disabled={impersonating}
                  className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-md hover:bg-amber-600 disabled:opacity-50"
                >
                  {impersonating ? 'Starting...' : 'View as User'}
                </button>
              )}
              {/* Create Ticket Button (partners only - handled internally) */}
              <CreateTicketButton currentUserId={currentUserId} />
              {/* Edit Button */}
              {canEdit && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800"
                >
                  Edit Profile
                </button>
              )}
            </div>
          </div>

          {/* Bio */}
          {person.bio && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">About</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{person.bio}</p>
            </div>
          )}

          {/* Tags */}
          {person.tags && person.tags.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {person.tags.map((tag, index) => (
                  <span key={index} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Relationship Tracking (Partners Only) */}
          {isPartner && (person.first_met_date || introducerName || person.introduction_context || person.relationship_notes) && (
            <div className="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <h2 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                Relationship
              </h2>
              <div className="space-y-3">
                {(person.first_met_date || introducerName) && (
                  <div className="flex flex-wrap gap-4 text-sm">
                    {person.first_met_date && (
                      <div>
                        <span className="text-gray-500">First met:</span>{' '}
                        <span className="font-medium text-gray-900">
                          {new Date(person.first_met_date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    )}
                    {introducerName && (
                      <div>
                        <span className="text-gray-500">Introduced by:</span>{' '}
                        <Link
                          href={`/people/${person.introduced_by}`}
                          className="font-medium text-blue-600 hover:text-blue-800"
                        >
                          {introducerName}
                        </Link>
                      </div>
                    )}
                  </div>
                )}
                {person.introduction_context && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">How we met:</p>
                    <p className="text-gray-700 whitespace-pre-wrap">{person.introduction_context}</p>
                  </div>
                )}
                {person.relationship_notes && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Relationship notes:</p>
                    <p className="text-gray-700 whitespace-pre-wrap">{person.relationship_notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Company Associations */}
          {activeCompanies.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Companies</h2>
              <div className="space-y-3">
                {activeCompanies.map((assoc) => (
                  <Link
                    key={assoc.id}
                    href={`/companies/${assoc.company?.id}`}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                  >
                    {assoc.company?.logo_url ? (
                      <img
                        src={assoc.company.logo_url}
                        alt={assoc.company.name}
                        className="h-12 w-12 object-contain"
                      />
                    ) : (
                      <div className="h-12 w-12 bg-gray-200 rounded flex items-center justify-center">
                        <span className="text-lg font-bold text-gray-400">
                          {assoc.company?.name?.[0] || '?'}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-gray-900">{assoc.company?.name}</p>
                      <p className="text-sm text-gray-600">
                        {assoc.title || assoc.relationship_type}
                        {assoc.is_primary_contact && (
                          <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                            Primary Contact
                          </span>
                        )}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Contact & Links */}
          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact</h2>
            <div className="flex flex-wrap gap-3">
              {person.email && (
                <div className="inline-flex items-center border border-gray-300 rounded-lg overflow-hidden">
                  <a
                    href={`mailto:${person.email}`}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {person.email}
                  </a>
                  <button
                    onClick={copyEmailToClipboard}
                    className="px-3 py-2 border-l border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition"
                    title="Copy email to clipboard"
                  >
                    {copiedEmail ? (
                      <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>
              )}
              {person.alternative_emails && person.alternative_emails.length > 0 && (
                person.alternative_emails.map((altEmail, idx) => (
                  <div key={idx} className="inline-flex items-center border border-gray-300 rounded-lg overflow-hidden">
                    <a
                      href={`mailto:${altEmail}`}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {altEmail}
                    </a>
                    <button
                      onClick={() => copyAltEmailToClipboard(altEmail, idx)}
                      className="px-3 py-2 border-l border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition"
                      title="Copy email to clipboard"
                    >
                      {copiedAltEmail === idx ? (
                        <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  </div>
                ))
              )}
              {person.mobile_phone && (
                <a
                  href={`tel:${person.mobile_phone}`}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {person.mobile_phone}
                </a>
              )}
              {person.linkedin_url && (
                <a
                  href={person.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                  </svg>
                  LinkedIn
                </a>
              )}
              {person.twitter_url && (
                <a
                  href={person.twitter_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  Twitter
                </a>
              )}
            </div>
          </div>

          {/* Notes Section (Partners Only) */}
          {isPartner && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Meeting Notes</h2>
              <div className="space-y-6">
                <CollaborativeNoteEditor
                  key={person.id}
                  context={{ type: 'person-only', id: person.id }}
                  userId={currentUserId}
                  userName={currentUserName}
                  showDatePicker={true}
                  placeholder="Type your meeting notes here... Changes auto-save and sync in real-time."
                  minHeight="200px"
                  onNoteSaved={() => setNotesRefreshTrigger((prev) => prev + 1)}
                  onCurrentNoteIdChange={setCurrentNoteId}
                />

                {currentNoteId !== undefined && (
                  <NotesList
                    mode="person-only"
                    personId={person.id}
                    refreshTrigger={notesRefreshTrigger}
                    excludeNoteId={currentNoteId}
                    showHeader={true}
                  />
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Person</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete <strong>{fullName}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
