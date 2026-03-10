# VCRM - VC Fund CRM Template

## Overview

Open-source CRM for venture capital funds. Partners-only access (no role-based permissions). Modular architecture -- features can be enabled/disabled via `apps/crm/fund.config.ts`.

## Technology Stack

| Category | Technology |
|----------|------------|
| Package Manager | pnpm 9.x |
| Build System | Turborepo |
| Framework | Next.js 16.x (App Router) |
| Language | TypeScript 5.x |
| Styling | Tailwind CSS 4.x |
| Database | Supabase (PostgreSQL) |
| Real-time | Liveblocks (optional) |

## Project Structure

```
vcrm/
├── apps/crm/                    # CRM application (port 3001)
│   ├── app/                     # Next.js App Router pages
│   ├── components/              # React components
│   ├── lib/                     # Utilities, auth, notifications
│   └── fund.config.ts           # Fund branding & module config
├── packages/
│   ├── supabase/                # Shared Supabase client & types
│   ├── ui/                      # Shared UI components
│   └── config/                  # Shared TS & Tailwind config
└── supabase/migrations/         # Database schema (6 files, run in order)
```

## Key Files

- `apps/crm/fund.config.ts` -- All fund-specific configuration (name, logo, modules, webhook mapping)
- `apps/crm/lib/auth/requireAuth.ts` -- Auth helpers (`requireAuth` for pages, `requireAuthApi` for API routes)
- `apps/crm/lib/modules.ts` -- Module gating helpers
- `apps/crm/lib/notifications.ts` -- Notification system
- `packages/supabase/src/types/database.ts` -- Database type definitions

## Commands

```bash
pnpm dev              # Run dev server on port 3001
pnpm build            # Build for production
pnpm typecheck        # Type check all packages
pnpm lint             # Lint all packages
```

## Authentication

Invite-only. No RLS, no role-based access. All authenticated users have full access.

- `requireAuth()` -- Server component auth check (redirects to /login)
- `requireAuthApi()` -- API route auth check (returns null if unauthorized)

## Database Tables

**Core:** `people`, `companies`, `company_people`, `investments`, `tags`
**Deals:** `applications`, `votes`, `deliberations`, `company_notes`, `people_notes`, `application_notes`, `investment_notes`
**Operations:** `tickets`, `ticket_comments`, `meetings`, `meeting_notes`
**System:** `notifications`, `audit_log`, `news_articles`, `ticket_reports`, `auth_events`

## Module System

Modules are toggled in `fund.config.ts`. Navigation items auto-hide for disabled modules. Dashboard sections are conditional. Module gating is done via:
- `fundConfig.modules.deals` -- check in server components
- `isModuleEnabled('deals')` -- check using helper

## Environment Variables

Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
Optional: `NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY`, `TWILIO_*`, `ANTHROPIC_API_KEY`, `WEBHOOK_SECRET`

## Important Patterns

1. Server components fetch data, client components handle interactivity
2. Auth is checked at the page level with `requireAuth()`, not per-component
3. Supabase queries use the server client (`@/lib/supabase/server`) in server components
4. The webhook at `/api/webhook/jotform` accepts form submissions -- field mapping is in `fund.config.ts`
5. Notifications are created server-side via `createNotification()` / `createNotificationForMany()`
