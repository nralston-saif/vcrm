import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { notifyNewApplication } from '@/lib/notifications'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'

const RATE_LIMIT_WINDOW = 60 * 1000
const RATE_LIMIT_MAX = 10

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function normalizeWebsite(url: string | null): string | null {
  if (!url) return null
  try {
    return url
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')
  } catch {
    return url.toLowerCase().trim()
  }
}

async function findOrCreateCompany(
  companyName: string,
  website: string | null,
  description: string | null
): Promise<string> {
  const normalizedWebsite = normalizeWebsite(website)

  const { data: existingByName } = await getSupabase()
    .from('companies')
    .select('id')
    .ilike('name', companyName)
    .limit(1)
    .single()

  if (existingByName) {
    console.log(`Found existing company by name: ${companyName} (${existingByName.id})`)
    return existingByName.id
  }

  if (normalizedWebsite) {
    const { data: existingByWebsite } = await getSupabase()
      .from('companies')
      .select('id')
      .ilike('website', `%${normalizedWebsite}%`)
      .limit(1)
      .single()

    if (existingByWebsite) {
      console.log(`Found existing company by website: ${website} (${existingByWebsite.id})`)
      return existingByWebsite.id
    }
  }

  const { data: newCompany, error } = await getSupabase()
    .from('companies')
    .insert({
      name: companyName,
      website: website,
      short_description: description,
      stage: 'prospect',
      is_active: true,
      is_aisafety_company: false,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating company:', error)
    throw new Error(`Failed to create company: ${error.message}`)
  }

  console.log(`Created new prospect company: ${companyName} (${newCompany.id})`)
  return newCompany.id
}

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET

export async function POST(request: NextRequest) {
  const ip = getClientIP(request.headers)
  const rateLimit = await checkRateLimit(`webhook:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  if (!WEBHOOK_SECRET) {
    console.error('WEBHOOK_SECRET is not configured - rejecting request')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }

  const providedSecret = request.headers.get('X-Webhook-Secret')
  if (providedSecret !== WEBHOOK_SECRET) {
    console.error('Webhook authentication failed')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {

    console.log('Received JotForm webhook - v8 with header authentication')

    const formData = await request.formData()
    console.log('FormData keys received:', Array.from(formData.keys()))

    const rawRequest = formData.get('rawRequest')
    const pretty = formData.get('pretty')
    let submissionData: Record<string, unknown> = {}

    if (rawRequest && typeof rawRequest === 'string') {
      try {
        submissionData = JSON.parse(rawRequest)
      } catch {
        console.error('Failed to parse rawRequest')
      }
    }

    if (pretty && typeof pretty === 'string') {
      try {
        const prettyData = JSON.parse(pretty)
        if (prettyData.answers) {
          submissionData = prettyData
        }
      } catch {
        console.error('Failed to parse pretty')
      }
    }

    function getFormField(key: string): string | null {
      const answers = submissionData.answers as Record<string, unknown> | undefined
      if (answers?.[key]) {
        const answer = answers[key]
        const value = typeof answer === 'object' && answer !== null
          ? (answer as Record<string, unknown>).answer
          : answer
        if (!value) return null
        const trimmed = String(value).trim()
        return trimmed || null
      }

      if (submissionData[key]) {
        const trimmed = String(submissionData[key]).trim()
        return trimmed || null
      }

      return null
    }

    const companyName = getFormField('q29_companyName') || 'Unknown Company'
    const website = getFormField('q31_websiteif')
    const companyDescription = getFormField('q30_companyDescription')

    let companyId: string | null = null
    try {
      companyId = await findOrCreateCompany(companyName, website, companyDescription)
    } catch (err) {
      console.error('Failed to find/create company, proceeding without company_id:', err)
    }
    const application = {
      submission_id: submissionData.submission_id || formData.get('submissionID') || Date.now().toString(),
      submitted_at: submissionData.created_at || new Date().toISOString(),
      company_name: companyName,
      company_id: companyId,
      founder_names: getFormField('q26_typeA'),
      founder_linkedins: getFormField('q28_founderLinkedins'),
      founder_bios: getFormField('q40_founderBios'),
      primary_email: getFormField('q32_primaryEmail'),
      company_description: companyDescription,
      website,
      previous_funding: getFormField('q35_haveYou'),
      deck_link: getFormField('q41_linkTo'),
      stage: 'new',
      votes_revealed: false,
      all_votes_in: false,
    }

    const { data, error } = await getSupabase()
      .from('applications')
      .insert(application)
      .select()
      .single()

    if (error) {
      console.error('Error inserting application:', error)
      return NextResponse.json(
        { error: 'Failed to save application', details: error.message },
        { status: 500 }
      )
    }

    console.log('Application created:', data.id)
    await notifyNewApplication(data.id, application.company_name)

    return NextResponse.json({
      success: true,
      applicationId: data.id,
      message: 'Application received successfully',
    })
  } catch (error) {
    console.error('Webhook error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Webhook processing failed', details: message },
      { status: 500 }
    )
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: 'ok' })
}
