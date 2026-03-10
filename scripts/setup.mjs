#!/usr/bin/env node

import * as p from '@clack/prompts'
import pc from 'picocolors'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const CRM_DIR = path.join(ROOT, 'apps', 'crm')
const CONFIG_PATH = path.join(CRM_DIR, 'fund.config.ts')
const ENV_PATH = path.join(CRM_DIR, '.env.local')

const MODULES = [
  { value: 'deals', label: 'Deal Pipeline', hint: 'Application intake, voting, deliberations' },
  { value: 'portfolio', label: 'Portfolio Tracking', hint: 'Investments, valuations, terms' },
  { value: 'tickets', label: 'Tickets & Tasks', hint: 'Internal task management' },
  { value: 'meetings', label: 'Meetings & Notes', hint: 'Scheduling and collaborative notes' },
  { value: 'bioMap', label: 'Network Map', hint: 'Visual network/relationship explorer' },
  { value: 'notifications', label: 'Notifications', hint: 'In-app notification system' },
  { value: 'news', label: 'News Feed', hint: 'AI-curated industry news' },
  { value: 'liveblocks', label: 'Collaborative Editing', hint: 'Requires Liveblocks API key' },
  { value: 'rejectionEmails', label: 'AI Rejection Emails', hint: 'Requires Anthropic API key' },
  { value: 'sms', label: 'SMS Notifications', hint: 'Requires Twilio account' },
]

// Modules enabled by default
const DEFAULT_ENABLED = ['deals', 'portfolio', 'tickets', 'meetings', 'bioMap', 'notifications', 'news']

async function main() {
  console.clear()

  p.intro(pc.bgCyan(pc.black(' VCRM Setup ')))

  // Check if already configured
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

  // Fund branding
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

  // Module selection
  const selectedModules = await p.multiselect({
    message: 'Which modules do you want to enable?',
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

  // Check if optional modules need API keys
  const needsLiveblocks = enabledSet.has('liveblocks')
  const needsAnthropic = enabledSet.has('rejectionEmails')
  const needsTwilio = enabledSet.has('sms')

  // Supabase credentials & optional API keys (only if writing .env.local)
  let supabase = { url: '', anonKey: '', serviceRoleKey: '' }
  let liveblocksKey = ''
  let anthropicKey = ''
  let twilioSid = ''
  let twilioToken = ''
  let twilioPhone = ''

  if (!skipEnv) {
    p.log.step(pc.cyan('Supabase Configuration'))
    p.log.message('Find these in your Supabase dashboard → Settings → API')

    supabase = await p.group(
      {
        url: () =>
          p.text({
            message: 'Supabase project URL',
            placeholder: 'https://your-project.supabase.co',
          }),
        anonKey: () =>
          p.text({
            message: 'Supabase anon (public) key',
            placeholder: 'eyJhbGci...',
          }),
        serviceRoleKey: () =>
          p.text({
            message: 'Supabase service role key',
            placeholder: 'eyJhbGci...',
          }),
      },
      {
        onCancel: () => {
          p.cancel('Setup cancelled.')
          process.exit(0)
        },
      }
    )

    if (needsLiveblocks) {
      const liveblocks = await p.text({
        message: 'Liveblocks public key',
        placeholder: 'pk_...',
      })
      if (!p.isCancel(liveblocks)) liveblocksKey = liveblocks
    }

    if (needsAnthropic) {
      const key = await p.text({
        message: 'Anthropic API key',
        placeholder: 'sk-ant-...',
      })
      if (!p.isCancel(key)) anthropicKey = key
    }

    if (needsTwilio) {
      const twilio = await p.group(
        {
          sid: () => p.text({ message: 'Twilio Account SID', placeholder: 'AC...' }),
          token: () => p.text({ message: 'Twilio Auth Token' }),
          phone: () => p.text({ message: 'Twilio Phone Number', placeholder: '+1234567890' }),
        },
        { onCancel: () => {} }
      )
      twilioSid = twilio.sid || ''
      twilioToken = twilio.token || ''
      twilioPhone = twilio.phone || ''
    }
  }

  // Generate fund.config.ts
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
 * Generated by \`pnpm setup\` — you can edit this file directly at any time.
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
    companyName: 'q29_companyName',
    website: 'q31_websiteif',
    companyDescription: 'q30_companyDescription',
    founderNames: 'q26_typeA',
    founderLinkedins: 'q28_founderLinkedins',
    founderBios: 'q40_founderBios',
    primaryEmail: 'q32_primaryEmail',
    previousFunding: 'q35_haveYou',
    deckLink: 'q41_linkTo',
  },
} as const

export type FundConfig = typeof fundConfig
export type ModuleKey = keyof typeof fundConfig.modules
`

  fs.writeFileSync(CONFIG_PATH, configContent)

  // Generate .env.local
  if (!skipEnv) {
    let envContent = `# Generated by pnpm setup

# ---- Required: Supabase ----
NEXT_PUBLIC_SUPABASE_URL=${supabase.url || ''}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${supabase.anonKey || ''}
SUPABASE_SERVICE_ROLE_KEY=${supabase.serviceRoleKey || ''}
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

  p.note(
    [
      `${pc.cyan('Next steps:')}`,
      '',
      '1. Run the database migrations in your Supabase SQL Editor:',
      `   ${pc.dim('supabase/migrations/001_core_schema.sql')}`,
      `   ${pc.dim('supabase/migrations/002_crm_tables.sql')}`,
      `   ${pc.dim('supabase/migrations/003_tickets_meetings.sql')}`,
      `   ${pc.dim('supabase/migrations/004_notifications_audit.sql')}`,
      `   ${pc.dim('supabase/migrations/005_stats_functions.sql')}`,
      `   ${pc.dim('supabase/migrations/006_storage.sql')}`,
      '',
      '2. Invite your first user:',
      `   ${pc.dim('Supabase Dashboard → Authentication → Users → Invite user')}`,
      '',
      `3. Start the dev server: ${pc.cyan('pnpm dev')}`,
    ].join('\n'),
    'Almost there!'
  )

  p.outro(pc.green('Setup complete! 🎉'))
}

function escapeQuotes(str) {
  return str.replace(/'/g, "\\'")
}

main().catch((err) => {
  p.log.error(err.message)
  process.exit(1)
})
