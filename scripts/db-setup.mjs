#!/usr/bin/env node

import * as p from '@clack/prompts'
import pc from 'picocolors'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Client } = pg

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
  const env = readEnvFile(ENV_PATH)
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL

  if (!supabaseUrl) {
    p.log.error(
      `Missing ${pc.cyan('NEXT_PUBLIC_SUPABASE_URL')} in ${pc.cyan('apps/crm/.env.local')}\n` +
        `Run ${pc.cyan('pnpm init-fund')} first, then add your Supabase keys.`
    )
    process.exit(1)
  }

  const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '')
  p.log.info(`Project: ${pc.cyan(projectRef)}`)

  // 2. Get database password
  const dbPassword = await p.password({
    message: 'Supabase database password (from project creation)',
  })

  if (p.isCancel(dbPassword)) {
    p.cancel('Setup cancelled.')
    process.exit(0)
  }

  // 3. Read migration files
  const missingFiles = MIGRATION_FILES.filter(
    (f) => !fs.existsSync(path.join(MIGRATIONS_DIR, f))
  )

  if (missingFiles.length > 0) {
    p.log.error(
      'Missing migration files:\n' +
        missingFiles.map((f) => `  ${pc.red('•')} ${f}`).join('\n')
    )
    process.exit(1)
  }

  // 4. Connect to database
  const s = p.spinner()
  s.start('Connecting to database')

  const connectionString = `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })

  try {
    await client.connect()
    s.stop('Connected to database')
  } catch (err) {
    s.stop('Connection failed')
    p.log.error(
      `Could not connect to database.\n\n` +
        `${pc.dim('Error: ' + err.message)}\n\n` +
        `Make sure your database password is correct.\n` +
        `You can find or reset it in: ${pc.cyan(`https://supabase.com/dashboard/project/${projectRef}/settings/database`)}`
    )
    process.exit(1)
  }

  // 5. Run migrations one by one
  let completed = 0

  for (const file of MIGRATION_FILES) {
    s.start(`Running ${pc.cyan(file)} (${completed + 1}/${MIGRATION_FILES.length})`)

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8')

    try {
      await client.query(sql)
      completed++
      s.stop(`${pc.green('✓')} ${file}`)
    } catch (err) {
      s.stop(`${pc.red('✗')} ${file}`)
      p.log.error(
        `Migration failed on ${pc.cyan(file)}:\n` +
          `${pc.dim(err.message)}\n\n` +
          `${completed} of ${MIGRATION_FILES.length} migrations completed before the error.`
      )
      await client.end()
      process.exit(1)
    }
  }

  await client.end()

  p.log.success(pc.green(`All ${MIGRATION_FILES.length} migrations applied successfully!`))

  p.note(
    [
      `${pc.cyan('Next steps:')}`,
      '',
      `1. Create your first user: ${pc.cyan('pnpm create-user')}`,
      '',
      `2. Start the dev server: ${pc.cyan('pnpm dev')}`,
    ].join('\n'),
    'Database ready!'
  )

  p.outro(pc.green('Database setup complete!'))
}

main().catch((err) => {
  p.log.error(err.message)
  process.exit(1)
})
