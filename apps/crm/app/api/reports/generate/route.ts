import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuthApi } from '@/lib/auth/requireAuth'
import { parsePagination } from '@/lib/pagination'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
  "carryOver": ["In-progress item that may need attention"]
}

Guidelines:
- Include the ticket title and a brief resolution summary (from the final comment if available)
- Keep resolution summaries brief (under 20 words each)
- Focus on outcomes, not process
- Highlight any high-priority items that were completed
- Note patterns (e.g., "3 portfolio company follow-ups completed")
- For carryOver, mention high-priority open tickets that are overdue or due soon
- Be concise - this is a quick status update, not a detailed report`

export async function POST(request: NextRequest) {
  // Verify authentication
  const authResult = await requireAuthApi()
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { reportType, save = false } = await request.json()

    if (!reportType || !['daily', 'weekly'].includes(reportType)) {
      return NextResponse.json(
        { error: 'Invalid report type. Must be "daily" or "weekly".' },
        { status: 400 }
      )
    }

    // Calculate date range
    const now = new Date()
    const startDate = new Date()
    if (reportType === 'daily') {
      startDate.setHours(startDate.getHours() - 24)
    } else {
      startDate.setDate(startDate.getDate() - 7)
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
      .lte('archived_at', now.toISOString())
      .order('archived_at', { ascending: false })

    if (ticketsError) {
      console.error('Error fetching completed tickets:', ticketsError)
      return NextResponse.json(
        { error: 'Failed to fetch tickets' },
        { status: 500 }
      )
    }

    // Fetch in-progress/open tickets that are high priority or overdue
    const { data: openTickets, error: openError } = await getSupabase()
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
      .or(`priority.eq.high,due_date.lte.${now.toISOString()}`)
      .order('priority', { ascending: true })
      .limit(10)

    if (openError) {
      console.error('Error fetching open tickets:', openError)
    }

    // Format data for Claude - include comments
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
      isOverdue: t.due_date && new Date(t.due_date) < now,
    })) || []

    const periodLabel = reportType === 'daily'
      ? `Daily Report (${startDate.toLocaleDateString()} - ${now.toLocaleDateString()})`
      : `Weekly Report (${startDate.toLocaleDateString()} - ${now.toLocaleDateString()})`

    // If no tickets, return a simple response without calling Claude
    if (completedData.length === 0) {
      const emptyReport = {
        period: periodLabel,
        periodStart: startDate.toISOString(),
        periodEnd: now.toISOString(),
        generatedAt: now.toISOString(),
        summary: `No tickets were completed in the ${reportType === 'daily' ? 'last 24 hours' : 'last 7 days'}.`,
        ticketsByPerson: [],
        totalCompleted: 0,
        highlights: [],
        carryOver: openData.slice(0, 5).map(t =>
          `${t.title} (${t.priority} priority${t.isOverdue ? ', OVERDUE' : ''}) - ${t.assignee}`
        ),
      }

      // Save empty weekly reports (but not daily)
      if (save && reportType === 'weekly') {
        await saveReport(emptyReport, reportType, startDate, now)
      }

      return NextResponse.json(emptyReport)
    }

    // Call Claude to generate the report
    const userPrompt = `Generate a ${reportType} ticket completion report.

Completed Tickets (${completedData.length} total):
${JSON.stringify(completedData, null, 2)}

Open High-Priority/Overdue Tickets:
${JSON.stringify(openData, null, 2)}

Generate a JSON report summarizing the completed work. Include ticket titles and resolution summaries based on the final comments.`

    const message = await getAnthropic().messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: userPrompt }
      ],
    })

    // Extract the text response
    const textContent = message.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    // Parse the JSON response
    let reportData
    try {
      // Extract JSON from the response (handle markdown code blocks)
      let jsonStr = textContent.text
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1]
      }
      reportData = JSON.parse(jsonStr.trim())
    } catch (parseError) {
      console.error('Failed to parse Claude response:', textContent.text)
      // Fallback to basic report
      reportData = {
        summary: `${completedData.length} tickets were completed.`,
        ticketsByPerson: [],
        highlights: [],
        carryOver: [],
      }
    }

    const finalReport = {
      period: periodLabel,
      periodStart: startDate.toISOString(),
      periodEnd: now.toISOString(),
      generatedAt: now.toISOString(),
      summary: reportData.summary,
      ticketsByPerson: reportData.ticketsByPerson || [],
      totalCompleted: completedData.length,
      highlights: reportData.highlights || [],
      carryOver: reportData.carryOver || [],
    }

    // Save to database if requested
    if (save) {
      await saveReport(finalReport, reportType, startDate, now)
    }

    return NextResponse.json(finalReport)

  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}

// GET endpoint to fetch past reports
export async function GET(request: NextRequest) {
  // Verify authentication
  const authResult = await requireAuthApi()
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get('type') || 'all'
    const { limit } = parsePagination(searchParams, {
      defaultLimit: 20,
      maxLimit: 100,
      maxOffset: 10000,
    })

    let query = getSupabase()
      .from('ticket_reports')
      .select('*')
      .order('period_end', { ascending: false })
      .limit(limit)

    if (reportType !== 'all') {
      query = query.eq('report_type', reportType)
    }

    const { data: reports, error } = await query

    if (error) {
      console.error('Error fetching reports:', error)
      return NextResponse.json(
        { error: 'Failed to fetch reports' },
        { status: 500 }
      )
    }

    return NextResponse.json({ reports })

  } catch (error) {
    console.error('Error fetching reports:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    )
  }
}

async function saveReport(
  report: any,
  reportType: string,
  periodStart: Date,
  periodEnd: Date
) {
  const { error } = await getSupabase()
    .from('ticket_reports')
    .insert({
      report_type: reportType,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      total_completed: report.totalCompleted,
      summary: report.summary,
      report_data: {
        ticketsByPerson: report.ticketsByPerson,
        highlights: report.highlights,
        carryOver: report.carryOver,
      },
    })

  if (error) {
    console.error('Error saving report:', error)
  }
}
