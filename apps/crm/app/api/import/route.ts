import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth/requireAuth'
import { createClient } from '@/lib/supabase/server'

function parseCSV(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = content.split('\n').filter((l) => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }

  function parseLine(line: string): string[] {
    const fields: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    fields.push(current.trim())
    return fields
  }

  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map((line) => {
    const values = parseLine(line)
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      obj[h] = values[i] || ''
    })
    return obj
  })

  return { headers, rows }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthApi()
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const importType = formData.get('type') as string | null

  if (!file || !importType) {
    return NextResponse.json({ error: 'Missing file or type' }, { status: 400 })
  }

  const content = await file.text()
  const { rows } = parseCSV(content)

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No data rows found in CSV' }, { status: 400 })
  }

  let success = 0
  let failed = 0
  const errors: string[] = []

  if (importType === 'companies') {
    for (const row of rows) {
      const { error } = await supabase.from('companies').insert({
        name: row.name,
        short_description: row.short_description || null,
        website: row.website || null,
        industry: row.industry || null,
        city: row.city || null,
        country: row.country || null,
        founded_year: row.founded_year ? parseInt(row.founded_year) : null,
        stage: row.stage || 'prospect',
        tags: row.tags ? row.tags.split(',').map((t: string) => t.trim()) : [],
        is_active: true,
      })
      if (error) {
        failed++
        errors.push(`${row.name}: ${error.message}`)
      } else {
        success++
      }
    }
  } else if (importType === 'contacts') {
    for (const row of rows) {
      const { error } = await supabase.from('people').insert({
        first_name: row.first_name,
        last_name: row.last_name,
        name: `${row.first_name} ${row.last_name}`.trim(),
        email: row.email || null,
        title: row.title || null,
        role: row.role || 'contact',
        status: 'active',
        linkedin_url: row.linkedin_url || null,
        mobile_phone: row.mobile_phone || null,
        location: row.location || null,
        tags: row.tags ? row.tags.split(',').map((t: string) => t.trim()) : [],
      })
      if (error) {
        failed++
        errors.push(`${row.first_name} ${row.last_name}: ${error.message}`)
      } else {
        success++
      }
    }
  } else if (importType === 'investments') {
    // Look up company IDs by name
    const { data: companies } = await supabase.from('companies').select('id, name')
    const companyMap = new Map(
      (companies || []).map((c) => [c.name.toLowerCase(), c.id])
    )

    // Look up partner IDs by email
    const { data: partners } = await supabase
      .from('people')
      .select('id, email')
      .eq('role', 'partner')
    const partnerMap = new Map(
      (partners || []).map((p) => [p.email?.toLowerCase(), p.id])
    )

    for (const row of rows) {
      const companyId = companyMap.get(row.company_name?.toLowerCase())
      if (!companyId) {
        failed++
        errors.push(`${row.company_name}: company not found — import companies first`)
        continue
      }

      const leadPartnerId = row.lead_partner_email
        ? partnerMap.get(row.lead_partner_email.toLowerCase()) || null
        : null

      const { error } = await supabase.from('investments').insert({
        company_id: companyId,
        amount: row.amount ? parseFloat(row.amount) : null,
        round: row.round || null,
        type: row.type?.toLowerCase() || 'safe',
        investment_date: row.date || row.investment_date || new Date().toISOString().split('T')[0],
        lead_partner_id: leadPartnerId,
        notes: row.notes || null,
      })
      if (error) {
        failed++
        errors.push(`${row.company_name}: ${error.message}`)
      } else {
        success++
      }
    }
  } else {
    return NextResponse.json({ error: 'Invalid import type' }, { status: 400 })
  }

  return NextResponse.json({ success, failed, errors, total: rows.length })
}
