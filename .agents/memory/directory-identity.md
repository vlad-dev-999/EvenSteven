---
name: Directory-based identity model
description: How EvenSteven's join flow and PIN system work after the RC1 architectural change.
---

## The Rule
Identity and PINs live in the permanent **directory** (`people` table), not in event-scoped members.

- `people.personalPinHash` — scrypt-hashed 4-digit PIN, host-assigned.
- `GET /events/:token/identity-options` — returns ALL active directory people (grouped by house) with `hasPin: boolean` and `inEvent: boolean`. No event PIN, no event-member seed required to see the list.
- `POST /events/:token/identify` — accepts `{ personId, pin }`. Verifies against `people.personalPinHash`. Auto-creates an approved member if not already in the event.
- `POST /people/:id/pin` (host only) — generates a new random 4-digit PIN, stores the hash, returns plaintext once.

## What Was Removed
- Self-registration ("I'm not on the list") UI and `POST /events/:token/join-requests` public route.
- `members.personalPin` / `members.pinHash` (PIN was previously event-scoped on the member row).
- First-time claim flow (new PIN reveal on first join).

**Why:** PINs that expire per-event caused friction for recurring groups. A permanent directory PIN means the host sets it once; people reuse it every evening.

**How to apply:** When adding new join/identify features, always verify against `people.personalPinHash`, never generate a per-event PIN on `members`. The `join_requests` table is kept in DB schema but has no public-facing creation route.
