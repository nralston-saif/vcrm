import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { notifyNewApplication } from '@/lib/notifications'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'
import { fundConfig } from '@/fund.config'

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

    console.log('Received webhook submission')

    const contentType = request.headers.get('content-type') || ''
    let submissionData: Record<string, unknown> = {}

    // Support both JSON and form-encoded payloads
    if (contentType.includes('application/json')) {
      submissionData = await request.json()
    } else {
      const formData = await request.formData()
      console.log('FormData keys received:', Array.from(formData.keys()))

      const rawRequest = formData.get('rawRequest')
      const pretty = formData.get('pretty')

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

      // Also check top-level form fields
      for (const [key, value] of formData.entries()) {
        if (!submissionData[key] && typeof value === 'string') {
          submissionData[key] = value
        }
      }
    }

    function getFormField(key: string): string | null {
      // Check JotForm-style nested answers
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

      // Check top-level fields (Typeform, Google Forms, custom webhooks)
      if (submissionData[key]) {
        const trimmed = String(submissionData[key]).trim()
        return trimmed || null
      }

      return null
    }

    const fieldMap = fundConfig.webhookFieldMap
    const companyName = getFormField(fieldMap.companyName) || 'Unknown Company'
    const website = getFormField(fieldMap.website)
    const companyDescription = getFormField(fieldMap.companyDescription)

    let companyId: string | null = null
    try {
      companyId = await findOrCreateCompany(companyName, website, companyDescription)
    } catch (err) {
      console.error('Failed to find/create company, proceeding without company_id:', err)
    }
    const application = {
      submission_id: submissionData.submission_id || submissionData.submissionID || Date.now().toString(),
      submitted_at: submissionData.created_at || new Date().toISOString(),
      company_name: companyName,
      company_id: companyId,
      founder_names: getFormField(fieldMap.founderNames),
      founder_linkedins: getFormField(fieldMap.founderLinkedins),
      founder_bios: getFormField(fieldMap.founderBios),
      primary_email: getFormField(fieldMap.primaryEmail),
      company_description: companyDescription,
      website,
      previous_funding: getFormField(fieldMap.previousFunding),
      deck_link: getFormField(fieldMap.deckLink),
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
