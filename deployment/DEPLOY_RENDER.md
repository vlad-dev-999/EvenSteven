# Deploying to Render + Neon

This guide walks through deploying EvenSteven as a single **Render Web Service** (Node.js)
backed by a **Neon PostgreSQL** database.

---

## Prerequisites

| Requirement | Details |
|---|---|
| Node.js | **20.x** (LTS) |
| Package manager | pnpm 10 |
| Database | Neon PostgreSQL (any plan) |
| Render | Web Service (free tier works) |

---

## 1 — Create a Neon database

1. Sign in at [neon.tech](https://neon.tech) and create a new project.
2. Copy the **Connection string** from the Neon dashboard (Connection Details → Connection string).
   It looks like:
   ```
   postgresql://user:pass@ep-something.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
3. Keep it handy — you'll paste it into Render in the next step.

---

## 2 — Create a Render Web Service

1. Push (or connect) this repository to Render.
2. In Render → **New Web Service**, select the repository.
3. Configure:

| Setting | Value |
|---|---|
| **Runtime** | Node |
| **Node version** | `20` |
| **Root directory** | _(leave blank — repo root)_ |
| **Build Command** | `pnpm install --frozen-lockfile && pnpm --filter @workspace/ledger run build && pnpm --filter @workspace/api-server run build` |
| **Start Command** | `node --enable-source-maps artifacts/api-server/dist/index.mjs` |

---

## 3 — Set environment variables

Add these in **Render → Environment**:

| Variable | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Required |
| `DATABASE_URL` | `postgresql://...` | Neon connection string with `?sslmode=require` |
| `HOST_PASSWORD` | _(strong random string)_ | Protects the Steward's Desk |
| `SESSION_SECRET` | _(strong random string)_ | Signs authentication cookies |
| `BASE_PATH` | `/` | Frontend base path; set to `/` for root-mounted deployment |

> **Do not set `PORT`** — Render injects it automatically at runtime.

### Generating secure values

```bash
# HOST_PASSWORD
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 4 — Initialise the database schema

Run this **once** after the first deploy to push the Drizzle schema to Neon:

```bash
# From the repo root, with DATABASE_URL set in your local environment
DATABASE_URL="postgresql://..." pnpm --filter @workspace/db run push
```

Or from the Render **Shell** tab after the service is deployed:

```bash
pnpm --filter @workspace/db run push
```

Render's managed PostgreSQL and Neon both support `drizzle-kit push`.

> **Note:** On subsequent deploys Render's Publish flow diffs the schema automatically.
> You only need to run `push` manually for the very first deployment.

---

## 5 — Verify the deployment

After the service is live, check:

- `https://your-service.onrender.com/api/healthz` → `{"status":"ok"}`
- `https://your-service.onrender.com/` → Login page renders
- Log in with a directory member's PIN → My Events page loads
- Create an event → Event dashboard opens
- Access `/host` and log in with `HOST_PASSWORD` → Steward's Desk opens

---

## Architecture on Render

```
Browser
  │
  └─► Render Web Service (Node.js, single process)
        ├── /api/*   → Express API routes (port from $PORT)
        └── /*       → Serve artifacts/ledger/dist/public (compiled React SPA)
              └── /index.html  (SPA fallback for all unmatched routes)
```

The API server bundles to a single ESM file (`artifacts/api-server/dist/index.mjs`)
and serves the compiled Ledger frontend from `artifacts/ledger/dist/public`.

---

## Troubleshooting

### Build fails with "PORT environment variable is required"
- Make sure you are using the build command shown above (`pnpm --filter @workspace/ledger run build`).
  Vite's build mode does not require `PORT`; only the dev server does.

### `ECONNREFUSED` or DB errors on startup
- Confirm `DATABASE_URL` is set and the Neon connection string ends with `?sslmode=require`.
- Check the Neon dashboard → Monitoring for connection errors.

### White screen / SPA routes return 404
- Ensure `NODE_ENV=production` is set. Static serving and the SPA fallback are only
  activated in production mode.
- Confirm `BASE_PATH=/` is set if the service is deployed at the root path.

### Steward's Desk login fails
- `HOST_PASSWORD` must match what was used to derive the host token. If you change it,
  the Steward's Desk token changes and any saved/bookmarked host sessions will need re-login.

### Schema out of date after code changes
- Run `pnpm --filter @workspace/db run push` (with `DATABASE_URL` pointing at Neon)
  to apply any new schema changes.
