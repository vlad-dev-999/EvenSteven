import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  eventsTable,
  membersTable,
  expensesTable,
  expenseParticipantsTable,
  activityLogTable,
} from "@workspace/db";
import {
  GetBalancesResponse,
  GetSettlementsResponse,
  ListActivityResponse,
} from "@workspace/api-zod";
import { computeSettlements } from "../lib/settlement";

const router: IRouter = Router();

/** GET /events/:token/balances */
router.get("/events/:token/balances", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const members = await db
    .select()
    .from(membersTable)
    .where(eq(membersTable.eventId, event.id));

  const approvedMembers = members.filter((m) => !!m.approvedAt);

  const expenses = await db
    .select()
    .from(expensesTable)
    .where(eq(expensesTable.eventId, event.id));

  const allParticipants = expenses.length > 0
    ? await db
        .select()
        .from(expenseParticipantsTable)
        .where(
          eq(
            expenseParticipantsTable.expenseId,
            expenseParticipantsTable.expenseId,
          ),
        )
    : [];

  // Re-query participants for all expenses in event
  const expenseIds = expenses.map((e) => e.id);

  let participants: Array<{ expenseId: number; memberId: number; shareAmount: number }> = [];
  if (expenseIds.length > 0) {
    const { inArray } = await import("drizzle-orm");
    participants = await db
      .select()
      .from(expenseParticipantsTable)
      .where(inArray(expenseParticipantsTable.expenseId, expenseIds));
  }

  // Build balance map: memberId -> { totalPaid, totalOwed }
  const balanceMap = new Map<number, { totalPaid: number; totalOwed: number; name: string }>();

  for (const member of approvedMembers) {
    balanceMap.set(member.id, { totalPaid: 0, totalOwed: 0, name: member.name });
  }

  for (const expense of expenses) {
    const entry = balanceMap.get(expense.paidByMemberId);
    if (entry) {
      entry.totalPaid += expense.amount;
    }
  }

  for (const participant of participants) {
    const entry = balanceMap.get(participant.memberId);
    if (entry) {
      entry.totalOwed += participant.shareAmount;
    }
  }

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  const memberBalances = Array.from(balanceMap.entries()).map(([memberId, data]) => ({
    memberId,
    memberName: data.name,
    totalPaid: data.totalPaid,
    totalOwed: data.totalOwed,
    netBalance: data.totalPaid - data.totalOwed,
  }));

  res.json(
    GetBalancesResponse.parse({
      totalExpenses,
      expenseCount: expenses.length,
      memberBalances,
    }),
  );
});

/** GET /events/:token/settlements */
router.get("/events/:token/settlements", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const members = await db
    .select()
    .from(membersTable)
    .where(eq(membersTable.eventId, event.id));

  const approvedMembers = members.filter((m) => !!m.approvedAt);

  const expenses = await db
    .select()
    .from(expensesTable)
    .where(eq(expensesTable.eventId, event.id));

  const expenseIds = expenses.map((e) => e.id);
  let participants: Array<{ expenseId: number; memberId: number; shareAmount: number }> = [];
  if (expenseIds.length > 0) {
    const { inArray } = await import("drizzle-orm");
    participants = await db
      .select()
      .from(expenseParticipantsTable)
      .where(inArray(expenseParticipantsTable.expenseId, expenseIds));
  }

  // Build net balance per member
  const balanceMap = new Map<number, { net: number; name: string }>();
  for (const member of approvedMembers) {
    balanceMap.set(member.id, { net: 0, name: member.name });
  }

  for (const expense of expenses) {
    const entry = balanceMap.get(expense.paidByMemberId);
    if (entry) entry.net += expense.amount;
  }

  for (const participant of participants) {
    const entry = balanceMap.get(participant.memberId);
    if (entry) entry.net -= participant.shareAmount;
  }

  const balanceEntries = Array.from(balanceMap.entries()).map(([memberId, data]) => ({
    memberId,
    memberName: data.name,
    net: data.net,
  }));

  const settlements = computeSettlements(balanceEntries);

  res.json(GetSettlementsResponse.parse(settlements));
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
    ListActivityResponse.parse(
      activities.map((a) => ({
        id: a.id,
        eventId: a.eventId,
        memberName: a.memberName ?? null,
        action: a.action,
        metadata: (a.metadata as Record<string, unknown>) ?? {},
        createdAt: a.createdAt,
      })),
    ),
  );
});

export default router;
