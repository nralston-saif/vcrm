import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// Force dynamic to prevent caching - required for Vercel cron jobs
export const dynamic = 'force-dynamic'

// Initialize Supabase with service role key
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Initialize Anthropic client
const getAnthropic = () => new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const SYSTEM_PROMPT = `You are a helpful assistant that generates concise ticket completion reports for a venture capital team.

Your task is to summarize completed tickets into a clear, actionable report.

Output format (JSON):
{
  "summary": "2-3 sentence overview of what was accomplished",
  "ticketsByPerson": [
    {
      "name": "Person Name",
      "completed": 3,
      "tickets": [
        {
          "title": "Ticket title",
          "resolution": "Brief summary of how it was resolved based on final comment"
        }
      ]
    }
  ],
  "highlights": ["Notable accomplishment 1", "Notable accomplishment 2"],
  "carryOver": ["In-progress item that may need attention"],
  "unassignedTickets": ["Unassigned ticket title 1", "Unassigned ticket title 2"]
}

Guidelines:
- Include the ticket title and a brief resolution summary (from the final comment if available)
- Keep resolution summaries brief (under 20 words each)
- Focus on outcomes, not process
- Highlight any high-priority items that were completed
- Note patterns (e.g., "3 portfolio company follow-ups completed")
- For carryOver, mention high-priority open tickets that are overdue or due soon
- For unassignedTickets, list all tickets that have no assignee - these need attention
- Be concise - this is a quick status update, not a detailed report`

// Verify authorization for cron jobs - only accepts Authorization: Bearer ${CRON_SECRET}
function verifyAuthorization(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET) {
    console.error('CRON_SECRET not configured')
    return false
  }
  return authHeader === `Bearer ${process.env.CRON_SECRET}`
}

// GET: Generate scheduled reports (called by Vercel cron)
// Vercel cron jobs always use GET requests
export async function GET(request: NextRequest) {
  try {
    // Verify authorization - Vercel sends Authorization: Bearer ${CRON_SECRET}
    if (!verifyAuthorization(request)) {
      console.error('Cron auth failed. Headers:', Object.fromEntries(request.headers.entries()))
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Determine what to generate
    const now = new Date()
    const dayOfWeek = now.getDay() // 0 = Sunday

    const results = []

    // Generate daily report
    const dailyResult = await generateReport('daily', now)
    results.push({ type: 'daily', ...dailyResult })

    // Generate weekly report on Sundays
    if (dayOfWeek === 0) {
      const weeklyResult = await generateReport('weekly', now)
      results.push({ type: 'weekly', ...weeklyResult })
    }

    return NextResponse.json({
      success: true,
      date: now.toISOString(),
      results,
    })

  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      { error: 'Failed to generate reports' },
      { status: 500 }
    )
  }
}

// POST: Backfill historical reports or generate for specific date
export async function POST(request: NextRequest) {
  // Verify authorization with service role key for admin operations
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { backfillDate } = body

    // If specific date provided, generate for that date only
    if (backfillDate) {
      // Parse date as noon Pacific time to avoid timezone boundary issues
      // e.g., "2026-01-22" becomes "2026-01-22T12:00:00" in PT
      const date = new Date(`${backfillDate}T12:00:00-08:00`)
      const dayOfWeek = date.getDay()
      const results = []

      const dailyResult = await generateReport('daily', date)
      results.push({ type: 'daily', ...dailyResult })

      if (dayOfWeek === 0) {
        const weeklyResult = await generateReport('weekly', date)
        results.push({ type: 'weekly', ...weeklyResult })
      }

      return NextResponse.json({
        success: true,
        date: date.toISOString(),
        results,
      })
    }

    // Full backfill mode - find earliest archived ticket
    const { data: earliestTicket } = await getSupabase()
      .from('tickets')
      .select('archived_at')
      .eq('status', 'archived')
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: true })
      .limit(1)
      .single()

    if (!earliestTicket?.archived_at) {
      return NextResponse.json({
        success: true,
        message: 'No archived tickets found',
        reportsGenerated: 0,
      })
    }

    const startDate = new Date(earliestTicket.archived_at)
    startDate.setHours(0, 0, 0, 0) // Start of day
    const today = new Date()
    today.setHours(23, 59, 59, 999) // End of today

    const results = []
    let currentDate = new Date(startDate)

    // Generate daily reports for each day
    while (currentDate <= today) {
      const endOfDay = new Date(currentDate)
      endOfDay.setHours(23, 59, 59, 999)

      // Check if report already exists for this day
      const { data: existingDaily } = await getSupabase()
        .from('ticket_reports')
        .select('id')
        .eq('report_type', 'daily')
        .gte('period_end', currentDate.toISOString())
        .lte('period_end', endOfDay.toISOString())
        .limit(1)

      if (!existingDaily?.length) {
        const dailyResult = await generateReport('daily', endOfDay)
        if (dailyResult.generated) {
          results.push({ date: currentDate.toISOString().split('T')[0], type: 'daily', ...dailyResult })
        }
      }

      // Generate weekly report on Sundays
      if (currentDate.getDay() === 0) {
        const { data: existingWeekly } = await getSupabase()
          .from('ticket_reports')
          .select('id')
          .eq('report_type', 'weekly')
          .gte('period_end', currentDate.toISOString())
          .lte('period_end', endOfDay.toISOString())
          .limit(1)

        if (!existingWeekly?.length) {
          const weeklyResult = await generateReport('weekly', endOfDay)
          if (weeklyResult.generated) {
            results.push({ date: currentDate.toISOString().split('T')[0], type: 'weekly', ...weeklyResult })
          }
        }
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return NextResponse.json({
      success: true,
      startDate: startDate.toISOString(),
      endDate: today.toISOString(),
      reportsGenerated: results.length,
      results,
    })

  } catch (error) {
    console.error('Backfill error:', error)
    return NextResponse.json(
      { error: 'Failed to backfill reports' },
      { status: 500 }
    )
  }
}

// Get Pacific time date boundaries (handles PST/PDT automatically)
function getPacificDayBoundaries(date: Date): { start: Date; end: Date } {
  // Format date in Pacific timezone to get the local date
  const pacificDate = date.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })

  // Create start of day in Pacific (midnight PT)
  const startPT = new Date(`${pacificDate}T00:00:00-08:00`)
  // Create end of day in Pacific (23:59:59.999 PT)
  const endPT = new Date(`${pacificDate}T23:59:59.999-08:00`)

  // Adjust for PDT if needed by checking actual offset
  const testDate = new Date(`${pacificDate}T12:00:00`)
  const pacificOffset = -new Date(testDate.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })).getTimezoneOffset() / 60

  if (pacificOffset === -7) {
    // PDT: adjust from -08:00 to -07:00
    startPT.setHours(startPT.getHours() - 1)
    endPT.setHours(endPT.getHours() - 1)
  }

  return { start: startPT, end: endPT }
}

async function generateReport(
  reportType: 'daily' | 'weekly',
  endDate: Date
): Promise<{ generated: boolean; saved: boolean; ticketCount: number; error?: string }> {
  try {
    let startDate: Date
    let periodEnd: Date

    if (reportType === 'daily') {
      // Use Pacific time calendar day for daily reports
      // Get yesterday's date in Pacific time
      const yesterday = new Date(endDate)
      yesterday.setDate(yesterday.getDate() - 1)
      const boundaries = getPacificDayBoundaries(yesterday)
      startDate = boundaries.start
      periodEnd = boundaries.end
    } else {
      // Weekly: go back 7 days from end of yesterday (Pacific)
      const yesterday = new Date(endDate)
      yesterday.setDate(yesterday.getDate() - 1)
      const endBoundaries = getPacificDayBoundaries(yesterday)
      periodEnd = endBoundaries.end

      const weekAgo = new Date(yesterday)
      weekAgo.setDate(weekAgo.getDate() - 6)
      const startBoundaries = getPacificDayBoundaries(weekAgo)
      startDate = startBoundaries.start
    }

    // Fetch completed tickets with comments in the date range
    const { data: completedTickets, error: ticketsError } = await getSupabase()
      .from('tickets')
      .select(`
        id,
        title,
        description,
        priority,
        archived_at,
        assigned_to,
        related_company,
        tags,
        assigned_partner:people!tickets_assigned_to_fkey(id, first_name, last_name, email),
        company:companies!tickets_related_company_fkey(id, name),
        comments:ticket_comments(id, content, is_final_comment, author:people!ticket_comments_author_id_fkey(first_name, last_name))
      `)
      .eq('status', 'archived')
      .gte('archived_at', startDate.toISOString())
      .lte('archived_at', periodEnd.toISOString())
      .order('archived_at', { ascending: false })

    if (ticketsError) {
      console.error('Error fetching tickets:', ticketsError)
      return { generated: false, saved: false, ticketCount: 0, error: ticketsError.message }
    }

    const ticketCount = completedTickets?.length || 0

    // Skip daily reports with no tickets (but always generate weekly)
    if (ticketCount === 0 && reportType === 'daily') {
      return { generated: false, saved: false, ticketCount: 0 }
    }

    // Fetch open high-priority tickets at that point in time
    const { data: openTickets } = await getSupabase()
      .from('tickets')
      .select(`
        id,
        title,
        priority,
        due_date,
        status,
        assigned_partner:people!tickets_assigned_to_fkey(id, first_name, last_name)
      `)
      .neq('status', 'archived')
      .or(`priority.eq.high,due_date.lte.${periodEnd.toISOString()}`)
      .order('priority', { ascending: true })
      .limit(10)

    // Fetch unassigned tickets
    const { data: unassignedTickets } = await getSupabase()
      .from('tickets')
      .select(`
        id,
        title,
        priority,
        due_date,
        status,
        created_at
      `)
      .neq('status', 'archived')
      .is('assigned_to', null)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })

    // Format data for Claude
    const completedData = completedTickets?.map(t => {
      const comments = (t.comments as any[]) || []
      const finalComment = comments.find((c: any) => c.is_final_comment)
      const lastComment = comments[comments.length - 1]
      const resolutionComment = finalComment || lastComment

      return {
        title: t.title,
        description: t.description?.substring(0, 100),
        priority: t.priority,
        assignee: t.assigned_partner
          ? `${(t.assigned_partner as any).first_name} ${(t.assigned_partner as any).last_name}`.trim()
          : 'Unassigned',
        company: (t.company as any)?.name || null,
        tags: t.tags,
        finalComment: resolutionComment?.content?.substring(0, 200) || null,
        commentAuthor: resolutionComment?.author
          ? `${resolutionComment.author.first_name} ${resolutionComment.author.last_name}`.trim()
          : null,
      }
    }) || []

    const openData = openTickets?.map(t => ({
      title: t.title,
      priority: t.priority,
      dueDate: t.due_date,
      status: t.status,
      assignee: t.assigned_partner
        ? `${(t.assigned_partner as any).first_name} ${(t.assigned_partner as any).last_name}`.trim()
        : 'Unassigned',
      isOverdue: t.due_date && new Date(t.due_date) < periodEnd,
    })) || []

    const unassignedData = unassignedTickets?.map(t => ({
      title: t.title,
      priority: t.priority,
      dueDate: t.due_date,
      status: t.status,
      createdAt: t.created_at,
    })) || []

    let reportData
    if (ticketCount === 0) {
      // Empty weekly report
      reportData = {
        summary: `No tickets were completed in the last 7 days.`,
        ticketsByPerson: [],
        highlights: [],
        carryOver: openData.slice(0, 5).map(t =>
          `${t.title} (${t.priority} priority${t.isOverdue ? ', OVERDUE' : ''}) - ${t.assignee}`
        ),
        unassignedTickets: unassignedData.map(t =>
          `${t.title} (${t.priority} priority)`
        ),
      }
    } else {
      // Call Claude to generate the report
      const userPrompt = `Generate a ${reportType} ticket completion report.

Completed Tickets (${completedData.length} total):
${JSON.stringify(completedData, null, 2)}

Open High-Priority/Overdue Tickets:
${JSON.stringify(openData, null, 2)}

Unassigned Tickets (${unassignedData.length} total):
${JSON.stringify(unassignedData, null, 2)}

Generate a JSON report summarizing the completed work. Include ticket titles and resolution summaries based on the final comments. List all unassigned tickets in the unassignedTickets array.`

      const message = await getAnthropic().messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: userPrompt }
        ],
      })

      const textContent = message.content.find(c => c.type === 'text')
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text response from Claude')
      }

      try {
        let jsonStr = textContent.text
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (jsonMatch) {
          jsonStr = jsonMatch[1]
        }
        reportData = JSON.parse(jsonStr.trim())
      } catch (parseError) {
        console.error('Failed to parse Claude response')
        reportData = {
          summary: `${completedData.length} tickets were completed.`,
          ticketsByPerson: [],
          highlights: [],
          carryOver: [],
        }
      }
    }

    // Save to database
    const { error: saveError } = await getSupabase()
      .from('ticket_reports')
      .insert({
        report_type: reportType,
        period_start: startDate.toISOString(),
        period_end: periodEnd.toISOString(),
        total_completed: ticketCount,
        summary: reportData.summary,
        report_data: {
          ticketsByPerson: reportData.ticketsByPerson || [],
          highlights: reportData.highlights || [],
          carryOver: reportData.carryOver || [],
          unassignedTickets: reportData.unassignedTickets || [],
        },
      })

    if (saveError) {
      console.error('Error saving report:', saveError)
      return { generated: true, saved: false, ticketCount, error: saveError.message }
    }

    return { generated: true, saved: true, ticketCount }

  } catch (error) {
    console.error('Error generating report:', error)
    return {
      generated: false,
      saved: false,
      ticketCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
