/**
 * Shared database connection helper.
 * Tries direct host first, falls back to pooler via Supabase Management API.
 */
import * as p from '@clack/prompts'
import pc from 'picocolors'
import pg from 'pg'

const { Client } = pg

/**
 * Fetch the pooler host for a Supabase project using the Management API.
 * Requires a Personal Access Token (PAT).
 */
async function fetchPoolerHost(projectRef, accessToken) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/config/database/pooler`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Supabase API error (${res.status}): ${body}`)
  }

  const configs = await res.json()
  // Find the PRIMARY database pooler config
  const primary = configs.find((c) => c.database_type === 'PRIMARY') || configs[0]
  if (!primary || !primary.db_host) {
    throw new Error('No pooler configuration found for this project')
  }

  return primary.db_host
}

/**
 * Connect to a Supabase database.
 * Tries direct connection first; if ENOTFOUND, uses the Management API to
 * discover the pooler host automatically.
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

  // 2. Direct host unavailable — use Management API to find pooler host
  p.log.warning(
    `Direct database host not available for this project.\n` +
    `${pc.dim('Newer Supabase projects require the connection pooler.')}`
  )
  p.log.message(
    `We can look this up automatically with a Supabase access token.\n` +
    `${pc.dim('Generate one at:')} ${pc.cyan('https://supabase.com/dashboard/account/tokens')}\n` +
    `${pc.dim('Click "Generate new token", give it any name, and paste it below.')}`
  )

  const accessToken = await p.password({
    message: 'Supabase access token (from account settings)',
    validate: (v) => {
      if (!v || v.trim().length === 0) return 'Access token is required'
    },
  })
  if (p.isCancel(accessToken)) { p.cancel('Setup cancelled.'); process.exit(0) }

  s.start('Looking up database connection')
  let poolerHost
  try {
    poolerHost = await fetchPoolerHost(projectRef, accessToken.trim())
    s.stop(`Found pooler host: ${pc.cyan(poolerHost)}`)
  } catch (apiErr) {
    s.stop('Lookup failed')
    p.log.error(
      `Could not fetch database connection info.\n\n` +
        `${pc.dim('Error: ' + apiErr.message)}\n\n` +
        `Make sure your access token is valid.\n` +
        `Generate one at: ${pc.cyan('https://supabase.com/dashboard/account/tokens')}`
    )
    process.exit(1)
  }

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
