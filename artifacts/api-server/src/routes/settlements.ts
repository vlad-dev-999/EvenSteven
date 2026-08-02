import { Router, type IRouter } from "express";
import { eq, desc, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  eventsTable,
  membersTable,
  housesTable,
  expensesTable,
  expenseParticipantsTable,
  activityLogTable,
} from "@workspace/db";
import { computeSettlements, type BalanceEntry, type Transfer } from "../lib/settlement";

const router: IRouter = Router();

// ── Shared balance-computation helper ─────────────────────────────────────────

interface MemberBalanceFull {
  memberId: number;
  memberName: string;
  houseId: number | null;
  houseName: string | null;
  houseCrest: string | null;
  houseAccentColor: string | null;
  totalPaid: number;
  totalOwed: number;
  netBalance: number;
}

async function buildMemberBalances(eventId: number): Promise<{ balances: MemberBalanceFull[]; totalExpenses: number }> {
  const members = await db
    .select({
      id: membersTable.id,
      name: membersTable.name,
      houseId: membersTable.houseId,
      houseName: housesTable.name,
      houseCrest: housesTable.crest,
      houseAccentColor: housesTable.accentColor,
      approvedAt: membersTable.approvedAt,
    })
    .from(membersTable)
    .leftJoin(housesTable, eq(membersTable.houseId, housesTable.id))
    .where(eq(membersTable.eventId, eventId));

  const approvedMembers = members.filter((m) => !!m.approvedAt);

  const expenses = await db.select().from(expensesTable).where(eq(expensesTable.eventId, eventId));

  const expenseIds = expenses.map((e) => e.id);
  let participants: Array<{ expenseId: number; memberId: number; shareAmount: number }> = [];
  if (expenseIds.length > 0) {
    participants = await db
      .select()
      .from(expenseParticipantsTable)
      .where(inArray(expenseParticipantsTable.expenseId, expenseIds));
  }

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  const balanceMap = new Map<
    number,
    { totalPaid: number; totalOwed: number; name: string; houseId: number | null; houseName: string | null; houseCrest: string | null; houseAccentColor: string | null }
  >();

  for (const m of approvedMembers) {
    balanceMap.set(m.id, {
      totalPaid: 0,
      totalOwed: 0,
      name: m.name,
      houseId: m.houseId ?? null,
      houseName: m.houseName ?? null,
      houseCrest: m.houseCrest ?? null,
      houseAccentColor: m.houseAccentColor ?? null,
    });
  }

  for (const expense of expenses) {
    const entry = balanceMap.get(expense.paidByMemberId);
    if (entry) entry.totalPaid += expense.amount;
  }

  for (const p of participants) {
    const entry = balanceMap.get(p.memberId);
    if (entry) entry.totalOwed += p.shareAmount;
  }

  const balances: MemberBalanceFull[] = Array.from(balanceMap.entries()).map(([memberId, data]) => ({
    memberId,
    memberName: data.name,
    houseId: data.houseId,
    houseName: data.houseName,
    houseCrest: data.houseCrest,
    houseAccentColor: data.houseAccentColor,
    totalPaid: data.totalPaid,
    totalOwed: data.totalOwed,
    netBalance: data.totalPaid - data.totalOwed,
  }));

  return { balances, totalExpenses };
}

/** Aggregate individual member balances into house-level balances */
function aggregateToHouseBalances(memberBalances: MemberBalanceFull[]): BalanceEntry[] {
  const houseMap = new Map<number, { name: string; net: number }>();
  const individuals: BalanceEntry[] = [];

  for (const mb of memberBalances) {
    if (mb.houseId !== null && mb.houseName !== null) {
      const existing = houseMap.get(mb.houseId) ?? { name: mb.houseName, net: 0 };
      existing.net += mb.netBalance;
      houseMap.set(mb.houseId, existing);
    } else {
      individuals.push({ memberId: mb.memberId, memberName: mb.memberName, net: mb.netBalance });
    }
  }

  const houseEntries: BalanceEntry[] = Array.from(houseMap.entries()).map(([houseId, h]) => ({
    memberId: houseId, // reuse memberId field to carry house ID
    memberName: h.name,
    net: h.net,
  }));

  return [...houseEntries, ...individuals];
}

// ── Routes ────────────────────────────────────────────────────────────────────

/** GET /events/:token/balances */
router.get("/events/:token/balances", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const { balances, totalExpenses } = await buildMemberBalances(event.id);

  res.json({
    totalExpenses,
    expenseCount: (await db.select().from(expensesTable).where(eq(expensesTable.eventId, event.id))).length,
    memberBalances: balances.map((b) => ({
      memberId: b.memberId,
      memberName: b.memberName,
      houseId: b.houseId ?? null,
      houseName: b.houseName ?? null,
      totalPaid: b.totalPaid,
      totalOwed: b.totalOwed,
      netBalance: b.netBalance,
    })),
  });
});

/**
 * GET /events/:token/settlements?mode=individual|house
 *
 * mode=individual (default) — individual member-level transfers
 * mode=house                — aggregate balances by house, settle at house level
 *
 * The event's settlementMode column sets the default; the query param overrides.
 */
router.get("/events/:token/settlements", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  // Mode: query param overrides event default
  const modeParam = typeof req.query.mode === "string" ? req.query.mode : null;
  const mode = (modeParam === "house" || modeParam === "individual")
    ? modeParam
    : (event.settlementMode === "house" ? "house" : "individual");

  const { balances } = await buildMemberBalances(event.id);

  let balanceEntries: BalanceEntry[];
  if (mode === "house") {
    balanceEntries = aggregateToHouseBalances(balances);
  } else {
    balanceEntries = balances.map((b) => ({
      memberId: b.memberId,
      memberName: b.memberName,
      net: b.netBalance,
    }));
  }

  const transfers: Transfer[] = computeSettlements(balanceEntries);

  // Flat array — same shape as before (backward compatible), mode info added per-entry
  res.json(transfers.map((t) => ({
    fromMemberId: t.fromMemberId,
    fromMemberName: t.fromMemberName,
    toMemberId: t.toMemberId,
    toMemberName: t.toMemberName,
    amount: t.amount,
    mode,
  })));
});

/** GET /events/:token/house-settlements — house-level settlement shorthand */
router.get("/events/:token/house-settlements", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }

  const { balances } = await buildMemberBalances(event.id);
  const houseEntries = aggregateToHouseBalances(balances);
  const transfers = computeSettlements(houseEntries);

  res.json(transfers.map((t) => ({
    fromMemberId: t.fromMemberId,
    fromMemberName: t.fromMemberName,
    toMemberId: t.toMemberId,
    toMemberName: t.toMemberName,
    amount: t.amount,
  })));
});

/** GET /events/:token/activity */
router.get("/events/:token/activity", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const activities = await db
    .select()
    .from(activityLogTable)
    .where(eq(activityLogTable.eventId, event.id))
    .orderBy(desc(activityLogTable.createdAt))
    .limit(100);

  res.json(
    activities.map((a) => ({
      id: a.id,
      eventId: a.eventId,
      memberName: a.memberName ?? null,
      action: a.action,
      metadata: (a.metadata as Record<string, unknown>) ?? {},
      createdAt: a.createdAt,
    })),
  );
});

export default router;
