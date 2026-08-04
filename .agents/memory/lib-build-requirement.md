---
name: Lib build requirement
description: The composite TS lib packages must be built before typechecking consumers; they have no build script so must be run via tsc --build directly.
---

The workspace has two composite TypeScript lib packages that consumers reference via `tsconfig.json` `"references"`:

- `lib/api-client-react` — used by `artifacts/ledger`
- `lib/db` — used by `artifacts/api-server`
- `lib/api-zod` — also used by `artifacts/api-server`

**Rule:** Before running `pnpm --filter @workspace/ledger run typecheck` or `pnpm --filter @workspace/api-server run typecheck`, you must build the referenced libs or typecheck will fail with TS6305 ("Output file has not been built from source file").

**Why:** Both lib packages have `composite: true` + `emitDeclarationOnly: true` in their tsconfigs but no `build` script in package.json. They export `./src/index.ts` directly for Vite/bundler resolution, but tsc project references still require the `.d.ts` dist output to exist.

**How to apply:** Run once per session (or after any lib source change):
```sh
npx tsc --build lib/api-client-react/tsconfig.json
npx tsc --build lib/db/tsconfig.json
npx tsc --build lib/api-zod/tsconfig.json
```
These are idempotent and fast (incremental). The generated `dist/` files are gitignored, so they must be rebuilt after a fresh checkout.
