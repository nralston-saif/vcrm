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
git clone https://github.com/YOUR_ORG/YOUR_REPO.git
cd YOUR_REPO
pnpm install
```

### 2. Run the Interactive Setup

```bash
pnpm init-fund
```

This walks you through:
- **Fund branding** -- name, tagline, logo, support email
- **Module selection** -- checkboxes for each feature (all core modules enabled by default, uncheck what you don't need)

The setup script generates your `fund.config.ts` and a `.env.local` template.

> You can also edit `apps/crm/fund.config.ts` directly at any time to change branding or toggle modules on/off.

### 3. Create a Supabase Project

1. Create a new project at [supabase.com](https://supabase.com) (free tier works)
2. **Save the database password** shown during project creation -- you'll need it in step 4
3. Go to **Settings > API** and copy your project URL, anon key, and service role key
4. Paste them into `apps/crm/.env.local` (created by the setup wizard)

### 4. Set Up the Database

```bash
pnpm db:setup
```

Enter your database password when prompted -- the script connects directly and runs all 6 migrations automatically.

### 5. Create Your First User

```bash
pnpm create-user
```

This prompts for email, password, first name, and last name -- then creates both the auth user and the linked CRM profile in one step.

### 6. Start Development

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

## Deployment

### Vercel (Recommended)

1. Push your repo to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Set the **Root Directory** to `apps/crm`
4. Add your environment variables in the Vercel dashboard
5. Deploy

### Environment Variables for Production

Make sure to set all variables from `.env.example` in your hosting provider's dashboard. At minimum:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
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
pnpm init-fund    # Interactive setup wizard (branding, modules)
pnpm db:setup     # Connect to Supabase and run all migrations
pnpm create-user  # Create a new user (auth + CRM profile)
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

## FAQ

### Can I use a different form provider?
Yes. The webhook endpoint (`/api/webhook/jotform`) works with any provider that sends POST requests. Update the `webhookFieldMap` in `fund.config.ts` to match your form's field names. Despite the route name, it accepts standard JSON or form-encoded data.

### Can I add more team roles later?
The template is designed for partners-only access (everyone who can log in has full access). If you need role-based access control, you can add Supabase RLS policies and role checks to the auth helpers.

### How do I back up my data?
Use Supabase's built-in backup features, or set up pg_dump on a schedule. Your data lives in a standard PostgreSQL database.

### Can I self-host instead of using Supabase Cloud?
Yes. Supabase can be [self-hosted](https://supabase.com/docs/guides/self-hosting). Update your environment variables to point to your self-hosted instance.

---

## License

MIT
