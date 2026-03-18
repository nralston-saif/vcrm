# VCRM - Open Source VC Fund CRM

A modern, full-featured CRM built for venture capital funds. Manage your deal pipeline, track portfolio investments, coordinate partner voting, and run deliberation meetings -- all in one place.

Built with Next.js 16, Supabase, TypeScript, and Tailwind CSS.

---

## Features

### Core (Always Available)
- **Dashboard** -- At-a-glance view of pending votes, decisions needed, active tasks, and portfolio stats
- **People** -- Contact database with relationship tracking, company associations, and notes
- **Companies** -- Company database with pipeline staging (prospect -> diligence -> portfolio -> exited)
- **Search** -- Global search across people, companies, and applications (Cmd+K)

### Configurable Modules
Enable or disable features in `fund.config.ts`:

| Module | Description | Required Setup |
|--------|-------------|----------------|
| `deals` | Application pipeline with intake webhook, partner voting (initial + final), deliberation notes, and decision tracking | Form provider (JotForm, Typeform, etc.) |
| `portfolio` | Investment tracking with terms, valuations, round details, and lead partner assignment | -- |
| `tickets` | Internal task management with priorities, due dates, assignments, and comments | -- |
| `meetings` | Meeting scheduling with collaborative notes | -- |
| `notifications` | In-app notification system for application updates, ticket assignments, and decisions | -- |
| `news` | AI-curated news feed relevant to your portfolio | -- |
| `liveblocks` | Real-time collaborative editing for deliberation notes | [Liveblocks](https://liveblocks.io) account |
| `rejectionEmails` | AI-generated personalized rejection emails | [Anthropic](https://anthropic.com) API key |
| `sms` | SMS notifications for time-sensitive alerts | [Twilio](https://twilio.com) account |

---

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org) 18+
- [pnpm](https://pnpm.io) 9+
- A [Supabase](https://supabase.com) project (free tier works)

### 1. Clone & Install

```bash
git clone https://github.com/nralston-saif/vcrm.git
cd vcrm
pnpm install
```

### 2. Create a Supabase Project

1. Create a new project at [supabase.com](https://supabase.com) (free tier works)
2. **Save the database password** shown during project creation -- you'll need it during setup
3. Once the project is created, you'll need three values from the Supabase dashboard:
   - **Project URL** -- found on the project home page (looks like `https://abc123.supabase.co`)
   - **Anon (public) key** -- go to **Project Settings** (gear icon) → **API Keys** → scroll down to **Legacy API** → copy the `anon` `public` key
   - **Service role key** -- same section, copy the `service_role` `secret` key (click to reveal it)

### 3. Run the Setup Wizard

```bash
pnpm init-fund
```

This single command walks you through the entire setup:
1. **Fund branding** -- name, tagline, logo, support email
2. **Module selection** -- checkboxes for each feature (core modules enabled by default)
3. **Supabase credentials** -- project URL, anon key, service role key, and database password
4. **Database migrations** -- connects to your database and runs all schema migrations (auto-detects direct vs. pooler connection)
5. **First user creation** -- email, password, and name for your first login
6. **Data import** (optional) -- import existing companies, contacts, and investments from CSV
7. **Webhook setup** (optional) -- guidance for connecting your application intake form

When it's done, you're ready to go.

> You can also edit `apps/crm/fund.config.ts` directly at any time to change branding or toggle modules on/off.

### 4. Start Development

```bash
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001) and log in.

---

## Project Structure

```
vcrm/
├── apps/
│   └── crm/                      # Main CRM application
│       ├── app/                   # Next.js App Router
│       │   ├── dashboard/         # Main dashboard
│       │   ├── deals/             # Deal pipeline & voting
│       │   ├── portfolio/         # Investment tracking
│       │   ├── companies/         # Company database
│       │   ├── people/            # Contact management
│       │   ├── tickets/           # Task management
│       │   ├── meetings/         # Meeting notes
│       │   ├── pipeline/          # Pipeline stage view
│       │   ├── api/               # API routes
│       │   └── auth/              # Authentication flows
│       ├── components/            # React components
│       ├── lib/                   # Utilities & helpers
│       └── fund.config.ts         # Fund configuration
├── packages/
│   ├── supabase/                  # Shared Supabase client & types
│   ├── ui/                        # Shared UI components (Toast, ErrorBoundary)
│   └── config/                    # Shared TypeScript & Tailwind config
├── supabase/
│   └── migrations/                # Database schema (run in order)
├── .env.example                   # Environment variable template
├── turbo.json                     # Turborepo configuration
└── pnpm-workspace.yaml            # pnpm workspace definition
```

---

## Deal Pipeline Workflow

The deals module provides a structured workflow for evaluating investment opportunities:

```
Form Submission → New Application → Partner Voting → Deliberation → Decision
```

### 1. Application Intake
Applications come in via a webhook from your form provider (JotForm, Typeform, Google Forms, etc.). Configure the field mapping in `fund.config.ts`:

```typescript
webhookFieldMap: {
  companyName: 'your_form_field_id_for_company',
  website: 'your_form_field_id_for_website',
  companyDescription: 'your_form_field_id_for_description',
  founderNames: 'your_form_field_id_for_founders',
  primaryEmail: 'your_form_field_id_for_email',
  deckLink: 'your_form_field_id_for_deck',
  // ... etc
}
```

Point your form's webhook to: `https://your-domain.com/api/webhook/jotform`

### 2. Partner Voting
Each partner casts an initial vote (pass/discuss/invest) with notes. Votes are hidden until all partners have voted (configurable).

### 3. Deliberation
Applications that pass voting move to deliberation. Partners can add meeting notes, summaries, and thoughts using the collaborative editor.

### 4. Decision
Applications are marked as `portfolio` (invested) or `rejected`. If rejection emails are enabled, AI-generated personalized emails can be drafted and sent.

---

## Database Schema

### Core Tables
| Table | Description |
|-------|-------------|
| `people` | All contacts (partners, founders, advisors, etc.) |
| `companies` | Company database with pipeline staging |
| `company_people` | Company-person relationships (junction table) |
| `investments` | Investment records with terms and valuations |
| `tags` | Taxonomy/tagging system |

### Deal Flow Tables
| Table | Description |
|-------|-------------|
| `applications` | Inbound deal applications |
| `votes` | Partner votes on applications |
| `deliberations` | Meeting decisions and notes |
| `application_notes` | Notes on specific applications |
| `company_notes` | Notes on companies |
| `people_notes` | Notes on contacts |
| `investment_notes` | Notes on investments |

### Operations Tables
| Table | Description |
|-------|-------------|
| `tickets` | Task/ticket management |
| `ticket_comments` | Comments on tickets |
| `meetings` | Meeting records |
| `meeting_notes` | Notes per meeting |
| `notifications` | In-app notifications |
| `audit_log` | Security audit trail |
| `news_articles` | AI-curated news feed |

---

## Inviting New Users

VCRM uses invite-only authentication. To add new team members:

```bash
pnpm create-user
```

This creates both the Supabase auth account and the linked CRM profile in one step.

---

## Importing Existing Data

If you have existing data in spreadsheets, you can import it via CSV:

```bash
pnpm import-data
```

CSV templates are included in the `templates/` folder:
- `templates/companies.csv` -- Company database
- `templates/contacts.csv` -- Contacts / founders / advisors
- `templates/investments.csv` -- Investment records (import companies first)

Edit the templates with your data, or have an AI generate CSVs from your existing spreadsheets using these templates as a reference.

---

## Post-Setup Checklist

After setup completes, verify everything is working:

- [ ] Run `pnpm dev` and open [http://localhost:3001](http://localhost:3001)
- [ ] Log in with the email and password you created during setup
- [ ] Confirm you see the dashboard with portfolio stats, pending votes, and to-do sections
- [ ] Navigate to **People** -- you should see your own profile listed
- [ ] Navigate to **Companies** -- if you imported data, your companies appear here
- [ ] Create a test ticket: click **New Ticket** in the nav, fill it in, and confirm it appears under **Tickets**
- [ ] Invite a second partner: run `pnpm create-user` and have them log in
- [ ] (Optional) Run `pnpm doctor` to verify your environment is healthy

---

## First 5 Minutes Guide

Once you've logged in for the first time, here's how to orient yourself and start getting value from the CRM.

### 1. The Dashboard

This is your home base. It has four sections:

- **Portfolio Stats** -- total investments, total invested, average check size. Empty until you add investments.
- **Needs Your Vote** -- applications waiting for you to vote. Empty until deals come in via the webhook.
- **Needs Decision** -- applications in deliberation that need a final yes/no.
- **My To-Do** -- tickets assigned to you, sorted by due date. Overdue items are highlighted.

### 2. Import Your Existing Data

If you skipped the import during setup, you can do it now:

1. Open the CSV templates in `templates/` -- they have example rows showing the expected format
2. Replace the example data with your real companies, contacts, and investments
3. Run `pnpm import-data` and follow the prompts
4. Investments should be imported last (they reference companies by name)

### 3. Add Your Partners

Each person who needs access requires an account:

```bash
pnpm create-user
```

This creates both the auth login and the CRM profile. Share the email/password with them. They can change their password after first login via the profile page.

### 4. Set Up Deal Flow (Optional)

If you're using the deals module to track inbound applications:

1. Create an application form with your preferred provider (Typeform, Google Forms, Tally, etc.)
2. Add a webhook integration pointing to `https://your-domain.com/api/webhook/jotform`
3. Edit `fund.config.ts` and update `webhookFieldMap` to match your form's field names/IDs
4. Set the `WEBHOOK_SECRET` environment variable and configure your form to send it in the `X-Webhook-Secret` header

See the [Webhook Field Mapping](#webhook-field-mapping-examples) section below for provider-specific examples.

### 5. Explore the Modules

- **Deals** -- where applications land after form submission. Vote on them, advance to deliberation, make decisions.
- **Portfolio** -- track investments with amounts, rounds, and valuations. Link founders to companies.
- **Tickets** -- lightweight task management. Create tickets for due diligence tasks, follow-ups, etc.
- **Meetings** -- record meeting notes. If Liveblocks is enabled, notes are collaboratively editable in real-time.
- **People / Companies** -- your contact database. Add notes, tag contacts, track relationships.
- **Search** -- press `Cmd+K` (or `Ctrl+K`) anywhere to search across all data.

---

## Deployment

### Vercel (Recommended)

1. **Push your repo to GitHub**
   ```bash
   git init && git add -A && git commit -m "Initial setup"
   gh repo create your-fund/vcrm --private --push
   ```

2. **Create a Vercel project**
   - Go to [vercel.com/new](https://vercel.com/new) and click **Import Git Repository**
   - Select your repo from the list

3. **Configure build settings**
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: click **Edit** and set to `apps/crm`
   - **Build Command**: leave as default (`next build`)
   - **Install Command**: set to `pnpm install` (Vercel detects pnpm from the lock file)

4. **Add environment variables**
   - Click **Environment Variables** before deploying
   - Add each variable from your `apps/crm/.env.local` file:
     - `NEXT_PUBLIC_SUPABASE_URL` -- your Supabase project URL
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` -- your anon/public key
     - `SUPABASE_SERVICE_ROLE_KEY` -- your service role key
     - `WEBHOOK_SECRET` -- a random string for webhook auth (generate one with `openssl rand -hex 32`)
   - Add any optional keys (Liveblocks, Anthropic, Twilio) if you enabled those modules

5. **Deploy** -- click Deploy and wait for the build to complete (~2 minutes)

6. **Set up a custom domain** (optional)
   - Go to your project's **Settings > Domains**
   - Add your domain and follow the DNS instructions

### Environment Variables for Production

Make sure to set all variables from `.env.example` in your hosting provider's dashboard. At minimum:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
WEBHOOK_SECRET
```

---

## Customization

### Changing the Logo
Edit the `branding.logo` array in `fund.config.ts`. Each entry renders a `<span>` with the specified font weight:

```typescript
// Single word logo
logo: [{ text: 'ACME', weight: 'bold' }]

// Multi-part logo with different weights
logo: [
  { text: 'A', weight: 'light' },
  { text: 'CME', weight: 'bold' },
]
```

### Changing Colors
Update `branding.primaryColor` in `fund.config.ts` and the CSS variables in `apps/crm/app/globals.css`:

```css
:root {
  --primary: #your-color;
  --foreground: #your-color;
}
```

### Changing Fonts
1. Update `branding.font` and `branding.fontUrl` in `fund.config.ts`
2. The font is loaded in `apps/crm/app/layout.tsx` from Google Fonts

### Adding Custom Pipeline Stages
Modify the stage constraint in your database and update the `CompanyStage` type in `packages/supabase/src/types/database.ts`.

### Adding New Pages
1. Create a new directory in `apps/crm/app/your-page/`
2. Add a `page.tsx` file (server component for data fetching)
3. Optionally add a client component for interactivity
4. Add navigation entry in `components/Navigation.tsx`

---

## Development

### Commands

```bash
pnpm init-fund    # Full setup wizard (branding, modules, DB, user, import)
pnpm import-data  # Import companies, contacts, or investments from CSV
pnpm db:setup     # Re-run database migrations (standalone)
pnpm create-user  # Add another user (auth + CRM profile)
pnpm doctor       # Check your environment, DB connection, and config
pnpm dev          # Start development server (port 3001)
pnpm build        # Build for production
pnpm typecheck    # Run TypeScript type checking
pnpm lint         # Run ESLint
pnpm clean        # Clean build artifacts
```

### Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Database | Supabase (PostgreSQL) |
| Package Manager | pnpm 9 |
| Build System | Turborepo |
| Real-time | Liveblocks (optional) |
| SMS | Twilio (optional) |
| AI | Anthropic Claude (optional) |

### Shared Packages

- **@vcrm/supabase** -- Supabase client configuration and TypeScript database types
- **@vcrm/ui** -- Shared UI components (Toast notifications, ErrorBoundary, Providers)
- **@vcrm/config** -- Shared TypeScript and Tailwind configurations

---

## Webhook Field Mapping Examples

The webhook endpoint accepts both JSON (`application/json`) and form-encoded payloads. Update `webhookFieldMap` in `fund.config.ts` to match your form provider's field names.

### Typeform

Typeform sends JSON payloads. Each field has a `ref` you define when creating the form:

```typescript
webhookFieldMap: {
  companyName: 'company_name',
  website: 'company_website',
  companyDescription: 'description',
  founderNames: 'founder_names',
  founderLinkedins: 'founder_linkedins',
  founderBios: 'founder_bios',
  primaryEmail: 'contact_email',
  previousFunding: 'previous_funding',
  deckLink: 'deck_link',
},
```

In your Typeform webhook settings, set the URL to `https://your-domain.com/api/webhook/jotform` and add the `X-Webhook-Secret` header.

### Google Forms (via Apps Script)

Google Forms doesn't have native webhooks, but you can use a simple Apps Script to forward submissions:

1. Open your form, go to **Extensions > Apps Script**
2. Add a script that `onFormSubmit` posts the responses as JSON to your webhook URL
3. Map the field names to match your script's JSON keys

### Tally

Tally sends JSON with field IDs. Find your field IDs in the Tally integration settings:

```typescript
webhookFieldMap: {
  companyName: 'question_abc123',
  website: 'question_def456',
  // ... etc
},
```

### General / Custom

Any service that can send a POST request with JSON or form-encoded data will work. The webhook checks both nested `answers[key].answer` (JotForm-style) and top-level `data[key]` fields. Use whatever field names your provider sends and map them in `fund.config.ts`.

---

## Troubleshooting

### `pnpm: command not found`

pnpm is not installed. Install it with:

```bash
npm install -g pnpm@9
```

If `npm` is also not found, install [Node.js](https://nodejs.org) first (version 18 or higher).

### `error: engines.node version ... is incompatible`

Your Node.js version is too old. Check with `node --version` and upgrade to 18+ from [nodejs.org](https://nodejs.org).

### Database connection failed during setup

- **Wrong password**: The database password is the one shown when you first created the Supabase project. It's different from your Supabase account password. You can reset it at: `https://supabase.com/dashboard/project/YOUR_PROJECT_REF/settings/database`
- **ENOTFOUND / host not available**: Newer Supabase projects don't have a direct database host. The setup wizard will detect this and ask you to paste your Session pooler connection string from the Supabase dashboard (Project Settings → Database → Connection string → Session pooler).
- **Project still provisioning**: New Supabase projects take 1-2 minutes to become available. Wait and try again.
- **Network issues**: Make sure you're not behind a firewall that blocks port 5432.

### Port 3001 already in use

Another process is using port 3001. Find and stop it:

```bash
lsof -i :3001           # Find the process
kill -9 <PID>           # Stop it
```

Or change the port in `apps/crm/package.json` by editing the `dev` script.

### Can't log in after setup

- Make sure you're using the exact email and password from the setup wizard
- Check that the `people` record was created: go to your Supabase dashboard > Table Editor > `people` table
- If the record is missing, run `pnpm create-user` to create a new account

### Webhook not receiving submissions

1. Verify `WEBHOOK_SECRET` is set in both your `.env.local` and your form provider's webhook settings
2. The form must send the secret in the `X-Webhook-Secret` header
3. Check that `webhookFieldMap` in `fund.config.ts` matches your form's actual field names/IDs
4. For local testing, use a tunnel: `npx ngrok http 3001`
5. Run `pnpm doctor` to verify your environment is configured correctly

### Migrations fail with "relation already exists"

This means the migrations were already run (partially or fully). If you need to start fresh, go to your Supabase dashboard > SQL Editor and drop the existing tables, then re-run `pnpm db:setup`.

### Build fails with type errors

Run `pnpm typecheck` to see the full error output. If the errors reference columns or tables that don't exist, the TypeScript types may be out of sync with the database schema. Regenerate types with the Supabase CLI: `npx supabase gen types typescript --project-id YOUR_PROJECT_REF > apps/crm/lib/types/database.ts`.

### Run the diagnostic tool

When in doubt, run:

```bash
pnpm doctor
```

This checks your Node.js version, pnpm version, environment variables, database connection, migration files, and fund configuration.

---

## FAQ

### Can I use any form provider?
Yes. The webhook endpoint (`/api/webhook/jotform`) works with any provider that sends POST requests -- Typeform, Google Forms, Tally, JotForm, or any custom integration. It accepts both JSON and form-encoded payloads. Update the `webhookFieldMap` in `fund.config.ts` to match your form's field names. See the [Webhook Field Mapping Examples](#webhook-field-mapping-examples) section for provider-specific guidance.

### Can I add more team roles later?
The template is designed for partners-only access (everyone who can log in has full access). If you need role-based access control, you can add Supabase RLS policies and role checks to the auth helpers.

### How do I back up my data?
Use Supabase's built-in backup features, or set up pg_dump on a schedule. Your data lives in a standard PostgreSQL database.

### Can I self-host instead of using Supabase Cloud?
Yes. Supabase can be [self-hosted](https://supabase.com/docs/guides/self-hosting). Update your environment variables to point to your self-hosted instance.

---

## License

MIT
