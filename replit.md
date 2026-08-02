# Ledger

A self-hosted collaborative expense settlement PWA for small social events. Friends join via a shared link, record expenses, and the app computes the minimum number of transfers to settle all debts.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080 → served at `/api`)
- `pnpm --filter @workspace/ledger run dev` — run the frontend (port 21356 → served at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — cookie signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, TailwindCSS v4, shadcn/ui, wouter, TanStack Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod v4 (via `zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/db/src/schema/` — database schema (events, members, families, expenses, expense_participants, join_requests, activity_log)
- `artifacts/api-server/src/routes/` — Express route handlers split by domain
- `artifacts/api-server/src/lib/settlement.ts` — minimum-transfer settlement engine
- `artifacts/api-server/src/lib/token.ts` — random token + PIN generation
- `artifacts/ledger/src/` — React frontend

## Architecture decisions

- **Session management is client-side**: member ID stored in `localStorage` under key `ledger_member_{token}`. The server receives the member ID via `x-member-id` header and validates it against the DB. No server-side session store needed.
- **PIN is stored in plaintext**: the 4-digit event PIN is treated as a shared secret distributed via WhatsApp, not a security-critical credential. Hashing would add complexity without meaningful security benefit for this use case.
- **Zod v4 alias fix**: Orval 8.23 generates `zod.int()` (v4 syntax), but the pnpm catalog pins `zod@^3.25.76`. The codegen script post-processes generated Zod files with sed to change `from 'zod'` → `from 'zod/v4'` (the v4 subpath bundled in 3.25.x).
- **Minimum-transfer settlement**: Uses a greedy algorithm — sort creditors and debtors by balance magnitude, match largest pairs first. Produces the fewest transfers possible.
- **Amount storage**: All monetary amounts stored as integers in smallest currency unit (paise). UI accepts rupees and converts before sending (`* 100`).

## Product

- **Create event**: Host sets event name + their name → gets a secure URL token + 4-digit PIN → shares via WhatsApp
- **Join event**: Participants open the link, see member cards, tap themselves or request to join as new
- **Dashboard**: Live balance strip, recent expenses, member list, add-expense FAB
- **Add expense**: 4-step wizard (category → amount → paid by → split) — under 10 seconds
- **Families**: Optional groupings for shared-household splitting
- **Settlements**: Minimum-transfer plan showing who pays whom
- **Activity log**: Full audit trail of all changes
- **Freeze event**: Host locks event when done; no further edits allowed

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing `lib/api-spec/openapi.yaml`, always re-run codegen before working on routes: `pnpm --filter @workspace/api-spec run codegen`
- After changing any file in `lib/*`, run `pnpm run typecheck:libs` before leaf artifact typechecks
- `pnpm --filter @workspace/db run push` for schema changes — do NOT write manual migration scripts
- The codegen script patches `from 'zod'` → `from 'zod/v4'` in generated Zod files via sed; if this stops working check the `lib/api-spec/package.json` codegen script

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
