import { requireAuth } from '@/lib/auth/requireAuth'
import Navigation from '@/components/Navigation'
import ImportClient from './ImportClient'

export default async function ImportPage() {
  const { profile } = await requireAuth()

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <Navigation
        userName={profile.name || profile.email || 'User'}
        personId={profile.id}
      />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <ImportClient />
      </main>
    </div>
  )
}
