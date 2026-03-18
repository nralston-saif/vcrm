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

  // 4. Try connecting with the pooler string using multiple SSL configs
  const attempts = [
    { ssl: { rejectUnauthorized: false }, label: 'SSL' },
    { ssl: false, label: 'no SSL' },
  ]

  for (const attempt of attempts) {
    client = new Client({ connectionString: poolerString, ssl: attempt.ssl })

    s.start(`Connecting via pooler (${attempt.label})`)
    try {
      await client.connect()
      s.stop('Connected to database')
      return client
    } catch (err2) {
      s.stop(`Failed (${attempt.label})`)

      // If connection was reset, try next SSL config
      if (err2.message && err2.message.includes('ECONNRESET') && attempt !== attempts[attempts.length - 1]) {
        p.log.info(pc.dim('Retrying with different SSL settings...'))
        continue
      }

      // Also try transaction pooler (port 6543) as last resort
      if (err2.message && err2.message.includes('ECONNRESET') && attempt === attempts[attempts.length - 1]) {
        const txnString = poolerString.replace(':5432/', ':6543/')
        for (const txnAttempt of attempts) {
          client = new Client({ connectionString: txnString, ssl: txnAttempt.ssl })

          s.start(`Connecting via transaction pooler (${txnAttempt.label})`)
          try {
            await client.connect()
            s.stop('Connected to database')
            return client
          } catch (err3) {
            s.stop(`Failed (${txnAttempt.label})`)
            if (err3.message && err3.message.includes('ECONNRESET') && txnAttempt !== attempts[attempts.length - 1]) {
              continue
            }
          }
        }
      }

      p.log.error(
        `Could not connect to database.\n\n` +
          `${pc.dim('Error: ' + err2.message)}\n\n` +
          `Make sure your database password is correct.\n` +
          `You can find or reset it in: ${pc.cyan(`https://supabase.com/dashboard/project/${projectRef}/settings/database`)}`
      )
      process.exit(1)
    }
  }
}
