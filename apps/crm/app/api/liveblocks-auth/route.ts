import { NextRequest } from 'next/server'
import { Liveblocks } from '@liveblocks/node'
import { createClient } from '@/lib/supabase/server'

// Lazy initialize Liveblocks to avoid build-time errors when secret key is not set
function getLiveblocks(): Liveblocks | null {
  const secretKey = process.env.LIVEBLOCKS_SECRET_KEY
  if (!secretKey || !secretKey.startsWith('sk_')) {
    console.log('[Liveblocks Auth] Secret key not configured or invalid')
    return null
  }
  return new Liveblocks({ secret: secretKey })
}

export async function POST(request: NextRequest) {
  console.log('[Liveblocks Auth] Auth request received')

  // Check if Liveblocks is properly configured with a secret key
  const liveblocks = getLiveblocks()
  if (!liveblocks) {
    return new Response(
      JSON.stringify({ error: 'Liveblocks auth endpoint not configured. Using public key authentication instead.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const supabase = await createClient()

  // Get the current user from Supabase auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.log('[Liveblocks Auth] Supabase auth error:', authError.message)
    return new Response(JSON.stringify({ error: 'Authentication error' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  if (!user) {
    console.log('[Liveblocks Auth] No user session found')
    return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  console.log('[Liveblocks Auth] User authenticated')

  // Get the user's profile - check both auth_user_id and email for flexibility
  let { data: profile, error: profileError } = await supabase
    .from('people')
    .select('id, first_name, last_name, name, role, email')
    .eq('auth_user_id', user.id)
    .single()

  // If not found by auth_user_id, try by email
  if (!profile && user.email) {
    console.log('[Liveblocks Auth] Profile not found by auth_user_id, trying email')
    const emailResult = await supabase
      .from('people')
      .select('id, first_name, last_name, name, role, email')
      .eq('email', user.email)
      .single()
    profile = emailResult.data
    profileError = emailResult.error
  }

  if (!profile) {
    console.log('[Liveblocks Auth] Profile not found for authenticated user')
    return new Response(JSON.stringify({ error: 'Profile not found' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
  }

  console.log('[Liveblocks Auth] Profile found, role:', profile.role)

  // Only partners can access collaborative features
  if (profile.role !== 'partner') {
    console.log('[Liveblocks Auth] User is not a partner:', profile.role)
    return new Response(JSON.stringify({ error: 'Partners only' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
  }

  // Get the room from the request
  const { room } = await request.json()
  console.log('[Liveblocks Auth] Authorizing room:', room)

  // Build user display name - just first initial for cursor label
  const displayName = profile.first_name
    ? profile.first_name.charAt(0).toUpperCase()
    : (profile.name?.charAt(0) || profile.email?.charAt(0) || '?').toUpperCase()

  // Prepare the session for Liveblocks
  const session = liveblocks.prepareSession(profile.id, {
    userInfo: {
      name: displayName,
      email: profile.email || '',
    },
  })

  // Allow the user to access the requested room
  session.allow(room, session.FULL_ACCESS)

  // Authorize and return the token
  const { status, body } = await session.authorize()

  console.log('[Liveblocks Auth] Authorization complete, status:', status)

  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}
