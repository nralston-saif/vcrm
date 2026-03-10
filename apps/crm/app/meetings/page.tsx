import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Navigation from '@/components/Navigation'
import { requireAuth } from '@/lib/auth/requireAuth'
import { fundConfig } from '@/fund.config'
import MeetingsClient from './MeetingsClient'
import type { Meeting, MeetingNote, Person } from '@vcrm/supabase'

export default async function MeetingsPage() {
  if (!fundConfig.modules.meetings) notFound()
  const supabase = await createClient()

  const { profile } = await requireAuth()

  const typedProfile = profile as Person

  // Fetch all meetings ordered by creation date (newest first)
  const { data: meetings } = await supabase
    .from('meetings')
    .select('id, title, meeting_date, content, created_by, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(100)

  // Get all partners for the people selector
  const { data: partners } = await supabase
    .from('people')
    .select('id, first_name, last_name, name, avatar_url')
    .eq('role', 'partner')
    .eq('status', 'active')
    .order('first_name')

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation userName={typedProfile.first_name || 'User'} personId={typedProfile.id} />
      <MeetingsClient
        meetings={(meetings || []) as Meeting[]}
        currentUser={typedProfile}
        partners={(partners || []) as Person[]}
      />
    </div>
  )
}
