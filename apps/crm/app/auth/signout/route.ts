import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function POST(request: Request) {
  const supabase = await createClient()

  // Sign out the user
  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error('Error signing out:', error)
    redirect('/dashboard')
  }

  // Revalidate the cache for the home page
  revalidatePath('/', 'layout')

  // Redirect to home page
  redirect('/')
}
