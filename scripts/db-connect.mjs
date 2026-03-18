/**
 * Shared database connection helper.
 * Tries direct host first, falls back to asking for the pooler connection string.
 */
import * as p from '@clack/prompts'
import pc from 'picocolors'
import pg from 'pg'

const { Client } = pg

/**
 * Parse a Supabase pooler connection string and extract the host.
 * Accepts either a full URI or just the host.
 * Examples:
 *   "postgresql://postgres.ref:pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
 *   "aws-0-us-east-1.pooler.supabase.com"
 */
function parsePoolerHost(input) {
  const trimmed = input.trim()
  // If it looks like a URI, extract the host
  if (trimmed.startsWith('postgresql://') || trimmed.startsWith('postgres://')) {
    try {
      const url = new URL(trimmed)
      return url.hostname
    } catch {
      // Fall through to return as-is
    }
  }
  // Strip any port or path if someone pasted "host:5432"
  return trimmed.split(':')[0].split('/')[0]
}

/**
 * Connect to a Supabase database.
 * Tries direct connection first; if ENOTFOUND, asks the user to paste
 * their pooler connection string from the Supabase dashboard.
 *
 * @param {object} opts
 * @param {string} opts.projectRef - Supabase project reference
 * @param {string} opts.dbPassword - Database password
 * @param {import('@clack/prompts').SpinnerResult} opts.spinner - Clack spinner
 * @returns {Promise<pg.Client>} Connected pg client
 */
export async function connectToDatabase({ projectRef, dbPassword, spinner: s }) {
  // 1. Try direct connection
  let connectionString = `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres`
  let client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })

  s.start('Connecting to database')
  try {
    await client.connect()
    s.stop('Connected to database')
    return client
  } catch (err) {
    s.stop('Connection failed')

    if (!err.message || !err.message.includes('ENOTFOUND')) {
      // Not a DNS issue — likely wrong password
      p.log.error(
        `Could not connect to database.\n\n` +
          `${pc.dim('Error: ' + err.message)}\n\n` +
          `Make sure your database password is correct.\n` +
          `You can find or reset it in: ${pc.cyan(`https://supabase.com/dashboard/project/${projectRef}/settings/database`)}`
      )
      process.exit(1)
    }
  }

  // 2. Direct host unavailable — ask for pooler connection string
  p.log.warning(
    `Direct database host not available for this project.\n` +
    `${pc.dim('Newer Supabase projects require the connection pooler.')}`
  )
  p.log.message(
    `Go to your Supabase dashboard:\n` +
    `  ${pc.cyan(`https://supabase.com/dashboard/project/${projectRef}/settings/database`)}\n\n` +
    `Under ${pc.bold('Connection string')}, change Method to ${pc.bold('Session pooler')},\n` +
    `then copy the full URI and paste it below.`
  )

  const poolerInput = await p.text({
    message: 'Paste your Session pooler connection string',
    placeholder: 'postgresql://postgres.ref:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres',
    validate: (v) => {
      if (!v || v.trim().length === 0) return 'Connection string is required'
      const host = parsePoolerHost(v)
      if (!host.includes('supabase')) return 'Should be a Supabase connection string or host'
    },
  })
  if (p.isCancel(poolerInput)) { p.cancel('Setup cancelled.'); process.exit(0) }

  const poolerHost = parsePoolerHost(poolerInput)

  // 3. Connect via pooler
  connectionString = `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@${poolerHost}:5432/postgres`
  client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })

  s.start('Connecting via pooler')
  try {
    await client.connect()
    s.stop('Connected to database')
    return client
  } catch (err2) {
    s.stop('Connection failed')
    p.log.error(
      `Could not connect to database.\n\n` +
        `${pc.dim('Error: ' + err2.message)}\n\n` +
        `Make sure your database password is correct.\n` +
        `You can find or reset it in: ${pc.cyan(`https://supabase.com/dashboard/project/${projectRef}/settings/database`)}`
    )
    process.exit(1)
  }
}
