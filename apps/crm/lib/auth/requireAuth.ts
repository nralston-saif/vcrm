import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Database } from '@/lib/types/database'

type Person = Database['public']['Tables']['people']['Row']

/**
 * Require authentication for a page.
 * Returns the authenticated user's profile.
 * Redirects to /login if not authenticated or no profile found.
 */
export async function requireAuth(): Promise<{
  user: { id: string; email: string }
  profile: Person
}> {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  // Find the person record linked to this auth user
  const { data: profile } = await supabase
    .from('people')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile) {
    // User is authenticated but has no profile - redirect to login
    // This shouldn't happen in invite-only mode, but handle gracefully
    redirect('/login')
  }

  return {
    user: { id: user.id, email: user.email || '' },
    profile,
  }
}

/**
 * Require authentication for an API route.
 * Returns the authenticated user's profile or null.
 */
export async function requireAuthApi(): Promise<{
  user: { id: string; email: string }
  profile: Person
} | null> {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  const { data: profile } = await supabase
    .from('people')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile) {
    return null
  }

  return {
    user: { id: user.id, email: user.email || '' },
    profile,
  }
}
