/**
 * Expense Allocation Engine
 *
 * Pure, stateless function that converts a single expense into a list of
 * per-member allocations. The sum of all returned amounts is guaranteed to
 * equal the original expense amount (subject to the integer rounding strategy
 * documented below).
 *
 * Rounding strategy: "floor + first-gets-remainder"
 *   - Divide using Math.floor so every share is a whole number of paise.
 *   - The leftover cents (amount mod count) are added to the first recipient
 *     so the total is always exactly correct.
 *   - For the `families` split the same strategy is applied twice: once at
 *     house level, then again within each house.
 *
 * This module has no imports from the database or HTTP layer and must never
 * be given any.
 */

// ── Public types ──────────────────────────────────────────────────────────────

export interface ApprovedMember {
  id: number;
  houseId: number | null;
}

/** One member's allocated share of a single expense, in paise (smallest unit). */
export interface Allocation {
  memberId: number;
  amount: number;
}

export interface ExpenseInput {
  /** Total expense amount in paise. */
  amount: number;
  splitType: "everyone" | "families" | "members";
}

export interface AllocationOptions {
  /** Required for splitType === 'families'. IDs of participating houses. */
  houseIds?: number[];
  /** Required for splitType === 'members'. IDs of selected members. */
  participantIds?: number[];
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Divide `total` into `count` integer shares.
 * Returns an array of length `count` whose first element absorbs any remainder.
 * Guarantees: shares.reduce((s, n) => s + n, 0) === total
 */
function divideWithRemainder(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, i) => (i === 0 ? base + remainder : base));
}

// ── Public function ───────────────────────────────────────────────────────────

/**
 * Allocate one expense across approved members.
 *
 * @param expense        The expense to allocate (amount + splitType).
 * @param approvedMembers All attendees who have been approved for the event.
 * @param options        Split-specific parameters (houseIds or participantIds).
 * @returns              One Allocation per participating member.
 *                       The sum of all amounts equals expense.amount exactly.
 *
 * Behaviour when inputs are degenerate (empty lists, unknown IDs):
 *   - Falls back to splitting among all approved members so the payer is
 *     never left holding 100% of the liability alone.
 */
export function allocateExpense(
  expense: ExpenseInput,
  approvedMembers: ApprovedMember[],
  options: AllocationOptions = {},
): Allocation[] {
  const { amount, splitType } = expense;

  // ── 1. Everyone ─────────────────────────────────────────────────────────────
  if (splitType === "everyone") {
    return _splitEqually(amount, approvedMembers.map((m) => m.id));
  }

  // ── 2. One Share Per House ───────────────────────────────────────────────────
  if (splitType === "families") {
    const requestedHouseIds = options.houseIds ?? [];

    // Determine which of the requested houses actually have ≥1 approved member.
    const participatingHouseIds = requestedHouseIds.filter((hid) =>
      approvedMembers.some((m) => m.houseId === hid),
    );

    if (participatingHouseIds.length === 0) {
      // Degenerate: fall back to everyone.
      return _splitEqually(amount, approvedMembers.map((m) => m.id));
    }

    // Give each house one equal share of the total (floor + first-gets-remainder).
    const houseShares = divideWithRemainder(amount, participatingHouseIds.length);

    const allocations: Allocation[] = [];

    for (let hi = 0; hi < participatingHouseIds.length; hi++) {
      const houseId = participatingHouseIds[hi];
      const houseAmount = houseShares[hi];
      const houseMembers = approvedMembers
        .filter((m) => m.houseId === houseId)
        .map((m) => m.id);

      // Split that house's share equally among its members.
      const memberShares = divideWithRemainder(houseAmount, houseMembers.length);
      for (let mi = 0; mi < houseMembers.length; mi++) {
        allocations.push({ memberId: houseMembers[mi], amount: memberShares[mi] });
      }
    }

    return allocations;
  }

  // ── 3. Specific Members ──────────────────────────────────────────────────────
  if (splitType === "members") {
    const requestedIds = options.participantIds ?? [];
    // Keep only IDs that belong to approved members.
    const validIds = requestedIds.filter((id) => approvedMembers.some((m) => m.id === id));

    if (validIds.length === 0) {
      // Degenerate: fall back to everyone.
      return _splitEqually(amount, approvedMembers.map((m) => m.id));
    }

    return _splitEqually(amount, validIds);
  }

  // Should never reach here given TypeScript types, but guard defensively.
  return _splitEqually(amount, approvedMembers.map((m) => m.id));
}

/** Split `amount` equally among `memberIds` (floor + first-gets-remainder). */
function _splitEqually(amount: number, memberIds: number[]): Allocation[] {
  if (memberIds.length === 0) return [];
  const shares = divideWithRemainder(amount, memberIds.length);
  return memberIds.map((memberId, i) => ({ memberId, amount: shares[i] }));
}
