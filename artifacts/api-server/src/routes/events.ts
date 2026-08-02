import { Router, type IRouter } from "express";
import { eq, count, sum } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  eventsTable,
  membersTable,
  expensesTable,
} from "@workspace/db";
import {
  CreateEventBody,
  CreateEventResponse,
  GetEventResponse,
  FreezeEventResponse,
  UnfreezeEventResponse,
  SetSessionBody,
  SetSessionResponse,
  GetSessionResponse,
  GetEventSummaryResponse,
} from "@workspace/api-zod";
import { generateToken, generatePin } from "../lib/token";
import { logActivity } from "../lib/activity";

const router: IRouter = Router();

/** POST /events — create a new event */
router.post("/events", async (req, res): Promise<void> => {
  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, hostName } = parsed.data;
  const token = generateToken();
  const pin = generatePin();

  const [event] = await db
    .insert(eventsTable)
    .values({ name, token, pin })
    .returning();

  const [hostMember] = await db
    .insert(membersTable)
    .values({
      eventId: event.id,
      name: hostName,
      isHost: true,
      approvedAt: new Date(),
    })
    .returning();

  await logActivity(event.id, "event_created", { eventName: name, hostName }, hostMember.id, hostMember.name);

  res.status(201).json(
    CreateEventResponse.parse({
      event: {
        id: event.id,
        name: event.name,
        token: event.token,
        frozen: event.frozen,
        memberCount: 1,
        totalExpenses: 0,
        createdAt: event.createdAt,
      },
      pin: event.pin,
      hostMember: {
        id: hostMember.id,
        eventId: hostMember.eventId,
        name: hostMember.name,
        familyId: null,
        familyName: null,
        isHost: true,
        approved: true,
        createdAt: hostMember.createdAt,
      },
    }),
  );
});

/** GET /events/:token — get event details */
router.get("/events/:token", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.token, token));

  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const [memberCountResult] = await db
    .select({ count: count() })
    .from(membersTable)
    .where(eq(membersTable.eventId, event.id));

  const [expenseSumResult] = await db
    .select({ total: sum(expensesTable.amount) })
    .from(expensesTable)
    .where(eq(expensesTable.eventId, event.id));

  res.json(
    GetEventResponse.parse({
      id: event.id,
      name: event.name,
      token: event.token,
      frozen: event.frozen,
      memberCount: Number(memberCountResult?.count ?? 0),
      totalExpenses: Number(expenseSumResult?.total ?? 0),
      createdAt: event.createdAt,
    }),
  );
});

/** POST /events/:token/session — authenticate as a member */
router.post("/events/:token/session", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.token, token));

  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const parsed = SetSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { memberId, pin } = parsed.data;

  if (pin !== event.pin) {
    res.status(400).json({ error: "Invalid PIN" });
    return;
  }

  const [member] = await db
    .select()
    .from(membersTable)
    .where(eq(membersTable.id, memberId));

  if (!member || member.eventId !== event.id || !member.approvedAt) {
    res.status(400).json({ error: "Member not found or not approved" });
    return;
  }

  res.json(
    SetSessionResponse.parse({
      id: member.id,
      eventId: member.eventId,
      name: member.name,
      familyId: member.familyId ?? null,
      familyName: null,
      isHost: member.isHost,
      approved: !!member.approvedAt,
      createdAt: member.createdAt,
    }),
  );
});

/** GET /events/:token/session — get current session (uses member cookie set by client) */
router.get("/events/:token/session", async (req, res): Promise<void> => {
  // Session is managed client-side via localStorage. Server just confirms member exists.
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const memberIdHeader = req.headers["x-member-id"];
  const memberId = memberIdHeader ? parseInt(Array.isArray(memberIdHeader) ? memberIdHeader[0] : memberIdHeader, 10) : null;

  if (!memberId || isNaN(memberId)) {
    res.json(GetSessionResponse.parse({ member: null, authenticated: false }));
    return;
  }

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.json(GetSessionResponse.parse({ member: null, authenticated: false }));
    return;
  }

  const [member] = await db
    .select()
    .from(membersTable)
    .where(eq(membersTable.id, memberId));

  if (!member || member.eventId !== event.id || !member.approvedAt) {
    res.json(GetSessionResponse.parse({ member: null, authenticated: false }));
    return;
  }

  res.json(
    GetSessionResponse.parse({
      member: { id: member.id, name: member.name, isHost: member.isHost },
      authenticated: true,
    }),
  );
});

/** POST /events/:token/freeze */
router.post("/events/:token/freeze", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const [updated] = await db
    .update(eventsTable)
    .set({ frozen: true })
    .where(eq(eventsTable.id, event.id))
    .returning();

  await logActivity(event.id, "event_frozen", {});

  const [memberCountResult] = await db
    .select({ count: count() })
    .from(membersTable)
    .where(eq(membersTable.eventId, event.id));

  const [expenseSumResult] = await db
    .select({ total: sum(expensesTable.amount) })
    .from(expensesTable)
    .where(eq(expensesTable.eventId, event.id));

  res.json(
    FreezeEventResponse.parse({
      id: updated.id,
      name: updated.name,
      token: updated.token,
      frozen: updated.frozen,
      memberCount: Number(memberCountResult?.count ?? 0),
      totalExpenses: Number(expenseSumResult?.total ?? 0),
      createdAt: updated.createdAt,
    }),
  );
});

/** POST /events/:token/unfreeze */
router.post("/events/:token/unfreeze", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const [updated] = await db
    .update(eventsTable)
    .set({ frozen: false })
    .where(eq(eventsTable.id, event.id))
    .returning();

  await logActivity(event.id, "event_unfrozen", {});

  const [memberCountResult] = await db
    .select({ count: count() })
    .from(membersTable)
    .where(eq(membersTable.eventId, event.id));

  const [expenseSumResult] = await db
    .select({ total: sum(expensesTable.amount) })
    .from(expensesTable)
    .where(eq(expensesTable.eventId, event.id));

  res.json(
    UnfreezeEventResponse.parse({
      id: updated.id,
      name: updated.name,
      token: updated.token,
      frozen: updated.frozen,
      memberCount: Number(memberCountResult?.count ?? 0),
      totalExpenses: Number(expenseSumResult?.total ?? 0),
      createdAt: updated.createdAt,
    }),
  );
});

/** GET /events/:token/summary */
router.get("/events/:token/summary", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const expenses = await db
    .select()
    .from(expensesTable)
    .where(eq(expensesTable.eventId, event.id));

  const members = await db
    .select()
    .from(membersTable)
    .where(eq(membersTable.eventId, event.id));

  // Category breakdown
  const categoryMap = new Map<string, { total: number; count: number }>();
  for (const expense of expenses) {
    const existing = categoryMap.get(expense.category) ?? { total: 0, count: 0 };
    categoryMap.set(expense.category, {
      total: existing.total + expense.amount,
      count: existing.count + 1,
    });
  }
  const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    total: data.total,
    count: data.count,
  }));

  // Top payers
  const payerMap = new Map<number, { memberId: number; memberName: string; totalPaid: number }>();
  for (const expense of expenses) {
    const member = members.find((m) => m.id === expense.paidByMemberId);
    if (!member) continue;
    const existing = payerMap.get(expense.paidByMemberId) ?? {
      memberId: expense.paidByMemberId,
      memberName: member.name,
      totalPaid: 0,
    };
    payerMap.set(expense.paidByMemberId, {
      ...existing,
      totalPaid: existing.totalPaid + expense.amount,
    });
  }
  const topPayers = Array.from(payerMap.values())
    .sort((a, b) => b.totalPaid - a.totalPaid)
    .slice(0, 5);

  const { familiesTable } = await import("@workspace/db");
  const familyCountResult = await db
    .select({ count: count() })
    .from(familiesTable)
    .where(eq(familiesTable.eventId, event.id));

  res.json(
    GetEventSummaryResponse.parse({
      totalExpenses: expenses.reduce((s, e) => s + e.amount, 0),
      expenseCount: expenses.length,
      memberCount: members.filter((m) => !!m.approvedAt).length,
      familyCount: Number(familyCountResult[0]?.count ?? 0),
      categoryBreakdown,
      topPayers,
    }),
  );
});

export default router;
