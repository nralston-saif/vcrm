import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/requireAuth'

export default async function EditProfilePage() {
  const { profile } = await requireAuth()

  // Redirect to the person's profile page
  redirect(`/people/${profile.id}`)
}
