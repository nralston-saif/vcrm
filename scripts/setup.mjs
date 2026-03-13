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
const CRM_DIR = path.join(ROOT, 'apps', 'crm')
const CONFIG_PATH = path.join(CRM_DIR, 'fund.config.ts')
const ENV_PATH = path.join(CRM_DIR, '.env.local')
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations')

const MIGRATION_FILES = [
  '001_core_schema.sql',
  '002_crm_tables.sql',
  '003_tickets_meetings.sql',
  '004_notifications_audit.sql',
  '005_stats_functions.sql',
  '006_storage.sql',
]

const MODULES = [
  { value: 'deals', label: 'Deal Pipeline', hint: 'Application intake, voting, deliberations' },
  { value: 'portfolio', label: 'Portfolio Tracking', hint: 'Investments, valuations, terms' },
  { value: 'tickets', label: 'Tickets & Tasks', hint: 'Internal task management' },
  { value: 'meetings', label: 'Meetings & Notes', hint: 'Scheduling and collaborative notes' },
  { value: 'notifications', label: 'Notifications', hint: 'In-app notification system' },
  { value: 'news', label: 'News Feed', hint: 'AI-curated industry news' },
  { value: 'liveblocks', label: 'Collaborative Editing', hint: 'Requires Liveblocks API key' },
  { value: 'rejectionEmails', label: 'AI Rejection Emails', hint: 'Requires Anthropic API key' },
  { value: 'sms', label: 'SMS Notifications', hint: 'Requires Twilio account' },
]

const DEFAULT_ENABLED = ['deals', 'portfolio', 'tickets', 'meetings', 'notifications', 'news']

function validateSupabaseUrl(v) {
  if (!v || v.length === 0) return 'Supabase URL is required'
  if (!v.includes('supabase.co')) return 'Should look like https://your-project.supabase.co'
  return undefined
}

function validateKey(label) {
  return (v) => {
    if (!v || v.length === 0) return `${label} is required`
    if (v.length < 100) return `Key looks truncated (${v.length} chars). Try pasting again.`
    return undefined
  }
}

function escapeQuotes(str) {
  return str.replace(/'/g, "\\'")
}

async function main() {
  console.clear()

  p.intro(pc.bgCyan(pc.black(' VCRM Setup ')))

  // Check if .env.local already exists
  let skipEnv = false
  if (fs.existsSync(ENV_PATH)) {
    const overwrite = await p.confirm({
      message: 'An .env.local file already exists. Overwrite it?',
      initialValue: false,
    })
    if (p.isCancel(overwrite) || !overwrite) {
      p.log.info('Keeping existing .env.local')
      skipEnv = true
    }
  }

  // ── Step 1: Fund Branding ──────────────────────────────────────────────

  p.log.step(pc.cyan('Step 1 of 4: Fund Branding'))

  const branding = await p.group(
    {
      name: () =>
        p.text({
          message: 'What is your fund\'s name?',
          placeholder: 'Acme Ventures',
          validate: (v) => (v.length === 0 ? 'Fund name is required' : undefined),
        }),
      shortName: () =>
        p.text({
          message: 'Short name or abbreviation?',
          placeholder: 'AV',
          validate: (v) => (v.length === 0 ? 'Short name is required' : undefined),
        }),
      tagline: () =>
        p.text({
          message: 'One-line tagline for your fund?',
          placeholder: 'Investing in the future of AI',
        }),
      supportEmail: () =>
        p.text({
          message: 'Support email address?',
          placeholder: 'team@acmeventures.com',
        }),
      website: () =>
        p.text({
          message: 'Fund website URL?',
          placeholder: 'https://acmeventures.com',
        }),
    },
    {
      onCancel: () => {
        p.cancel('Setup cancelled.')
        process.exit(0)
      },
    }
  )

  // ── Step 2: Module Selection ───────────────────────────────────────────

  p.log.step(pc.cyan('Step 2 of 4: Modules'))

  const selectedModules = await p.multiselect({
    message: 'Which modules do you want to enable? (space to toggle, enter to confirm)',
    options: MODULES.map((m) => ({
      value: m.value,
      label: m.label,
      hint: m.hint,
    })),
    initialValues: DEFAULT_ENABLED,
    required: false,
  })

  if (p.isCancel(selectedModules)) {
    p.cancel('Setup cancelled.')
    process.exit(0)
  }

  const enabledSet = new Set(selectedModules)

  // ── Step 3: Supabase Credentials ───────────────────────────────────────

  p.log.step(pc.cyan('Step 3 of 4: Supabase Configuration'))

  let supabaseUrl = ''
  let anonKey = ''
  let serviceRoleKey = ''
  let dbPassword = ''
  let liveblocksKey = ''
  let anthropicKey = ''
  let twilioSid = ''
  let twilioToken = ''
  let twilioPhone = ''

  if (!skipEnv) {
    p.log.message(`${pc.dim('Project URL is on your project\'s home page.')}`)
    p.log.message(`${pc.dim('API keys are in Project Settings (gear icon) → API Keys.')}`)

    supabaseUrl = await p.text({
      message: 'Supabase project URL (from project home page)',
      placeholder: 'https://your-project.supabase.co',
      validate: validateSupabaseUrl,
    })
    if (p.isCancel(supabaseUrl)) { p.cancel('Setup cancelled.'); process.exit(0) }

    anonKey = await p.password({
      message: 'Supabase anon (public) key (Project Settings → API Keys)',
      validate: validateKey('Anon key'),
    })
    if (p.isCancel(anonKey)) { p.cancel('Setup cancelled.'); process.exit(0) }

    serviceRoleKey = await p.password({
      message: 'Supabase service role key (same page, click to reveal)',
      validate: validateKey('Service role key'),
    })
    if (p.isCancel(serviceRoleKey)) { p.cancel('Setup cancelled.'); process.exit(0) }

    // Optional keys based on module selection
    if (enabledSet.has('liveblocks')) {
      const key = await p.password({
        message: 'Liveblocks public key',
        validate: (v) => (!v || v.length === 0 ? 'Required for collaborative editing' : undefined),
      })
      if (!p.isCancel(key)) liveblocksKey = key
    }

    if (enabledSet.has('rejectionEmails')) {
      const key = await p.password({
        message: 'Anthropic API key',
        validate: (v) => (!v || v.length === 0 ? 'Required for AI rejection emails' : undefined),
      })
      if (!p.isCancel(key)) anthropicKey = key
    }

    if (enabledSet.has('sms')) {
      twilioSid = await p.text({ message: 'Twilio Account SID', placeholder: 'AC...' }) || ''
      twilioToken = await p.password({ message: 'Twilio Auth Token' }) || ''
      twilioPhone = await p.text({ message: 'Twilio Phone Number', placeholder: '+1234567890' }) || ''
    }
  } else {
    // Read existing env for database and API steps
    const env = readEnvFile(ENV_PATH)
    supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || ''
    serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || ''
  }

  // Database password (always needed for migrations)
  p.log.message(`${pc.dim('This is the password shown when you created the Supabase project')}`)
  dbPassword = await p.password({
    message: 'Supabase database password',
    validate: (v) => (!v || v.length === 0 ? 'Database password is required' : undefined),
  })
  if (p.isCancel(dbPassword)) { p.cancel('Setup cancelled.'); process.exit(0) }

  // ── Write Config Files ─────────────────────────────────────────────────

  const s = p.spinner()
  s.start('Writing configuration')

  const logoText = branding.shortName.toUpperCase()
  const moduleEntries = MODULES.map((m) => {
    const enabled = enabledSet.has(m.value)
    return `    /** ${m.hint} */\n    ${m.value}: ${enabled},`
  }).join('\n\n')

  const configContent = `/**
 * Fund Configuration
 *
 * This is the single source of truth for your fund's branding and feature setup.
 * Generated by \`pnpm init-fund\` — you can edit this file directly at any time.
 */

export const fundConfig = {
  /** Your fund's full name (shown in metadata, emails, etc.) */
  name: '${escapeQuotes(branding.name)}',

  /** Short name or abbreviation */
  shortName: '${escapeQuotes(branding.shortName)}',

  /** One-line description of your fund */
  tagline: '${escapeQuotes(branding.tagline || '')}',

  /** Support email shown in error messages */
  supportEmail: '${escapeQuotes(branding.supportEmail || '')}',

  /** Your fund's website */
  website: '${escapeQuotes(branding.website || '')}',

  /** Branding configuration */
  branding: {
    /**
     * Logo text parts displayed in the navigation bar.
     * Each part can have a different font weight.
     */
    logo: [
      { text: '${escapeQuotes(logoText)}', weight: 'bold' as const },
    ],

    /** Primary brand color (used for accents, buttons, etc.) */
    primaryColor: '#1a1a1a',

    /** Font family (loaded from Google Fonts in layout.tsx) */
    font: 'Montserrat',

    /** Google Fonts URL - update if you change the font */
    fontUrl: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap',
  },

  /**
   * Feature modules - enable/disable sections of the CRM.
   * Disabled modules hide nav links and return 404 on their routes.
   */
  modules: {
${moduleEntries}
  },

  /**
   * Webhook field mapping for your application intake form.
   * Maps your form provider's field names to the CRM's expected fields.
   * Update these keys to match your form's field names/IDs.
   */
  webhookFieldMap: {
    companyName: 'YOUR_COMPANY_NAME_FIELD',
    website: 'YOUR_WEBSITE_FIELD',
    companyDescription: 'YOUR_DESCRIPTION_FIELD',
    founderNames: 'YOUR_FOUNDER_NAMES_FIELD',
    founderLinkedins: 'YOUR_FOUNDER_LINKEDINS_FIELD',
    founderBios: 'YOUR_FOUNDER_BIOS_FIELD',
    primaryEmail: 'YOUR_EMAIL_FIELD',
    previousFunding: 'YOUR_PREVIOUS_FUNDING_FIELD',
    deckLink: 'YOUR_DECK_LINK_FIELD',
  },
} as const

export type FundConfig = typeof fundConfig
export type ModuleKey = keyof typeof fundConfig.modules
`

  fs.writeFileSync(CONFIG_PATH, configContent)

  // Generate .env.local
  if (!skipEnv) {
    let envContent = `# Generated by pnpm init-fund

# ---- Required: Supabase ----
NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}
SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}
`

    if (liveblocksKey) {
      envContent += `\n# ---- Liveblocks ----\nNEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY=${liveblocksKey}\n`
    }
    if (anthropicKey) {
      envContent += `\n# ---- Anthropic ----\nANTHROPIC_API_KEY=${anthropicKey}\n`
    }
    if (twilioSid) {
      envContent += `\n# ---- Twilio ----\nTWILIO_ACCOUNT_SID=${twilioSid}\nTWILIO_AUTH_TOKEN=${twilioToken}\nTWILIO_PHONE_NUMBER=${twilioPhone}\n`
    }

    fs.writeFileSync(ENV_PATH, envContent)
  }

  s.stop('Configuration written')

  // Summary
  const enabledModules = MODULES.filter((m) => enabledSet.has(m.value))
  const disabledModules = MODULES.filter((m) => !enabledSet.has(m.value))

  p.log.success(pc.green(`Fund: ${branding.name}`))

  if (enabledModules.length > 0) {
    p.log.info(
      pc.cyan('Enabled modules:\n') +
        enabledModules.map((m) => `  ${pc.green('✓')} ${m.label}`).join('\n')
    )
  }
  if (disabledModules.length > 0) {
    p.log.info(
      pc.dim('Disabled modules:\n') +
        disabledModules.map((m) => `  ${pc.dim('✗')} ${pc.dim(m.label)}`).join('\n')
    )
  }

  // ── Step 3b: Run Database Migrations ───────────────────────────────────

  p.log.step(pc.cyan('Running database migrations'))

  const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '')
  const connectionString = `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres`

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })

  s.start('Connecting to database')
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

  // Check for missing migration files
  const missingFiles = MIGRATION_FILES.filter(
    (f) => !fs.existsSync(path.join(MIGRATIONS_DIR, f))
  )
  if (missingFiles.length > 0) {
    p.log.error(
      'Missing migration files:\n' +
        missingFiles.map((f) => `  ${pc.red('•')} ${f}`).join('\n')
    )
    await client.end()
    process.exit(1)
  }

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

  p.log.success(pc.green(`All ${MIGRATION_FILES.length} migrations applied!`))

  // ── Step 4: Create First User ──────────────────────────────────────────

  p.log.step(pc.cyan('Step 4 of 4: Create Your First User'))

  const user = await p.group(
    {
      email: () =>
        p.text({
          message: 'Email address',
          placeholder: 'you@yourfund.com',
          validate: (v) => {
            if (!v) return 'Email is required'
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid email'
          },
        }),
      password: () =>
        p.password({
          message: 'Password',
          validate: (v) => {
            if (!v) return 'Password is required'
            if (v.length < 8) return 'Password must be at least 8 characters'
          },
        }),
      firstName: () =>
        p.text({
          message: 'First name',
          validate: (v) => { if (!v) return 'First name is required' },
        }),
      lastName: () =>
        p.text({
          message: 'Last name',
          validate: (v) => { if (!v) return 'Last name is required' },
        }),
    },
    {
      onCancel: () => {
        p.cancel('Setup cancelled.')
        process.exit(0)
      },
    }
  )

  // Use the service role key we already have (from prompts or env file)
  const srkToUse = skipEnv ? serviceRoleKey : serviceRoleKey

  s.start('Creating auth user')
  const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: srkToUse,
      Authorization: `Bearer ${srkToUse}`,
    },
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      email_confirm: true,
    }),
  })

  if (!authRes.ok) {
    const err = await authRes.json().catch(() => ({}))
    s.stop('Failed')
    p.log.error(`Auth error: ${err.msg || err.message || authRes.statusText}`)
    process.exit(1)
  }

  const authUser = await authRes.json()
  s.stop('Auth user created')

  // Insert people record
  s.start('Creating CRM profile')
  const fullName = `${user.firstName} ${user.lastName}`

  const insertRes = await fetch(`${supabaseUrl}/rest/v1/people`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: srkToUse,
      Authorization: `Bearer ${srkToUse}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      auth_user_id: authUser.id,
      email: user.email,
      first_name: user.firstName,
      last_name: user.lastName,
      name: fullName,
      role: 'partner',
    }),
  })

  if (!insertRes.ok) {
    const err = await insertRes.json().catch(() => ({}))
    s.stop('Failed')
    p.log.error(`Profile error: ${err.message || insertRes.statusText}`)
    // Roll back auth user
    await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUser.id}`, {
      method: 'DELETE',
      headers: { apikey: srkToUse, Authorization: `Bearer ${srkToUse}` },
    }).catch(() => {})
    p.log.warning('Rolled back auth user.')
    process.exit(1)
  }

  s.stop('CRM profile created')

  // ── Optional: Data Import ───────────────────────────────────────────────

  p.log.success(pc.green('Core setup complete!'))

  const wantImport = await p.confirm({
    message: 'Do you have existing data (companies, contacts, investments) to import?',
    initialValue: false,
  })

  if (!p.isCancel(wantImport) && wantImport) {
    p.note(
      [
        `CSV templates are in the ${pc.cyan('templates/')} folder:`,
        '',
        `  ${pc.cyan('templates/companies.csv')}   — Company database`,
        `  ${pc.cyan('templates/contacts.csv')}    — People / founders`,
        `  ${pc.cyan('templates/investments.csv')} — Investment records`,
        '',
        `Edit the templates with your data (or have an AI`,
        `generate them from your spreadsheets), then run:`,
        '',
        `  ${pc.cyan('pnpm import-data')}`,
      ].join('\n'),
      'Data Import'
    )
  }

  // ── Webhook Setup Guidance ─────────────────────────────────────────────

  if (enabledSet.has('deals')) {
    const wantWebhook = await p.confirm({
      message: 'Do you want to set up the deal application webhook now?',
      initialValue: false,
    })

    if (!p.isCancel(wantWebhook) && wantWebhook) {
      p.note(
        [
          `The CRM accepts deal applications via webhook from any`,
          `form provider (Typeform, Google Forms, Tally, JotForm, etc.).`,
          `It supports both JSON and form-encoded payloads.`,
          '',
          `${pc.cyan('1.')} Create your application form with fields for:`,
          `   company name, website, description, founder names,`,
          `   founder linkedins, email, previous funding, deck link`,
          '',
          `${pc.cyan('2.')} Point your form's webhook URL to:`,
          `   ${pc.cyan('https://your-domain.com/api/webhook/jotform')}`,
          `   ${pc.dim('(works with any provider, not just JotForm)')}`,
          '',
          `${pc.cyan('3.')} Set a ${pc.cyan('WEBHOOK_SECRET')} in your .env.local and configure`,
          `   your form to send it in the ${pc.cyan('X-Webhook-Secret')} header.`,
          '',
          `${pc.cyan('4.')} Update the field mapping in ${pc.cyan('fund.config.ts')}:`,
          `   Edit ${pc.cyan('webhookFieldMap')} to match your form's field IDs.`,
          `   Replace the ${pc.yellow('YOUR_*')} placeholders with your actual field names.`,
          '',
          `${pc.dim('See README.md for provider-specific examples.')}`,
          `${pc.dim('For local testing, use a tunnel: npx ngrok http 3001')}`,
        ].join('\n'),
        'Webhook Setup'
      )
    }
  }

  // ── Done ───────────────────────────────────────────────────────────────

  p.note(
    [
      `${pc.bold('Email:')}     ${user.email}`,
      `${pc.bold('Name:')}      ${fullName}`,
      '',
      `Start the dev server: ${pc.cyan('pnpm dev')}`,
      `Then open ${pc.cyan('http://localhost:3001')} and log in.`,
      '',
      `${pc.dim('Other commands:')}`,
      `  ${pc.cyan('pnpm import-data')}   — Import companies, contacts, investments`,
      `  ${pc.cyan('pnpm create-user')}   — Add another team member`,
    ].join('\n'),
    'You\'re ready!'
  )

  p.outro(pc.green('Setup complete!'))
}

function readEnvFile(filePath) {
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

main().catch((err) => {
  p.log.error(err.message)
  process.exit(1)
})
