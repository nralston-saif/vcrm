import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'

const RATE_LIMIT_WINDOW = 60 * 1000
const RATE_LIMIT_MAX = 30

function sanitizeSearchInput(input: string): string {
  return input
    .replace(/[\\]/g, '\\\\')
    .replace(/[%]/g, '\\%')
    .replace(/[_]/g, '\\_')
    .replace(/[(){},]/g, '')  // Remove chars that break PostgREST filter syntax
    .replace(/['"]/g, '')
    .trim()
}

export async function GET(request: NextRequest) {
  const emptyResults = { applications: [], investments: [], companies: [], people: [] }

  const ip = getClientIP(request.headers)
  const rateLimit = await checkRateLimit(`search:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': '60', 'X-RateLimit-Remaining': '0' } }
    )
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const rawQuery = url.searchParams.get('q')?.trim()

    if (!rawQuery || rawQuery.length < 2) {
      return NextResponse.json(emptyResults)
    }

    const query = sanitizeSearchInput(rawQuery)
    if (query.length < 2) {
      return NextResponse.json(emptyResults)
    }

    const searchPattern = `%${query}%`
    const searchWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 0)

    if (searchWords.length === 0) {
      return NextResponse.json(emptyResults)
    }

    const firstWordPattern = `%${searchWords[0]}%`

    const [
      { data: applications, error: appError },
      { data: investments, error: invError },
      { data: companies, error: compError },
      { data: peopleRaw, error: peopleError },
    ] = await Promise.all([
      supabase
        .from('applications')
        .select('id, company_name, founder_names, company_description, stage, submitted_at')
        .or(`company_name.ilike.${searchPattern},founder_names.ilike.${searchPattern},company_description.ilike.${searchPattern}`)
        .order('submitted_at', { ascending: false })
        .limit(10),
      supabase
        .from('investments')
        .select('id, amount, investment_date, notes, company:companies(name, short_description)')
        .order('investment_date', { ascending: false })
        .limit(50),
      supabase
        .from('companies')
        .select('id, name, short_description, logo_url, industry, city, country, tags')
        .or(`name.ilike.${searchPattern},short_description.ilike.${searchPattern},industry.ilike.${searchPattern},tags.cs.{${searchWords[0]}}`)
        .order('name', { ascending: true })
        .limit(50),
      supabase
        .from('people')
        .select('id, name, first_name, last_name, email, role, status, title, location, avatar_url, tags')
        .or(`name.ilike.${firstWordPattern},first_name.ilike.${firstWordPattern},last_name.ilike.${firstWordPattern},email.ilike.${firstWordPattern},title.ilike.${firstWordPattern},tags.cs.{${searchWords[0]}}`)
        .order('first_name', { ascending: true })
        .limit(50),
    ])

    if (appError) console.error('Error searching applications:', appError)
    if (invError) console.error('Error searching investments:', invError)
    if (compError) console.error('Error searching companies:', compError)
    if (peopleError) console.error('Error searching people:', peopleError)

    const stageOrder: Record<string, number> = {
      new: 1,
      voting: 2,
      deliberation: 3,
      rejected: 4,
      invested: 5,
    }

    type Application = NonNullable<typeof applications>[number]
    const deduplicatedApplications = Object.values(
      (applications || []).reduce(
        (acc, app) => {
          const key = app.company_name.toLowerCase().trim()
          const existingApp = acc[key]
          const appStage = app.stage || 'new'
          const existingStage = existingApp?.stage || 'new'

          if (!existingApp || (stageOrder[appStage] || 0) > (stageOrder[existingStage] || 0)) {
            acc[key] = app
          }
          return acc
        },
        {} as Record<string, Application>
      )
    )

    const people = (peopleRaw || [])
      .filter(person => {
        const searchableText = [
          person.name,
          person.first_name,
          person.last_name,
          person.email,
          person.title,
          ...((person as { tags?: string[] }).tags || []),
        ].filter(Boolean).join(' ').toLowerCase()
        return searchWords.every(word => searchableText.includes(word))
      })
      .slice(0, 10)

    const filteredCompanies = (companies || [])
      .filter(company => {
        const searchableText = [
          company.name,
          company.short_description,
          company.industry,
          company.city,
          company.country,
          ...((company as { tags?: string[] }).tags || []),
        ].filter(Boolean).join(' ').toLowerCase()
        return searchWords.every(word => searchableText.includes(word))
      })
      .slice(0, 10)

    // Filter and transform investments to match expected shape
    const filteredInvestments = (investments || [])
      .filter(inv => {
        const company = inv.company as { name: string; short_description: string | null } | null
        const searchableText = [
          company?.name,
          company?.short_description,
        ].filter(Boolean).join(' ').toLowerCase()
        return searchWords.every(word => searchableText.includes(word))
      })
      .slice(0, 10)
      .map(inv => {
        const company = inv.company as { name: string; short_description: string | null } | null
        return {
          id: inv.id,
          company_name: company?.name || '',
          founders: '', // Founders are now in people, not stored on investment
          description: company?.short_description || '',
          amount: inv.amount,
          investment_date: inv.investment_date,
        }
      })

    return NextResponse.json({
      applications: deduplicatedApplications,
      investments: filteredInvestments,
      companies: filteredCompanies,
      people,
    })
  } catch (error) {
    console.error('Search error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Search failed', details: message }, { status: 500 })
  }
}
