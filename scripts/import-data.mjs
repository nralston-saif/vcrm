#!/usr/bin/env node

import * as p from '@clack/prompts'
import pc from 'picocolors'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const ENV_PATH = path.join(ROOT, 'apps', 'crm', '.env.local')
const TEMPLATES_DIR = path.join(ROOT, 'templates')

function readEnvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const env = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    env[trimmed.slice(0, eqIndex).trim()] = trimmed.slice(eqIndex + 1).trim()
  }
  return env
}

function parseCSV(content) {
  const lines = content.split('\n').filter((l) => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }

  // Simple CSV parser that handles quoted fields with commas
  function parseLine(line) {
    const fields = []
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
    const obj = {}
    headers.forEach((h, i) => {
      obj[h] = values[i] || ''
    })
    return obj
  })

  return { headers, rows }
}

async function importCompanies(rows, supabaseUrl, serviceRoleKey) {
  const s = p.spinner()
  s.start(`Importing ${rows.length} companies`)

  let success = 0
  let failed = 0

  for (const row of rows) {
    const body = {
      name: row.name,
      short_description: row.short_description || null,
      website: row.website || null,
      industry: row.industry || null,
      city: row.city || null,
      country: row.country || null,
      founded_year: row.founded_year ? parseInt(row.founded_year) : null,
      stage: row.stage || 'prospect',
      tags: row.tags ? row.tags.split(',').map((t) => t.trim()) : [],
      is_active: true,
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/companies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      success++
    } else {
      failed++
      const err = await res.json().catch(() => ({}))
      p.log.warning(`Failed to import "${row.name}": ${err.message || res.statusText}`)
    }
  }

  s.stop(`${pc.green(success + ' imported')}${failed ? `, ${pc.red(failed + ' failed')}` : ''}`)
  return success
}

async function importContacts(rows, supabaseUrl, serviceRoleKey) {
  const s = p.spinner()
  s.start(`Importing ${rows.length} contacts`)

  let success = 0
  let failed = 0

  for (const row of rows) {
    const body = {
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
      tags: row.tags ? row.tags.split(',').map((t) => t.trim()) : [],
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/people`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      success++
    } else {
      failed++
      const err = await res.json().catch(() => ({}))
      p.log.warning(`Failed to import "${row.first_name} ${row.last_name}": ${err.message || res.statusText}`)
    }
  }

  s.stop(`${pc.green(success + ' imported')}${failed ? `, ${pc.red(failed + ' failed')}` : ''}`)
  return success
}

async function importInvestments(rows, supabaseUrl, serviceRoleKey) {
  const s = p.spinner()
  s.start(`Importing ${rows.length} investments`)

  // Look up company IDs and partner IDs
  const companiesRes = await fetch(`${supabaseUrl}/rest/v1/companies?select=id,name`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  })
  const companies = await companiesRes.json()
  const companyMap = new Map(companies.map((c) => [c.name.toLowerCase(), c.id]))

  const partnersRes = await fetch(`${supabaseUrl}/rest/v1/people?select=id,email&role=eq.partner`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  })
  const partners = await partnersRes.json()
  const partnerMap = new Map((partners || []).map((p) => [p.email?.toLowerCase(), p.id]))

  let success = 0
  let failed = 0

  for (const row of rows) {
    const companyId = companyMap.get(row.company_name?.toLowerCase())
    if (!companyId) {
      failed++
      p.log.warning(`Company not found: "${row.company_name}" — import the company first`)
      continue
    }

    const leadPartnerId = row.lead_partner_email
      ? partnerMap.get(row.lead_partner_email.toLowerCase()) || null
      : null

    const body = {
      company_id: companyId,
      amount: row.amount ? parseFloat(row.amount) : null,
      round: row.round || null,
      type: row.type || null,
      date: row.date || null,
      lead_partner_id: leadPartnerId,
      notes: row.notes || null,
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/investments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      success++
    } else {
      failed++
      const err = await res.json().catch(() => ({}))
      p.log.warning(`Failed to import investment in "${row.company_name}": ${err.message || res.statusText}`)
    }
  }

  s.stop(`${pc.green(success + ' imported')}${failed ? `, ${pc.red(failed + ' failed')}` : ''}`)
  return success
}

async function main() {
  console.clear()

  p.intro(pc.bgCyan(pc.black(' VCRM Data Import ')))

  // Load env
  if (!fs.existsSync(ENV_PATH)) {
    p.log.error(`Missing ${pc.cyan('apps/crm/.env.local')}. Run ${pc.cyan('pnpm init-fund')} first.`)
    process.exit(1)
  }

  const env = readEnvFile(ENV_PATH)
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    p.log.error('Missing Supabase credentials in .env.local')
    process.exit(1)
  }

  // What to import
  const importType = await p.select({
    message: 'What would you like to import?',
    options: [
      { value: 'companies', label: 'Companies', hint: 'Company database' },
      { value: 'contacts', label: 'Contacts', hint: 'People / founders / advisors' },
      { value: 'investments', label: 'Investments', hint: 'Investment records (import companies first)' },
      { value: 'all', label: 'All', hint: 'Companies, then contacts, then investments' },
    ],
  })

  if (p.isCancel(importType)) {
    p.cancel('Import cancelled.')
    process.exit(0)
  }

  // Get CSV file path
  const types = importType === 'all' ? ['companies', 'contacts', 'investments'] : [importType]

  for (const type of types) {
    const templatePath = path.join(TEMPLATES_DIR, `${type}.csv`)
    const defaultExists = fs.existsSync(templatePath)

    p.log.step(pc.cyan(`Import ${type}`))

    if (defaultExists) {
      p.log.message(
        `${pc.dim(`Template: ${pc.cyan(`templates/${type}.csv`)}`)}\n` +
          `${pc.dim('Edit this file with your data (keep the header row), or provide a different path.')}`
      )
    }

    const csvPath = await p.text({
      message: `Path to ${type} CSV file`,
      placeholder: defaultExists ? `templates/${type}.csv` : `path/to/${type}.csv`,
      defaultValue: defaultExists ? templatePath : undefined,
      validate: (v) => {
        const resolved = path.isAbsolute(v) ? v : path.resolve(ROOT, v)
        if (!fs.existsSync(resolved)) return `File not found: ${v}`
      },
    })

    if (p.isCancel(csvPath)) {
      p.cancel('Import cancelled.')
      process.exit(0)
    }

    const resolvedPath = path.isAbsolute(csvPath) ? csvPath : path.resolve(ROOT, csvPath)
    const content = fs.readFileSync(resolvedPath, 'utf-8')
    const { headers, rows } = parseCSV(content)

    if (rows.length === 0) {
      p.log.warning(`No data rows found in ${type}.csv — skipping`)
      continue
    }

    // Preview
    p.log.info(
      `${pc.cyan(`${rows.length} rows`)} found with columns: ${headers.map((h) => pc.dim(h)).join(', ')}`
    )

    // Show first 3 rows as preview
    const preview = rows.slice(0, 3)
    const previewText = preview
      .map((row) => {
        const key = row.name || row.first_name || row.company_name || Object.values(row)[0]
        return `  ${pc.dim('•')} ${key}`
      })
      .join('\n')
    p.log.message(`Preview:\n${previewText}${rows.length > 3 ? `\n  ${pc.dim(`... and ${rows.length - 3} more`)}` : ''}`)

    const confirm = await p.confirm({
      message: `Import ${rows.length} ${type}?`,
      initialValue: true,
    })

    if (p.isCancel(confirm) || !confirm) {
      p.log.info(`Skipped ${type}`)
      continue
    }

    if (type === 'companies') await importCompanies(rows, supabaseUrl, serviceRoleKey)
    if (type === 'contacts') await importContacts(rows, supabaseUrl, serviceRoleKey)
    if (type === 'investments') await importInvestments(rows, supabaseUrl, serviceRoleKey)
  }

  p.outro(pc.green('Import complete!'))
}

main().catch((err) => {
  p.log.error(err.message)
  process.exit(1)
})
