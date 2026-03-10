import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth/requireAuth'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const auth = await requireAuthApi()
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { applicationId } = await request.json()

    if (!applicationId) {
      return NextResponse.json(
        { error: 'applicationId is required' },
        { status: 400 }
      )
    }

    const { error } = await getSupabase()
      .from('applications')
      .update({ email_sent: true, email_sent_at: new Date().toISOString() })
      .eq('id', applicationId)

    if (error) {
      console.error('Failed to mark email as sent:', error)
      return NextResponse.json(
        { error: 'Failed to update email_sent status', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error marking email as sent:', error)
    return NextResponse.json(
      { error: 'Failed to mark email as sent', details: error.message },
      { status: 500 }
    )
  }
}
