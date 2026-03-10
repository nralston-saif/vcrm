#!/usr/bin/env node

import * as p from '@clack/prompts'
import pc from 'picocolors'
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const ENV_PATH = path.join(ROOT, 'apps', 'crm', '.env.local')
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations')

const MIGRATION_FILES = [
  '001_core_schema.sql',
  '002_crm_tables.sql',
  '003_tickets_meetings.sql',
  '004_notifications_audit.sql',
  '005_stats_functions.sql',
  '006_storage.sql',
]

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {}
  }
  const content = fs.readFileSync(filePath, 'utf-8')
  const env = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim()
    if (value) env[key] = value
  }
  return env
}

async function main() {
  console.clear()

  p.intro(pc.bgCyan(pc.black(' VCRM Database Setup ')))

  // 1. Read env vars
  const s = p.spinner()
  s.start('Reading environment variables')

  const env = readEnvFile(ENV_PATH)
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    s.stop('Missing environment variables')
    const missing = []
    if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL')
    if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY')
    p.log.error(
      `Missing required env vars in ${pc.cyan('apps/crm/.env.local')}:\n` +
        missing.map((v) => `  ${pc.red('•')} ${v}`).join('\n') +
        '\n\n' +
        `Run ${pc.cyan('pnpm init-fund')} first, then add your Supabase keys.`
    )
    process.exit(1)
  }

  s.stop('Environment variables loaded')
  p.log.info(`Supabase URL: ${pc.cyan(supabaseUrl)}`)

  // 2. Read and combine migration files
  s.start('Reading migration files')

  const missingFiles = MIGRATION_FILES.filter(
    (f) => !fs.existsSync(path.join(MIGRATIONS_DIR, f))
  )

  if (missingFiles.length > 0) {
    s.stop('Missing migration files')
    p.log.error(
      'Could not find the following migration files:\n' +
        missingFiles.map((f) => `  ${pc.red('•')} ${f}`).join('\n')
    )
    process.exit(1)
  }

  const sqlParts = MIGRATION_FILES.map((file) => {
    const content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8')
    return `-- ========================================\n-- Migration: ${file}\n-- ========================================\n\n${content}`
  })

  const combinedSql = sqlParts.join('\n\n')
  s.stop(`Read ${MIGRATION_FILES.length} migration files`)

  // 3. Write combined SQL file
  const combinedPath = path.join(MIGRATIONS_DIR, 'combined.sql')
  fs.writeFileSync(combinedPath, combinedSql)
  p.log.success(`Combined SQL written to ${pc.cyan('supabase/migrations/combined.sql')}`)

  // 4. Copy to clipboard (macOS)
  let copiedToClipboard = false
  try {
    execSync('which pbcopy', { stdio: 'ignore' })
    execSync('pbcopy', { input: combinedSql })
    copiedToClipboard = true
  } catch {
    // Not on macOS or pbcopy not available — skip
  }

  if (copiedToClipboard) {
    p.log.success(pc.green('Combined SQL copied to clipboard!'))
  }

  // 5. Show instructions
  const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '')
  const sqlEditorUrl = `https://supabase.com/dashboard/project/${projectRef}/sql/new`

  p.note(
    [
      copiedToClipboard
        ? `${pc.green('The combined SQL is already on your clipboard.')}`
        : `Open ${pc.cyan('supabase/migrations/combined.sql')} and copy its contents.`,
      '',
      `${pc.cyan('Steps:')}`,
      '',
      `1. Open the Supabase SQL Editor:`,
      `   ${pc.cyan(sqlEditorUrl)}`,
      '',
      `2. Paste the SQL and click ${pc.green('Run')}`,
      '',
      `3. All 6 migrations will execute in order:`,
      ...MIGRATION_FILES.map((f) => `   ${pc.dim(f)}`),
    ].join('\n'),
    'Run migrations'
  )

  p.outro(pc.green('Paste the SQL into the Supabase SQL Editor to finish setup.'))
}

main().catch((err) => {
  p.log.error(err.message)
  process.exit(1)
})
