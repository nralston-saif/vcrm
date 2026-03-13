#!/usr/bin/env node

import * as p from '@clack/prompts'
import pc from 'picocolors'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const CRM_DIR = path.join(ROOT, 'apps', 'crm')
const ENV_PATH = path.join(CRM_DIR, '.env.local')
const CONFIG_PATH = path.join(CRM_DIR, 'fund.config.ts')
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations')

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
]

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

function getCommandVersion(command) {
  try {
    return execSync(command, { encoding: 'utf-8' }).trim()
  } catch {
    return null
  }
}

function parseMajorVersion(versionString) {
  if (!versionString) return null
  const match = versionString.replace(/^v/, '').match(/^(\d+)/)
  return match ? parseInt(match[1], 10) : null
}

async function main() {
  console.clear()

  p.intro(pc.bgCyan(pc.black(' VCRM Doctor ')))

  p.log.message(pc.dim('Running health checks for your VCRM project...\n'))

  const results = []
  let warnings = []

  // ── Check 1: Node.js Version ──────────────────────────────────────────

  const nodeVersion = getCommandVersion('node --version')
  const nodeMajor = parseMajorVersion(nodeVersion)

  if (!nodeVersion) {
    results.push({ name: 'Node.js', passed: false, message: 'Node.js is not installed' })
    p.log.error(`${pc.red('✗')} Node.js — not installed`)
  } else if (nodeMajor < 18) {
    results.push({ name: 'Node.js', passed: false, message: `Found ${nodeVersion}, need >= 18` })
    p.log.error(`${pc.red('✗')} Node.js — ${pc.red(nodeVersion)} (requires >= 18)`)
  } else {
    results.push({ name: 'Node.js', passed: true })
    p.log.success(`${pc.green('✓')} Node.js — ${pc.green(nodeVersion)}`)
  }

  // ── Check 2: pnpm Version ────────────────────────────────────────────

  const pnpmVersion = getCommandVersion('pnpm --version')
  const pnpmMajor = parseMajorVersion(pnpmVersion)

  if (!pnpmVersion) {
    results.push({ name: 'pnpm', passed: false, message: 'pnpm is not installed' })
    p.log.error(`${pc.red('✗')} pnpm — not installed`)
  } else if (pnpmMajor < 9) {
    results.push({ name: 'pnpm', passed: false, message: `Found v${pnpmVersion}, need >= 9` })
    p.log.error(`${pc.red('✗')} pnpm — ${pc.red('v' + pnpmVersion)} (requires >= 9)`)
  } else {
    results.push({ name: 'pnpm', passed: true })
    p.log.success(`${pc.green('✓')} pnpm — ${pc.green('v' + pnpmVersion)}`)
  }

  // ── Check 3: Environment Variables ────────────────────────────────────

  if (!fs.existsSync(ENV_PATH)) {
    results.push({ name: 'Environment variables', passed: false, message: 'apps/crm/.env.local does not exist' })
    p.log.error(`${pc.red('✗')} Environment variables — ${pc.red('.env.local not found')}`)
  } else {
    const env = readEnvFile(ENV_PATH)
    const missing = REQUIRED_ENV_VARS.filter((key) => !env[key])

    if (missing.length > 0) {
      results.push({
        name: 'Environment variables',
        passed: false,
        message: `Missing: ${missing.join(', ')}`,
      })
      p.log.error(
        `${pc.red('✗')} Environment variables — missing:\n` +
          missing.map((key) => `     ${pc.red('•')} ${key}`).join('\n')
      )
    } else {
      results.push({ name: 'Environment variables', passed: true })
      p.log.success(`${pc.green('✓')} Environment variables — all ${REQUIRED_ENV_VARS.length} required vars present`)
    }
  }

  // ── Check 4: Database Connection ──────────────────────────────────────

  const env = fs.existsSync(ENV_PATH) ? readEnvFile(ENV_PATH) : {}
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    results.push({
      name: 'Database connection',
      passed: false,
      message: 'Cannot test — missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY',
    })
    p.log.error(`${pc.red('✗')} Database connection — skipped (missing env vars)`)
  } else {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      })

      if (res.ok) {
        results.push({ name: 'Database connection', passed: true })
        p.log.success(`${pc.green('✓')} Database connection — Supabase REST API reachable`)
      } else {
        results.push({
          name: 'Database connection',
          passed: false,
          message: `REST API returned ${res.status} ${res.statusText}`,
        })
        p.log.error(`${pc.red('✗')} Database connection — ${pc.red(`${res.status} ${res.statusText}`)}`)
      }
    } catch (err) {
      results.push({
        name: 'Database connection',
        passed: false,
        message: err.message,
      })
      p.log.error(`${pc.red('✗')} Database connection — ${pc.red(err.message)}`)
    }
  }

  // ── Check 5: Migration Files ──────────────────────────────────────────

  const missingMigrations = MIGRATION_FILES.filter(
    (f) => !fs.existsSync(path.join(MIGRATIONS_DIR, f))
  )

  if (missingMigrations.length > 0) {
    results.push({
      name: 'Migration files',
      passed: false,
      message: `Missing ${missingMigrations.length} of ${MIGRATION_FILES.length} files`,
    })
    p.log.error(
      `${pc.red('✗')} Migration files — missing ${missingMigrations.length} of ${MIGRATION_FILES.length}:\n` +
        missingMigrations.map((f) => `     ${pc.red('•')} ${f}`).join('\n')
    )
  } else {
    results.push({ name: 'Migration files', passed: true })
    p.log.success(`${pc.green('✓')} Migration files — all ${MIGRATION_FILES.length} files present`)
  }

  // ── Check 6: Fund Config ─────────────────────────────────────────────

  if (!fs.existsSync(CONFIG_PATH)) {
    results.push({
      name: 'Fund config',
      passed: false,
      message: 'apps/crm/fund.config.ts does not exist',
    })
    p.log.error(`${pc.red('✗')} Fund config — ${pc.red('fund.config.ts not found')}`)
  } else {
    const configContent = fs.readFileSync(CONFIG_PATH, 'utf-8')
    const hasPlaceholders = /YOUR_/.test(configContent)

    if (hasPlaceholders) {
      results.push({ name: 'Fund config', passed: true })
      warnings.push({
        name: 'Fund config',
        message: 'webhookFieldMap contains YOUR_ placeholders — update with your form field IDs',
      })
      p.log.warning(
        `${pc.yellow('!')} Fund config — file exists but ${pc.yellow('webhookFieldMap')} contains placeholder values\n` +
          `     ${pc.dim('Update the YOUR_ prefixed values in fund.config.ts with your actual form field IDs')}`
      )
    } else {
      results.push({ name: 'Fund config', passed: true })
      p.log.success(`${pc.green('✓')} Fund config — fund.config.ts looks good`)
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────

  const passed = results.filter((r) => r.passed)
  const failed = results.filter((r) => !r.passed)

  console.log() // blank line before summary

  if (failed.length === 0 && warnings.length === 0) {
    p.note(
      [
        `${pc.green(`All ${results.length} checks passed!`)}`,
        '',
        `Your VCRM project is healthy and ready to go.`,
        '',
        `  ${pc.cyan('pnpm dev')}   — Start the dev server`,
        `  ${pc.cyan('pnpm build')} — Build for production`,
      ].join('\n'),
      'All good!'
    )
  } else if (failed.length === 0) {
    p.note(
      [
        `${pc.green(`${passed.length}/${results.length} checks passed`)} with ${pc.yellow(`${warnings.length} warning(s)`)}`,
        '',
        ...warnings.map((w) => `  ${pc.yellow('!')} ${w.name}: ${w.message}`),
        '',
        `Your project will work, but consider addressing the warnings above.`,
      ].join('\n'),
      'Almost perfect'
    )
  } else {
    p.note(
      [
        `${pc.green(`${passed.length} passed`)}, ${pc.red(`${failed.length} failed`)}${warnings.length > 0 ? `, ${pc.yellow(`${warnings.length} warning(s)`)}` : ''}`,
        '',
        pc.bold('Failures:'),
        ...failed.map((f) => `  ${pc.red('✗')} ${f.name}: ${f.message}`),
        ...(warnings.length > 0
          ? ['', pc.bold('Warnings:'), ...warnings.map((w) => `  ${pc.yellow('!')} ${w.name}: ${w.message}`)]
          : []),
        '',
        pc.bold('How to fix:'),
        ...(failed.some((f) => f.name === 'Node.js')
          ? [`  ${pc.cyan('•')} Install Node.js >= 18: ${pc.cyan('https://nodejs.org')}`]
          : []),
        ...(failed.some((f) => f.name === 'pnpm')
          ? [`  ${pc.cyan('•')} Install pnpm >= 9: ${pc.cyan('npm install -g pnpm')}`]
          : []),
        ...(failed.some((f) => f.name === 'Environment variables')
          ? [`  ${pc.cyan('•')} Run ${pc.cyan('pnpm init-fund')} to generate .env.local with your Supabase keys`]
          : []),
        ...(failed.some((f) => f.name === 'Database connection')
          ? [`  ${pc.cyan('•')} Check your Supabase project URL and anon key in apps/crm/.env.local`]
          : []),
        ...(failed.some((f) => f.name === 'Migration files')
          ? [`  ${pc.cyan('•')} Ensure supabase/migrations/ contains all 6 migration SQL files`]
          : []),
        ...(failed.some((f) => f.name === 'Fund config')
          ? [`  ${pc.cyan('•')} Run ${pc.cyan('pnpm init-fund')} to generate fund.config.ts`]
          : []),
      ].join('\n'),
      'Health Check Results'
    )
  }

  p.outro(
    failed.length === 0
      ? pc.green('VCRM is healthy!')
      : pc.red(`${failed.length} issue(s) to resolve`)
  )

  process.exit(failed.length > 0 ? 1 : 0)
}

main().catch((err) => {
  p.log.error(err.message)
  process.exit(1)
})
