'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type PersonData = {
  id: string
  first_name: string | null
  last_name: string | null
  title: string | null
  bio: string | null
  avatar_url: string | null
  email: string | null
  linkedin_url: string | null
  twitter_url: string | null
  mobile_phone: string | null
  location: string | null
  role: string
  companies?: Array<{
    company: {
      id: string
      name: string
      logo_url: string | null
      stage: string | null
    }
    relationship_type: string
    title: string | null
    is_primary_contact: boolean
  }>
}

type PersonModalProps = {
  personId: string
  onClose: () => void
}

export default function PersonModal({ personId, onClose }: PersonModalProps) {
  const router = useRouter()
  const [person, setPerson] = useState<PersonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPerson() {
      const supabase = createClient()

      const { data, error: fetchError } = await supabase
        .from('people')
        .select(`
          id,
          first_name,
          last_name,
          title,
          bio,
          avatar_url,
          email,
          linkedin_url,
          twitter_url,
          mobile_phone,
          location,
          role,
          companies:company_people(
            relationship_type,
            title,
            is_primary_contact,
            company:companies(
              id,
              name,
              logo_url,
              stage
            )
          )
        `)
        .eq('id', personId)
        .single()

      if (fetchError) {
        setError(fetchError.message)
      } else {
        setPerson(data as PersonData)
      }
      setLoading(false)
    }

    fetchPerson()
  }, [personId])

  const fullName = person
    ? `${person.first_name || ''} ${person.last_name || ''}`.trim() || 'Unknown'
    : ''

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-3 text-gray-500">Loading...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-red-600">Error: {error}</p>
            <button onClick={onClose} className="mt-4 text-gray-600 hover:text-gray-900">Close</button>
          </div>
        ) : person ? (
          <>
            {/* Header with photo and basic info */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                {person.avatar_url ? (
                  <img
                    src={person.avatar_url}
                    alt={fullName}
                    className="w-20 h-20 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl font-medium text-gray-500">
                      {person.first_name?.[0] || '?'}
                    </span>
                  </div>
                )}

                {/* Name and title */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-gray-900">{fullName}</h2>
                  {person.title && (
                    <p className="text-gray-600 mt-1">{person.title}</p>
                  )}
                  {person.location && (
                    <p className="text-sm text-gray-500 mt-1">{person.location}</p>
                  )}
                  <span className="inline-block mt-2 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                    {person.role}
                  </span>
                </div>

                {/* Close button */}
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 p-1 -m-1 flex-shrink-0"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Bio */}
              {person.bio && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">About</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{person.bio}</p>
                </div>
              )}

              {/* Contact Info */}
              {(person.email || person.mobile_phone || person.linkedin_url || person.twitter_url) && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Contact</h3>
                  <div className="space-y-2">
                    {person.email && (
                      <a
                        href={`mailto:${person.email}`}
                        className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        {person.email}
                      </a>
                    )}
                    {person.mobile_phone && (
                      <a
                        href={`tel:${person.mobile_phone}`}
                        className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
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
                        className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        X / Twitter
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Company Associations */}
              {person.companies && person.companies.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Companies</h3>
                  <div className="space-y-2">
                    {person.companies.map((assoc, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
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
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {assoc.company?.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {assoc.title || assoc.relationship_type}
                            {assoc.company?.stage && (
                              <span className="ml-2 text-gray-400">• {assoc.company.stage}</span>
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex-shrink-0 flex gap-3">
              <button
                onClick={() => {
                  onClose()
                  router.push(`/people/${personId}`)
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-100"
              >
                View Full Profile
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800"
              >
                Close
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
