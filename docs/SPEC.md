# Linear Audit — Technical Spec

The technical spec for an engineer who needs to extend or rebuild this. Kept current as the app evolves.

## Purpose

A swipe-style triage UI for cleaning up a Linear project's open ticket backlog. The operator points it at a project (optionally narrowed to a milestone), defines a category vocabulary, then walks through each open ticket and either **closes** it (right swipe) or **keeps + categorizes** it (left swipe). Categories are encoded as a `[cat1, cat2]` prefix on the Linear ticket title.

Single-user, local-first today. Designed to graduate to a shared Tier 2 tool on Railway with Google OAuth.

## Architecture

```
┌────────────────────┐    HTTP    ┌────────────────┐    GraphQL    ┌──────────────────┐
│   apps/web (Vite)  │ ─────────→ │  apps/api      │ ────────────→ │  api.linear.app  │
│   React + Tailwind │            │  Hono (bun)    │               │                  │
└────────────────────┘            └────────────────┘               └──────────────────┘
                                       │
                                       ▼
                                  (no DB yet — all state lives client-side)
```

- **`apps/web`** is the swipe UI. Stores the user's Linear PAT in `localStorage` and forwards it on every API call.
- **`apps/api`** is a thin Hono server. Every endpoint expects an `X-Linear-Pat` header and proxies into the Linear GraphQL API. The PAT is never persisted server-side.
- **`packages/shared`** holds the cross-cutting types (`LinearIssue`, `AuditDecision`, `AuditCategory`) plus the title-prefix helpers (`buildTitleWithCategories`, `parseCategoriesFromTitle`).

## Live action loop

Each swipe is a synchronous round-trip:

1. UI builds an `AuditDecision`.
2. UI POSTs it to `/api/decisions` along with the current title and the active category list.
3. API resolves what to do:
   - `skip` → no-op.
   - `close` → set state to the team's `completed` workflow state; optional duplicate comment.
   - `cancel` → set state to the team's `canceled` workflow state; optional duplicate comment.
   - `pending` → merge picked category labels with any existing title prefix, write the updated title.
   - In all non-skip cases, if `note` is set, post it as a Linear comment.
4. API returns `ActionResult` with a human-readable list of what was performed; UI shows a toast.

## Categories — design choices

- **Categories live in the title, not as Linear labels.** This was an explicit user requirement to keep the audit categorization visible at a glance without spawning a forest of labels in the workspace settings.
- Title format: `[cat1, cat2] Original title`. Existing prefixes are detected and merged on subsequent applies.
- The user defines a category vocabulary up front (with the `DEFAULT_CATEGORIES` as a starting point) but can add new categories inline while swiping.
- Custom categories are not persisted across sessions in v0; they exist only in React state.

## File layout

```
apps/api/src/
  index.ts          Hono app (health, /api/whoami, /api/projects, /api/issues, /api/decisions, static file fallback)
  linear.ts         GraphQL client (whoami, listProjects, listMilestones, listOpenIssues, updateIssueTitle, closeIssue, commentOnIssue)

apps/web/src/
  App.tsx           Phase router (setup → swiping → done)
  main.tsx          React root
  app.css           Tailwind v4 entry + design tokens + swipe animations
  api.ts            fetch client for apps/api
  lib/recommend.ts  Per-ticket heuristic recommendation (close vs pending + category hint)
  state/AuditContext.tsx
                    React Context holding session state (PAT, project, milestone, categories, issues, position, toast)
  components/
    SetupScreen.tsx     Step 1: paste PAT · Step 2: project + milestone · Step 3: categories
    SwipeScreen.tsx     Card stack + keyboard handling + live action dispatch
    SwipeCard.tsx       One ticket: recommendation banner, ID/state/priority chips, title, description, Linear link
    CategoryModal.tsx   1-9 keys to pick categories, add new ones inline, optional note
    ResultsScreen.tsx   Done state — Linear holds the audit trail, no local replay needed

packages/shared/src/
  index.ts          Types + DEFAULT_CATEGORIES + title-prefix helpers
```

## API surface

- `GET /health` → `{ ok: true }`
- `GET /api/whoami` → `LinearUser`
- `GET /api/projects` → `LinearProject[]` (excludes Completed projects)
- `GET /api/projects/:id/milestones` → `LinearMilestone[]`
- `GET /api/issues?projectId=…&milestoneId=…` → `LinearIssue[]` (only open states: triage, backlog, unstarted, started)
- `POST /api/decisions` → `ActionResult`. Body: `{ decision: AuditDecision, categories: AuditCategory[], currentTitle: string }`

All endpoints require `X-Linear-Pat`.

## Keyboard

- `←` left → categorize (opens modal)
- `→` right → close (uses recommendation: maps `close` rec → Done, otherwise → Canceled)
- `S` → skip
- `U` → step back (visual undo only; Linear-side actions are not rolled back)
- `↑` / `↓` → scroll description on the top card
- In modal: `1-9` toggle category, `Enter` confirm, `Esc` cancel

## What's not built yet

- **Auth for shared deployment.** Today PAT is per-user and stays client-side; that's fine for Tier 3. Graduation to Tier 2 needs in-app Google OAuth (gated to `@traba.work`) per the Prometheus stack.
- **Linear OAuth.** Currently requires the user to paste a PAT. OAuth flow would be a per-app client ID + the standard `/oauth/authorize` / `/oauth/token` round-trip.
- **Persisted custom categories.** Right now category lists reset each session. Could persist in `localStorage` keyed by project ID.
- **Pre-loaded recommendations from prior context.** The original `linear-audit.html` had hand-curated "this is likely done / moot" recs. The generic recommender in `recommend.ts` does a basic heuristic pass; a follow-up would be to take previous-audit decisions into account, or to consult shipped tickets / PRs to suggest closing things that look done.
- **Bulk operations / save-progress.** Long audits should be resumable; right now closing the tab loses progress.
- **Linear-MCP-driven actions.** The original idea was for Claude (via Linear MCP) to be the actor; this version goes directly to Linear API for simplicity. Keep the option open if the team wants Claude in the loop for richer action sequences.

## Deployment

`railway.json` is wired for a single-service deploy:

1. `bun install && bun run build` — builds the React app into `apps/web/dist`.
2. `bun run start` — runs the Hono server, which serves the dist as static files plus `/api/*`.

Once deployed, add Google OAuth middleware to gate `/api/*` (and the static fallback) to `@traba.work` accounts.

## Notes

- The Hono server uses `serveStatic` from `hono/bun`, which is the Prometheus-prescribed pattern (single service, backend serves frontend, avoids Nixpacks monorepo confusion).
- Tailwind v4 is set up with the `@tailwindcss/vite` plugin and the design tokens live in `app.css` under `@theme`. No `tailwind.config.js`.
- The user PAT is never logged. Per-request only.
