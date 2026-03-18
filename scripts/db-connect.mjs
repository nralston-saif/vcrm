/**
 * Shared database connection helper.
 * Tries direct host first, falls back to asking for the pooler connection string.
 */
import * as p from '@clack/prompts'
import pc from 'picocolors'
import pg from 'pg'

const { Client } = pg

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
  let client = new Client({
    host: `db.${projectRef}.supabase.co`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: dbPassword,
    ssl: { rejectUnauthorized: false },
  })

  s.start('Connecting to database')
  try {
    await client.connect()
    s.stop('Connected to database')
    return client
  } catch (err) {
    s.stop('Connection failed')

    if (!err.message || !err.message.includes('ENOTFOUND')) {
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
      if (!v.includes('supabase')) return 'Should be a Supabase connection string'
    },
  })
  if (p.isCancel(poolerInput)) { p.cancel('Setup cancelled.'); process.exit(0) }

  // 3. Replace [YOUR-PASSWORD] placeholder with the actual password, or use as-is
  const poolerString = poolerInput.trim().replace('[YOUR-PASSWORD]', dbPassword)

  // 4. Try connecting with the pooler string — silently try multiple configs
  const txnString = poolerString.replace(':5432/', ':6543/')
  const configs = [
    { connStr: poolerString, ssl: { rejectUnauthorized: false }, label: 'session pooler (SSL)' },
    { connStr: poolerString, ssl: false, label: 'session pooler' },
    { connStr: txnString, ssl: { rejectUnauthorized: false }, label: 'transaction pooler (SSL)' },
    { connStr: txnString, ssl: false, label: 'transaction pooler' },
  ]

  s.start('Connecting via pooler')
  let lastError
  for (const config of configs) {
    client = new Client({ connectionString: config.connStr, ssl: config.ssl })
    try {
      await client.connect()
      s.stop(`Connected to database via ${config.label}`)
      return client
    } catch (err2) {
      lastError = err2
      // Silently try next config if connection was reset
      if (err2.message && err2.message.includes('ECONNRESET')) {
        continue
      }
      // Non-ECONNRESET error — stop trying (likely wrong password)
      break
    }
  }

  s.stop('Connection failed')
  p.log.error(
    `Could not connect to database.\n\n` +
      `${pc.dim('Error: ' + lastError.message)}\n\n` +
      `Make sure your database password is correct.\n` +
      `You can find or reset it in: ${pc.cyan(`https://supabase.com/dashboard/project/${projectRef}/settings/database`)}`
  )
  process.exit(1)
}
