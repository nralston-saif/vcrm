import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { AINewsTopic } from '@/lib/types/database'
import { parsePagination } from '@/lib/pagination'

const VALID_TOPICS: AINewsTopic[] = ['llm', 'robotics', 'regulation', 'business', 'research', 'healthcare', 'ai_safety', 'general']

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query params with bounded pagination
    const url = new URL(request.url)
    const { limit, offset } = parsePagination(url.searchParams, {
      defaultLimit: 5,
      maxLimit: 50,
      maxOffset: 5000,
    })
    const topicParam = url.searchParams.get('topic')

    // Build query
    let query = supabase
      .from('news_articles')
      .select('*', { count: 'exact' })
      .order('fetch_date', { ascending: false })
      .order('published_at', { ascending: false })

    // Apply topic filter if provided and valid
    if (topicParam && topicParam !== 'all' && VALID_TOPICS.includes(topicParam as AINewsTopic)) {
      query = query.eq('topic', topicParam as AINewsTopic)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: articles, error, count } = await query

    if (error) {
      console.error('Error fetching news articles:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      articles: articles || [],
      total: count || 0,
      hasMore: count ? offset + limit < count : false,
    })

  } catch (error: unknown) {
    console.error('News fetch error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to fetch news articles', details: message },
      { status: 500 }
    )
  }
}
