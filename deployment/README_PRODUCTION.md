# EvenSteven — Production Overview

EvenSteven is a self-hosted collaborative expense-settlement PWA.
This document describes the production architecture, required configuration,
and operational notes for running the app outside of Replit.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, TailwindCSS v4, shadcn/ui, TanStack Query, wouter |
| API | Express 5, Node.js 20, TypeScript (bundled via esbuild) |
| Database | PostgreSQL 16 via Drizzle ORM (`pg` driver) |
| Logging | pino (structured JSON in production, pretty-printed in development) |

---

## Repository layout

```
artifacts/
  api-server/       Express API — bundles to dist/index.mjs
  ledger/           React SPA   — builds to dist/public/
lib/
  db/               Drizzle schema + pg connection
  api-zod/          Shared Zod schemas
  api-client-react/ Generated TanStack Query hooks (Orval)
deployment/         This folder — deployment docs and .env.example
```

---

## Environment variables

All configuration comes from environment variables. No `.env` file is committed.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres connection string. Use `?sslmode=require` for Neon/cloud providers. |
| `HOST_PASSWORD` | ✅ | Administrator password for the Steward's Desk. Deriving the host token requires both `HOST_PASSWORD` and `SESSION_SECRET`. |
| `SESSION_SECRET` | ✅ | Used with `HOST_PASSWORD` to derive the host token via HMAC-SHA256. |
| `NODE_ENV` | ✅ | Set to `production`. Controls logging format and enables static file serving. |
| `PORT` | ✅ (auto) | TCP port to listen on. Injected automatically by Render. |
| `BREVO_API_KEY` | ✅ | Brevo transactional email API key. Used to send activation OTP emails over HTTPS. Obtain from Brevo → Settings → API Keys. |
| `BREVO_SENDER_EMAIL` | ✅ | Verified sender address configured in your Brevo account. |
| `BREVO_SENDER_NAME` | optional | Display name in the From field. Default: `EvenSteven`. |
| `LOG_LEVEL` | optional | pino log level. Default: `info`. |
| `STATIC_DIR` | optional | Absolute path to the compiled frontend (`artifacts/ledger/dist/public`). Override if your layout differs. |
| `BASE_PATH` | build-time | Vite `base` for the frontend. Set to `/` for root-mounted deployments. |

See `deployment/.env.example` for a template.

---

## Production build

The build is a two-step process run from the repository root:

```bash
# 1. Install dependencies
pnpm install --frozen-lockfile

# 2. Build the React frontend (outputs to artifacts/ledger/dist/public)
BASE_PATH=/ pnpm --filter @workspace/ledger run build

# 3. Bundle the API server (outputs to artifacts/api-server/dist/index.mjs)
pnpm --filter @workspace/api-server run build
```

The API server build uses **esbuild** to produce a single ESM bundle. All dependencies
are inlined except native modules (pg-native, sharp, etc.) which are correctly
externalised.

---

## Starting the server

```bash
NODE_ENV=production node --enable-source-maps artifacts/api-server/dist/index.mjs
```

In production mode the Express server:
1. Handles all `/api/*` routes (REST API).
2. Serves compiled static assets from `artifacts/ledger/dist/public`.
3. Falls back to `index.html` for all other routes (SPA routing).

---

## Database

The app uses **Drizzle ORM** with a standard `pg.Pool` connection.

### Schema initialisation (first deploy)

```bash
DATABASE_URL="postgresql://..." pnpm --filter @workspace/db run push
```

### Subsequent deploys

Schema changes are applied by re-running `push`. The Drizzle schema is the source of
truth; no manual migration scripts are used.

### Amounts

All monetary values are stored as integers in **paise** (smallest INR unit).
The UI converts rupees ↔ paise on input and display.

---

## Authentication

| Mechanism | Description |
|---|---|
| Directory auth | Members select their House → Name and enter a 4-digit PIN. The PIN is stored as a bcrypt-free plaintext hash (intentional; see replit.md). The session is stored client-side in `localStorage`. |
| Host (admin) auth | The Steward's Desk uses an HMAC-SHA256 token derived from `HOST_PASSWORD` + `SESSION_SECRET`. The token is re-derived on each request; no state is stored server-side. |

---

## Logging

In `NODE_ENV=production` pino emits newline-delimited JSON to stdout. Render captures this
automatically. Log level is controlled by the `LOG_LEVEL` env var (default `info`).

Sensitive headers (`Authorization`, `Cookie`, `Set-Cookie`) are redacted from logs.

---

## Health check

```
GET /api/healthz
→ 200 {"status":"ok"}
```

Configure this as the Render health check path.

---

## Replit-specific code

The following Replit-specific dependencies are present in the repository but have **no
effect in production**:

| Item | Location | Production impact |
|---|---|---|
| `@replit/vite-plugin-runtime-error-modal` | `artifacts/ledger/package.json` | Only loaded when `REPL_ID` is set; skipped in production builds. |
| `@replit/vite-plugin-cartographer` | `artifacts/ledger/package.json` | Same — skipped unless `REPL_ID` is set. |
| `@replit/vite-plugin-dev-banner` | `artifacts/ledger/package.json` | Same — skipped unless `REPL_ID` is set. |
| `@replit/connectors-sdk` | root `package.json` | Installed but not imported by any application code. |

---

## Deployment target

See `deployment/DEPLOY_RENDER.md` for step-by-step Render + Neon instructions.
