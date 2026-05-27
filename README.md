# Linear Audit

Bumble-style swipe UI for triaging Linear tickets. Pick a project, define your categories, swipe through your open tickets, and watch each one update live.

> Right swipe = close. Left swipe = keep + categorize (and the category gets prefixed to the ticket title). New categories can be created on the fly.

## What it does

You point it at a Linear project (and optionally a milestone). It pulls every open ticket in scope, drops them into a swipe deck with a per-ticket recommendation, and as soon as you decide, it acts in Linear:

- **Right swipe → close** the ticket as Done or Canceled (with optional duplicate-of link)
- **Left swipe → categorize** + prefix the title with the chosen category (e.g. `[qol] Original title`)
- **Skip → leave alone** and move to the next card
- **Custom categories** — define your own per session, or add new ones inline while swiping

Categories are stored as title prefixes (the user-visible signal). No Linear labels are created.

## Stack

Follows the [Prometheus stack](https://github.com/Traba-Ops/claude-config/blob/main/docs/stack.md):

- **Frontend:** React + Vite + Tailwind CSS v4 + shadcn/ui
- **Backend:** Hono (bun runtime) — serves the built frontend in production
- **State:** TanStack React Query
- **Linear integration:** Linear GraphQL API via personal access token (PAT); OAuth flow on the roadmap
- **Toolchain:** bun + oxlint + tsc
- **Deploy:** Railway (single service — backend serves the built frontend)

## Running locally

```bash
bun install
bun run dev          # both apps
# or
bun run dev:web      # just frontend (Vite, default :5173)
bun run dev:api      # just backend (Hono, default :3000)
```

Then visit http://localhost:5173.

You'll need a Linear PAT — generate one at https://linear.app/settings/api. It's stored in your browser only (localStorage); the backend just forwards it to Linear.

## Repository layout

```
linear-audit/
├── apps/
│   ├── web/           # React + Vite — the swipe UI
│   └── api/           # Hono — Linear API proxy + static file server
├── packages/
│   └── shared/        # Shared types between web and api
├── docs/
│   └── SPEC.md        # Technical spec (kept current as the app evolves)
├── railway.json       # Railway deployment config
└── package.json       # bun workspace root
```

## Deploying to Railway

```bash
railway link        # link a Railway project
railway up          # ship it
```

The `railway.json` tells Railway to `bun install && bun run build` then `bun run start`. The backend serves the built `apps/web/dist` as static files plus the `/api/*` routes.

Auth — once deployed, the app uses in-app Google OAuth (gated to `@traba.work`). See [docs/SPEC.md](docs/SPEC.md) for details on the auth layer.

## Status

**Tier 3 — local prototype.** v0 single-file HTML lives at [docs/v0-prototype.html](docs/v0-prototype.html) for reference. v1 is the React app in this repo.

See [docs/SPEC.md](docs/SPEC.md) for what's built, what's stubbed, and what's next.
