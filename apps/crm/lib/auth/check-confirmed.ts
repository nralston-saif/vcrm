import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Check if an email address has been confirmed in Supabase Auth.
 * Uses the service role client to bypass RLS.
 * Paginates through all users to handle >1000 auth users.
 */
export async function checkEmailConfirmed(email: string): Promise<boolean> {
  const supabase = getServiceClient()
  const normalizedEmail = email.toLowerCase()
  const perPage = 1000

  let page = 1
  while (true) {
    const { data: authUsers, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    })

    if (error || !authUsers?.users) {
      console.error('Error checking email confirmation status:', error)
      return false
    }

    const user = authUsers.users.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    )

    if (user) {
      return !!user.email_confirmed_at
    }

    // No more pages if we got fewer than perPage results
    if (authUsers.users.length < perPage) {
      break
    }

    page++
  }

  return false
}
