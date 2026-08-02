---
name: House grouping fix
description: Why "Split by House" uses houseId (not familyId), and what was changed to make it consistent with settlement.
---

# House Grouping — Two Mechanisms Unified

## The Rule
"Split by House" expense splitting must use `members.houseId` (directory-level, permanent) — the same field that house settlement uses in `aggregateToHouseBalances`. The event-scoped `families` table / `members.familyId` is a separate (legacy/unused) grouping and must NOT be used for house splitting.

**Why:** Before the fix, splitting used `familyId` but settlement aggregated by `houseId`. They could never align — expenses split "by house" didn't affect the house settlement at all.

**How to apply:** Any future expense-splitting logic that groups by house must filter by `m.houseId`, not `m.familyId`.

## What Changed

- `computeParticipants` in `artifacts/api-server/src/routes/expenses.ts`: `familyIds` param → `houseIds`; filter `m.houseId in houseIds` instead of `m.familyId in familyIds`
- `lib/api-spec/openapi.yaml` + generated `lib/api-zod` + `lib/api-client-react`: `familyIds` field → `houseIds` in ExpenseInput
- `artifacts/ledger/src/pages/add-expense.tsx`: removed `useListFamilies`; derives distinct houses from `members[].houseId`/`houseName` instead; passes `houseIds` to API

## splitType value 'families' kept unchanged
The DB column and enum value `splitType = 'families'` was intentionally preserved. Only the grouping key (familyId → houseId) changed. Renaming the enum value would require a DB migration with no benefit.
