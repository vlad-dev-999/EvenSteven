import { describe, it, expect } from "vitest";
import { allocateExpense, type ApprovedMember, type Allocation } from "./allocation";

// ── Helpers ───────────────────────────────────────────────────────────────────

function sumAllocations(allocations: Allocation[]): number {
  return allocations.reduce((s, a) => s + a.amount, 0);
}

function amountFor(allocations: Allocation[], memberId: number): number {
  return allocations.find((a) => a.memberId === memberId)?.amount ?? 0;
}

// Shorthand builders
function member(id: number, houseId: number | null = null): ApprovedMember {
  return { id, houseId };
}

// ── Everyone split ────────────────────────────────────────────────────────────

describe("splitType: everyone", () => {
  it("divides expense equally among all approved members", () => {
    const members = [member(1), member(2), member(3), member(4)];
    const result = allocateExpense({ amount: 8000, splitType: "everyone" }, members);

    expect(result).toHaveLength(4);
    expect(sumAllocations(result)).toBe(8000);
    result.forEach((a) => expect(a.amount).toBe(2000));
  });

  it("handles 17 attendees for ₹8500 (₹500 each)", () => {
    // 850 000 paise ÷ 17 = 50 000 each (exact)
    const members = Array.from({ length: 17 }, (_, i) => member(i + 1));
    const result = allocateExpense({ amount: 850000, splitType: "everyone" }, members);

    expect(result).toHaveLength(17);
    expect(sumAllocations(result)).toBe(850000);
    result.forEach((a) => expect(a.amount).toBe(50000));
  });

  it("distributes remainder to first member when not evenly divisible", () => {
    // 100 paise ÷ 3 = 33 base, remainder 1 → [34, 33, 33]
    const members = [member(1), member(2), member(3)];
    const result = allocateExpense({ amount: 100, splitType: "everyone" }, members);

    expect(sumAllocations(result)).toBe(100);
    expect(amountFor(result, 1)).toBe(34);
    expect(amountFor(result, 2)).toBe(33);
    expect(amountFor(result, 3)).toBe(33);
  });

  it("works with a single member", () => {
    const result = allocateExpense({ amount: 5000, splitType: "everyone" }, [member(1)]);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(5000);
  });

  it("ignores houseIds and participantIds options", () => {
    const members = [member(1, 10), member(2, 20)];
    const result = allocateExpense(
      { amount: 1000, splitType: "everyone" },
      members,
      { houseIds: [10], participantIds: [1] },
    );
    // Still splits among all members
    expect(result).toHaveLength(2);
    expect(sumAllocations(result)).toBe(1000);
  });
});

// ── Families (one share per house) split ─────────────────────────────────────

describe("splitType: families", () => {
  it("gives each house an equal share, then splits within house", () => {
    // 2 houses, 2 members each, ₹600 total
    // house share = 300 each; member share = 150 each
    const members = [member(1, 10), member(2, 10), member(3, 20), member(4, 20)];
    const result = allocateExpense(
      { amount: 600, splitType: "families" },
      members,
      { houseIds: [10, 20] },
    );

    expect(result).toHaveLength(4);
    expect(sumAllocations(result)).toBe(600);
    // All members equal because houses are equal size
    result.forEach((a) => expect(a.amount).toBe(150));
  });

  it("larger house pays less per member, smaller house pays more per member", () => {
    // ₹600 across 2 houses: house 10 has 4 members, house 20 has 2 members
    // house share = 300 each
    // house 10: 300 ÷ 4 = 75 per member
    // house 20: 300 ÷ 2 = 150 per member
    const members = [
      member(1, 10), member(2, 10), member(3, 10), member(4, 10), // 4 in house 10
      member(5, 20), member(6, 20),                                // 2 in house 20
    ];
    const result = allocateExpense(
      { amount: 60000, splitType: "families" },
      members,
      { houseIds: [10, 20] },
    );

    expect(result).toHaveLength(6);
    expect(sumAllocations(result)).toBe(60000);

    const house10 = result.filter((a) => [1, 2, 3, 4].includes(a.memberId));
    const house20 = result.filter((a) => [5, 6].includes(a.memberId));

    // House totals equal
    expect(house10.reduce((s, a) => s + a.amount, 0)).toBe(30000);
    expect(house20.reduce((s, a) => s + a.amount, 0)).toBe(30000);

    // Per-member shares
    house10.forEach((a) => expect(a.amount).toBe(7500));
    house20.forEach((a) => expect(a.amount).toBe(15000));
  });

  it("handles uneven house sizes with rounding — sum always exact", () => {
    // ₹4100 (410 000 paise) across 6 houses
    const members = [
      member(1, 1), member(2, 1), member(3, 1), member(4, 1), // 4 members
      member(5, 2), member(6, 2),                               // 2 members
      member(7, 3),                                             // 1 member
      member(8, 4), member(9, 4), member(10, 4),               // 3 members
      member(11, 5), member(12, 5), member(13, 5), member(14, 5), member(15, 5), // 5 members
      member(16, 6), member(17, 6),                            // 2 members
    ];
    const result = allocateExpense(
      { amount: 410000, splitType: "families" },
      members,
      { houseIds: [1, 2, 3, 4, 5, 6] },
    );

    expect(result).toHaveLength(17);
    expect(sumAllocations(result)).toBe(410000);
  });

  it("single-member house receives the full house share", () => {
    // ₹300 across 3 equal houses, each with different member counts
    // house 10: 1 member, house 20: 2 members, house 30: 3 members
    // house share = 100 each (exact)
    // house 10 member: 100
    // house 20 members: 50 each
    // house 30 members: 33 + 33 + 34 (first gets remainder)
    const members = [
      member(1, 10),
      member(2, 20), member(3, 20),
      member(4, 30), member(5, 30), member(6, 30),
    ];
    const result = allocateExpense(
      { amount: 300, splitType: "families" },
      members,
      { houseIds: [10, 20, 30] },
    );

    expect(sumAllocations(result)).toBe(300);
    expect(amountFor(result, 1)).toBe(100); // solo house
    expect(amountFor(result, 2)).toBe(50);
    expect(amountFor(result, 3)).toBe(50);
    // 100 ÷ 3 = 33 rem 1 → first gets 34
    expect(amountFor(result, 4)).toBe(34);
    expect(amountFor(result, 5)).toBe(33);
    expect(amountFor(result, 6)).toBe(33);
  });

  it("only allocates to members of the specified houseIds, not all approved members", () => {
    const members = [
      member(1, 10), member(2, 10), // house 10 — selected
      member(3, 20), member(4, 20), // house 20 — NOT selected
    ];
    const result = allocateExpense(
      { amount: 1000, splitType: "families" },
      members,
      { houseIds: [10] },
    );

    expect(result).toHaveLength(2);
    expect(result.every((a) => [1, 2].includes(a.memberId))).toBe(true);
    expect(sumAllocations(result)).toBe(1000);
  });

  it("skips houseIds that have no approved members", () => {
    // houseId 99 doesn't match any member
    const members = [member(1, 10), member(2, 10)];
    const result = allocateExpense(
      { amount: 500, splitType: "families" },
      members,
      { houseIds: [10, 99] },
    );

    // Only house 10 is valid; gets full amount
    expect(result).toHaveLength(2);
    expect(sumAllocations(result)).toBe(500);
    result.forEach((a) => expect(a.amount).toBe(250));
  });

  it("falls back to everyone split when houseIds is empty", () => {
    const members = [member(1, 10), member(2, 20), member(3, 30)];
    const result = allocateExpense(
      { amount: 300, splitType: "families" },
      members,
      { houseIds: [] },
    );

    expect(result).toHaveLength(3);
    expect(sumAllocations(result)).toBe(300);
  });

  it("falls back to everyone split when houseIds is undefined", () => {
    const members = [member(1, 10), member(2, 20)];
    const result = allocateExpense(
      { amount: 200, splitType: "families" },
      members,
    );

    expect(result).toHaveLength(2);
    expect(sumAllocations(result)).toBe(200);
  });

  it("members without a houseId are excluded from families split", () => {
    // member(3) has no house; only houses 10 and 20 are selected
    const members = [member(1, 10), member(2, 20), member(3, null)];
    const result = allocateExpense(
      { amount: 200, splitType: "families" },
      members,
      { houseIds: [10, 20] },
    );

    // member 3 not included
    expect(result.every((a) => a.memberId !== 3)).toBe(true);
    expect(sumAllocations(result)).toBe(200);
  });
});

// ── Specific members split ────────────────────────────────────────────────────

describe("splitType: members", () => {
  it("splits equally among selected members only", () => {
    const members = [member(1), member(2), member(3), member(4), member(5), member(6)];
    const result = allocateExpense(
      { amount: 240000, splitType: "members" },
      members,
      { participantIds: [1, 2, 3, 4, 5, 6] },
    );

    expect(result).toHaveLength(6);
    expect(sumAllocations(result)).toBe(240000);
    result.forEach((a) => expect(a.amount).toBe(40000));
  });

  it("excludes non-selected members", () => {
    const members = [member(1), member(2), member(3)];
    const result = allocateExpense(
      { amount: 300, splitType: "members" },
      members,
      { participantIds: [1, 3] },
    );

    expect(result).toHaveLength(2);
    expect(result.find((a) => a.memberId === 2)).toBeUndefined();
    expect(sumAllocations(result)).toBe(300);
    expect(amountFor(result, 1)).toBe(150);
    expect(amountFor(result, 3)).toBe(150);
  });

  it("filters out participantIds that are not approved members", () => {
    const members = [member(1), member(2)];
    const result = allocateExpense(
      { amount: 400, splitType: "members" },
      members,
      { participantIds: [1, 999] }, // 999 not in approved list
    );

    expect(result).toHaveLength(1);
    expect(result[0].memberId).toBe(1);
    expect(result[0].amount).toBe(400);
  });

  it("handles rounding with remainder going to first selected member", () => {
    // 100 ÷ 3 = 33 rem 1
    const members = [member(1), member(2), member(3)];
    const result = allocateExpense(
      { amount: 100, splitType: "members" },
      members,
      { participantIds: [1, 2, 3] },
    );

    expect(sumAllocations(result)).toBe(100);
    expect(amountFor(result, 1)).toBe(34);
    expect(amountFor(result, 2)).toBe(33);
    expect(amountFor(result, 3)).toBe(33);
  });

  it("falls back to everyone when participantIds is empty", () => {
    const members = [member(1), member(2), member(3)];
    const result = allocateExpense(
      { amount: 300, splitType: "members" },
      members,
      { participantIds: [] },
    );

    expect(result).toHaveLength(3);
    expect(sumAllocations(result)).toBe(300);
  });

  it("falls back to everyone when participantIds is undefined", () => {
    const members = [member(1), member(2)];
    const result = allocateExpense({ amount: 200, splitType: "members" }, members);

    expect(result).toHaveLength(2);
    expect(sumAllocations(result)).toBe(200);
  });

  it("splits correctly when selected members span multiple houses (no house logic applies)", () => {
    // 2 members from house 10, 1 from house 20 — should be equal thirds, no house-weighting
    const members = [member(1, 10), member(2, 10), member(3, 20)];
    const result = allocateExpense(
      { amount: 300, splitType: "members" },
      members,
      { participantIds: [1, 2, 3] },
    );

    expect(result).toHaveLength(3);
    expect(sumAllocations(result)).toBe(300);
    result.forEach((a) => expect(a.amount).toBe(100));
  });
});

// ── Mixed modalities within the same event ────────────────────────────────────

describe("mixed split modalities", () => {
  it("computes independent allocations correctly for each expense", () => {
    // Event: members 1–6, houses: 10 (1,2), 20 (3,4), 30 (5,6)

    const allMembers = [
      member(1, 10), member(2, 10),
      member(3, 20), member(4, 20),
      member(5, 30), member(6, 30),
    ];

    // Expense A: everyone, ₹6000 → ₹1000 each
    const expA = allocateExpense({ amount: 6000, splitType: "everyone" }, allMembers);
    expect(sumAllocations(expA)).toBe(6000);
    expA.forEach((a) => expect(a.amount).toBe(1000));

    // Expense B: families (all 3 houses), ₹6000 → house share ₹2000 → ₹1000/member
    const expB = allocateExpense(
      { amount: 6000, splitType: "families" },
      allMembers,
      { houseIds: [10, 20, 30] },
    );
    expect(sumAllocations(expB)).toBe(6000);
    expB.forEach((a) => expect(a.amount).toBe(1000));

    // Expense C: members only (1, 3, 5), ₹300 → ₹100 each
    const expC = allocateExpense(
      { amount: 300, splitType: "members" },
      allMembers,
      { participantIds: [1, 3, 5] },
    );
    expect(sumAllocations(expC)).toBe(300);
    expect(amountFor(expC, 1)).toBe(100);
    expect(amountFor(expC, 3)).toBe(100);
    expect(amountFor(expC, 5)).toBe(100);
    expect(amountFor(expC, 2)).toBe(0);
    expect(amountFor(expC, 4)).toBe(0);
    expect(amountFor(expC, 6)).toBe(0);
  });

  it("aggregate liabilities match the documented worked example", () => {
    // From docs/expense-splitting-math.md worked example
    // Alice(1), Bob(2) — Wolves(10)
    // Carol(3), Dave(4) — Ravens(20)
    // Eve(5), Frank(6) — Foxes(30)

    const allMembers = [
      member(1, 10), member(2, 10), // Wolves
      member(3, 20), member(4, 20), // Ravens
      member(5, 30), member(6, 30), // Foxes
    ];

    // Expense 1: ₹1200, payer Alice, everyone
    const exp1 = allocateExpense({ amount: 120000, splitType: "everyone" }, allMembers);
    // Expense 2: ₹600, payer Eve, families (all 3 houses)
    const exp2 = allocateExpense(
      { amount: 60000, splitType: "families" },
      allMembers,
      { houseIds: [10, 20, 30] },
    );
    // Expense 3: ₹900, payer Carol, members (Carol=3, Dave=4, Eve=5)
    const exp3 = allocateExpense(
      { amount: 90000, splitType: "members" },
      allMembers,
      { participantIds: [3, 4, 5] },
    );

    // All sums correct
    expect(sumAllocations(exp1)).toBe(120000);
    expect(sumAllocations(exp2)).toBe(60000);
    expect(sumAllocations(exp3)).toBe(90000);

    // Build net balances
    const totalPaid = new Map<number, number>([
      [1, 120000], [2, 0], [3, 90000], [4, 0], [5, 60000], [6, 0],
    ]);
    const totalOwed = new Map<number, number>();
    for (const memberId of [1, 2, 3, 4, 5, 6]) totalOwed.set(memberId, 0);

    for (const exp of [exp1, exp2, exp3]) {
      for (const a of exp) {
        totalOwed.set(a.memberId, (totalOwed.get(a.memberId) ?? 0) + a.amount);
      }
    }

    const net = (id: number) => (totalPaid.get(id) ?? 0) - (totalOwed.get(id) ?? 0);

    expect(net(1)).toBe(90000);  // Alice:  +₹900
    expect(net(2)).toBe(-30000); // Bob:    −₹300
    expect(net(3)).toBe(30000);  // Carol:  +₹300
    expect(net(4)).toBe(-60000); // Dave:   −₹600
    expect(net(5)).toBe(0);      // Eve:    0
    expect(net(6)).toBe(-30000); // Frank:  −₹300

    // Credits = Debits
    const credits = [1, 3, 5].reduce((s, id) => s + Math.max(0, net(id)), 0);
    const debits  = [2, 4, 6].reduce((s, id) => s + Math.abs(Math.min(0, net(id))), 0);
    expect(credits).toBe(debits);
  });
});

// ── Rounding guarantees ───────────────────────────────────────────────────────

describe("rounding: sum always equals expense amount", () => {
  const cases: Array<{ amount: number; count: number }> = [
    { amount: 1, count: 2 },
    { amount: 1, count: 3 },
    { amount: 7, count: 3 },
    { amount: 100, count: 7 },
    { amount: 999, count: 13 },
    { amount: 410000, count: 6 },
    { amount: 1, count: 100 },
  ];

  for (const { amount, count } of cases) {
    it(`amount=${amount} among ${count} members (everyone)`, () => {
      const members = Array.from({ length: count }, (_, i) => member(i + 1));
      const result = allocateExpense({ amount, splitType: "everyone" }, members);
      expect(sumAllocations(result)).toBe(amount);
    });
  }

  it("families: nested rounding still sums to exact total", () => {
    // 7 paise across 3 houses of sizes 3, 2, 1
    const members = [
      member(1, 10), member(2, 10), member(3, 10),
      member(4, 20), member(5, 20),
      member(6, 30),
    ];
    const result = allocateExpense(
      { amount: 7, splitType: "families" },
      members,
      { houseIds: [10, 20, 30] },
    );
    expect(sumAllocations(result)).toBe(7);
  });

  it("zero amount allocates zero to everyone", () => {
    const members = [member(1), member(2), member(3)];
    const result = allocateExpense({ amount: 0, splitType: "everyone" }, members);
    expect(sumAllocations(result)).toBe(0);
    result.forEach((a) => expect(a.amount).toBe(0));
  });
});
