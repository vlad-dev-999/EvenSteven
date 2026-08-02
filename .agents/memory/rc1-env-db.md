---
name: RC1 env and DB setup
description: How DATABASE_URL and HOST_PASSWORD are wired for the EvenSteven API server; Drizzle push command.
---

## DATABASE_URL
Replit runtime-managed — injected automatically into all shell commands and the running API server process. Never request or set it manually; `setEnvVars` rejects it as a runtime-managed key.

## HOST_PASSWORD
Required secret for the API server (`artifacts/api-server`). The server calls `FATAL` and exits on startup if it is missing. Set via `requestSecrets({ keys: ["HOST_PASSWORD"] })`. This is the admin password for the Steward's Desk console.

## Drizzle schema push
```
pnpm --filter @workspace/db run push
```
Runs against the Replit dev database using the injected `DATABASE_URL`. Run this after any schema changes in `lib/db/src/schema/`.

**Why:** The Replit built-in PostgreSQL doesn't appear in `searchIntegrations` — it is pre-provisioned per project, confirmed with `checkDatabase()`, and its connection vars are always available in the runtime environment.

## How to apply
- After schema changes: run the push command above.
- If the API server fails at startup with a missing-env FATAL: check `HOST_PASSWORD` is set as a Replit secret.
- Never try to manually set `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, or `PGDATABASE`.
