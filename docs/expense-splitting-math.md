# Expense Splitting — Mathematical Rules

This document is the source of truth for how Ledger allocates expense amounts
across event attendees. The rules described here are implemented in
`artifacts/api-server/src/lib/allocation.ts`.

---

## Guiding Philosophy

**Each expense is processed independently.**

A member's total liability is the sum of the individual amounts allocated to
them across all expenses. Only after every expense has been allocated does the
settlement engine aggregate net balances and simplify debts.

The settlement engine never contains split-specific logic. It only reads the
pre-computed per-member allocations that are stored in `expense_participants`.

---

## Split Modalities

### 1. Everyone

The expense is divided equally among **every approved attendee** in the event.

```
per_member_share = expense_amount ÷ number_of_attendees
```

**Example**

| Input | Value |
|-------|-------|
| Expense amount | ₹8 500 |
| Attendees | 17 |

```
850 000 paise ÷ 17 = 50 000 paise each  →  ₹500 per attendee
```

---

### 2. One Share Per House (`families`)

The expense is allocated in two steps.

**Step 1 — House shares**

Each participating house receives one equal slice of the total:

```
house_share = expense_amount ÷ number_of_participating_houses
```

A "participating house" is any house listed in the request's `houseIds` array
that has at least one approved member.

**Step 2 — Member shares within each house**

That house's slice is divided equally among all approved members of that house:

```
member_share = house_share ÷ members_in_that_house
```

Because every house gets the same-sized slice regardless of how many members it
contains, house size affects only the per-member granularity, not the house's
total contribution.

**Key property:** a house is never a creditor or debtor. It is purely an
allocation mechanism. Debts are always settled between individual members.

**Example**

| Input | Value |
|-------|-------|
| Expense amount | ₹4 100 (410 000 paise) |
| Participating houses | 6 |

```
House share = floor(410 000 ÷ 6) = 68 333 paise
Remainder   = 410 000 − 68 333 × 6 = 2 paise  →  first house gets 68 335
```

| House | Members | House slice (paise) | Per-member (paise) |
|-------|---------|---------------------|-------------------|
| A (first) | 4 | 68 335 | 17 084 + 17 083 + 17 083 + 17 083 |
| B | 2 | 68 333 | 34 167 + 34 166 |
| C | 1 | 68 333 | 68 333 |
| D | 3 | 68 333 | 22 778 + 22 778 + 22 777 |
| E | 5 | 68 333 | 13 667 + 13 667 + 13 667 + 13 666 + 13 666 |
| F | 2 | 68 333 | 34 167 + 34 166 |

Sum check: 68 335 + 5 × 68 333 = 68 335 + 341 665 = **410 000 ✓**

---

### 3. Specific Members (`members`)

Only the explicitly selected members participate. The expense is divided equally
among them, **regardless of which houses they belong to**.

```
per_member_share = expense_amount ÷ number_of_selected_members
```

There is no intermediate house allocation. House totals are always derived by
summing the individual liabilities of their members.

**Example**

| Input | Value |
|-------|-------|
| Expense amount | ₹2 400 |
| Selected members | 6 |

```
240 000 paise ÷ 6 = 40 000 paise each  →  ₹400 per member
```

---

## Rounding Strategy — Floor + First-Gets-Remainder

All amounts are stored as integers in the **smallest currency unit** (paise,
i.e. 1/100 of a rupee).

When a division is not exact:

1. `base_share = Math.floor(total ÷ count)`
2. `remainder  = total − base_share × count`
3. The **first** recipient receives `base_share + remainder`; every other
   recipient receives `base_share`.

This guarantees:

```
Σ allocations = expense_amount   (exactly, no rounding drift)
```

For the `families` split the strategy is applied **twice** — once at the house
level and once within each house — so the end-to-end guarantee still holds.

### Why not spread the remainder fairly?

The "largest remainder" method distributes one extra unit to the members with
the largest fractional parts, which is mathematically fairer. In practice,
remainders are at most `count − 1` paise (a few rupees at most for large events),
so the fairness difference is negligible. We favour the simpler approach.

---

## Settlement Engine

The settlement engine operates on the **aggregate picture** after all allocations
are stored:

```
net_balance(member) = total_paid(member) − total_owed(member)

  total_paid = Σ expense.amount   for every expense paid by this member
  total_owed = Σ allocation.amount for every allocation assigned to this member
```

A positive `net_balance` means the member is a net creditor; negative means
debtor. The debt-simplification algorithm (greedy minimum-transfer) then produces
the smallest set of payments that zeroes all balances.

---

## Edge Cases

### No valid participants

If `houseIds` or `participantIds` resolve to zero approved members, the engine
falls back to splitting among **all approved members** to prevent the payer from
bearing 100% of the liability alone.

### Single-member house (`families` split)

A house with exactly one member receives the full house share as their personal
allocation. No special-casing needed; `houseShare ÷ 1 = houseShare`.

### Single attendee

If there is only one approved member, they receive the full expense amount. The
summation guarantee still holds.

### Zero-amount expenses

An amount of 0 allocates 0 to every participant.

### Payer is not in the participating group

Valid. The payer is tracked in `paidByMemberId`. Their owed share is determined
solely by whether they appear in the allocation list, not by whether they paid.

---

## Worked Example — Mixed Split Modalities

**Event setup:** 3 houses, 6 members total.

| Member | House |
|--------|-------|
| Alice  | Wolves |
| Bob    | Wolves |
| Carol  | Ravens |
| Dave   | Ravens |
| Eve    | Foxes  |
| Frank  | Foxes  |

---

**Expense 1 — Tickets, ₹1 200, payer: Alice, split: Everyone**

```
120 000 paise ÷ 6 members = 20 000 paise (₹200) each
```

| Member | Owed from this expense |
|--------|----------------------|
| Alice  | ₹200 |
| Bob    | ₹200 |
| Carol  | ₹200 |
| Dave   | ₹200 |
| Eve    | ₹200 |
| Frank  | ₹200 |

---

**Expense 2 — Fuel, ₹600, payer: Eve, split: One Share Per House (all 3 houses)**

```
Step 1 — house share: 60 000 paise ÷ 3 houses = 20 000 paise each house
Step 2 — per member:  20 000 paise ÷ 2 members = 10 000 paise (₹100) each
```

| Member | Owed from this expense |
|--------|----------------------|
| Alice  | ₹100 |
| Bob    | ₹100 |
| Carol  | ₹100 |
| Dave   | ₹100 |
| Eve    | ₹100 |
| Frank  | ₹100 |

---

**Expense 3 — Dinner, ₹900, payer: Carol, split: Specific Members (Carol, Dave, Eve)**

```
90 000 paise ÷ 3 selected members = 30 000 paise (₹300) each
```

| Member | Owed from this expense |
|--------|----------------------|
| Carol  | ₹300 |
| Dave   | ₹300 |
| Eve    | ₹300 |

---

**Aggregate balances**

| Member | Total Paid | Total Owed | Net Balance |
|--------|-----------|-----------|-------------|
| Alice  | ₹1 200    | ₹300      | **+₹900**  |
| Bob    | ₹0        | ₹300      | **−₹300**  |
| Carol  | ₹900      | ₹600      | **+₹300**  |
| Dave   | ₹0        | ₹600      | **−₹600**  |
| Eve    | ₹600      | ₹600      | **0**       |
| Frank  | ₹0        | ₹300      | **−₹300**  |

Sum check: credits (+₹900 + ₹300 = +₹1 200) = debits (−₹300 − ₹600 − ₹300 = −₹1 200) ✓

Total expenses: ₹1 200 + ₹600 + ₹900 = **₹2 700**
Total allocated: ₹300×2 + ₹600×2 + ₹600 = **₹2 700** ✓
