import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  eventsTable,
  expensesTable,
  expenseParticipantsTable,
  membersTable,
} from "@workspace/db";

/** Upgrade the event's settlementMode to 'house' when a families-split expense exists. */
async function maybeUpgradeSettlementMode(eventId: number, splitType: string) {
  if (splitType !== "families") return;
  await db
    .update(eventsTable)
    .set({ settlementMode: "house" })
    .where(and(eq(eventsTable.id, eventId), eq(eventsTable.settlementMode, "individual")));
}
import {
  CreateExpenseBody,
  CreateExpenseResponse,
  UpdateExpenseBody,
  UpdateExpenseResponse,
  ListExpensesResponse,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activity";

const router: IRouter = Router();

/**
 * Compute expense participants from split type.
 * Returns array of { memberId, shareAmount }
 */
async function computeParticipants(
  eventId: number,
  amount: number,
  splitType: "everyone" | "families" | "members",
  participantIds: number[] | undefined,
  houseIds: number[] | undefined,
): Promise<{ memberId: number; shareAmount: number }[]> {
  const approvedMembers = await db
    .select()
    .from(membersTable)
    .where(and(eq(membersTable.eventId, eventId)));

  const approved = approvedMembers.filter((m) => !!m.approvedAt);

  let targetMemberIds: number[] = [];

  if (splitType === "everyone") {
    targetMemberIds = approved.map((m) => m.id);
  } else if (splitType === "families" && houseIds && houseIds.length > 0) {
    // Group by directory-level houseId (same mechanism used by house settlement)
    const houseMembers = approved.filter(
      (m) => m.houseId !== null && houseIds.includes(m.houseId),
    );
    targetMemberIds = houseMembers.map((m) => m.id);
  } else if (splitType === "members" && participantIds && participantIds.length > 0) {
    targetMemberIds = participantIds.filter((id) => approved.some((m) => m.id === id));
  }

  if (targetMemberIds.length === 0) {
    targetMemberIds = approved.map((m) => m.id);
  }

  const share = Math.floor(amount / targetMemberIds.length);
  const remainder = amount - share * targetMemberIds.length;

  return targetMemberIds.map((memberId, index) => ({
    memberId,
    shareAmount: share + (index === 0 ? remainder : 0),
  }));
}

/** Build expense response shape */
async function buildExpenseResponse(expenseId: number, eventId: number) {
  const [expense] = await db
    .select()
    .from(expensesTable)
    .where(eq(expensesTable.id, expenseId));

  if (!expense) return null;

  const participants = await db
    .select()
    .from(expenseParticipantsTable)
    .where(eq(expenseParticipantsTable.expenseId, expenseId));

  const memberIds = participants.map((p) => p.memberId);
  const members =
    memberIds.length > 0
      ? await db
          .select()
          .from(membersTable)
          .where(inArray(membersTable.id, memberIds))
      : [];

  const [paidByMember] = await db
    .select()
    .from(membersTable)
    .where(eq(membersTable.id, expense.paidByMemberId));

  return {
    id: expense.id,
    eventId: expense.eventId,
    paidByMemberId: expense.paidByMemberId,
    paidByMemberName: paidByMember?.name ?? "Unknown",
    category: expense.category,
    amount: expense.amount,
    description: expense.description ?? null,
    splitType: expense.splitType,
    participantIds: participants.map((p) => p.memberId),
    participants: participants.map((p) => ({
      memberId: p.memberId,
      memberName: members.find((m) => m.id === p.memberId)?.name ?? "Unknown",
      shareAmount: p.shareAmount,
    })),
    createdByMemberId: expense.createdByMemberId,
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
  };
}

/** GET /events/:token/expenses */
router.get("/events/:token/expenses", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const expenses = await db
    .select()
    .from(expensesTable)
    .where(eq(expensesTable.eventId, event.id))
    .orderBy(expensesTable.createdAt);

  const results = await Promise.all(
    expenses.map((e) => buildExpenseResponse(e.id, event.id)),
  );

  res.json(ListExpensesResponse.parse(results.filter(Boolean)));
});

/** POST /events/:token/expenses */
router.post("/events/:token/expenses", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  if (event.frozen) {
    res.status(403).json({ error: "Event is frozen" });
    return;
  }

  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { paidByMemberId, category, amount, description, splitType, participantIds, houseIds } = parsed.data;

  const createdByHeader = req.headers["x-member-id"];
  const createdByMemberId = createdByHeader
    ? parseInt(Array.isArray(createdByHeader) ? createdByHeader[0] : createdByHeader, 10)
    : paidByMemberId;

  const [expense] = await db
    .insert(expensesTable)
    .values({
      eventId: event.id,
      paidByMemberId,
      category: category as "tickets" | "food" | "drinks" | "snacks" | "fuel" | "other",
      amount,
      description: description ?? null,
      splitType: splitType as "everyone" | "families" | "members",
      createdByMemberId,
    })
    .returning();

  const participants = await computeParticipants(
    event.id,
    amount,
    splitType as "everyone" | "families" | "members",
    participantIds ?? undefined,
    houseIds ?? undefined,
  );

  if (participants.length > 0) {
    await db.insert(expenseParticipantsTable).values(
      participants.map((p) => ({
        expenseId: expense.id,
        memberId: p.memberId,
        shareAmount: p.shareAmount,
      })),
    );
  }

  const [paidByMember] = await db.select().from(membersTable).where(eq(membersTable.id, paidByMemberId));
  await logActivity(
    event.id,
    "expense_added",
    { category, amount, description: description ?? "" },
    paidByMemberId,
    paidByMember?.name,
  );

  // Auto-upgrade event settlementMode to 'house' when any expense uses families split
  await maybeUpgradeSettlementMode(event.id, splitType);

  const result = await buildExpenseResponse(expense.id, event.id);
  res.status(201).json(CreateExpenseResponse.parse(result));
});

/** PATCH /events/:token/expenses/:expenseId */
router.patch("/events/:token/expenses/:expenseId", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const expenseIdRaw = Array.isArray(req.params.expenseId) ? req.params.expenseId[0] : req.params.expenseId;
  const expenseId = parseInt(expenseIdRaw, 10);

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  if (event.frozen) {
    res.status(403).json({ error: "Event is frozen" });
    return;
  }

  const parsed = UpdateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(expensesTable)
    .where(and(eq(expensesTable.id, expenseId), eq(expensesTable.eventId, event.id)));

  if (!existing) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }

  const updateData: Partial<typeof existing> = { updatedAt: new Date() };
  if (parsed.data.paidByMemberId !== undefined) updateData.paidByMemberId = parsed.data.paidByMemberId;
  if (parsed.data.category !== undefined) updateData.category = parsed.data.category as typeof existing.category;
  if (parsed.data.amount !== undefined) updateData.amount = parsed.data.amount;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description ?? null;
  if (parsed.data.splitType !== undefined) updateData.splitType = parsed.data.splitType as typeof existing.splitType;

  await db.update(expensesTable).set(updateData).where(eq(expensesTable.id, expenseId));

  // Recompute participants if amount or splitType changed
  if (parsed.data.amount !== undefined || parsed.data.splitType !== undefined || parsed.data.participantIds !== undefined) {
    await db.delete(expenseParticipantsTable).where(eq(expenseParticipantsTable.expenseId, expenseId));
    const newAmount = parsed.data.amount ?? existing.amount;
    const newSplitType = (parsed.data.splitType ?? existing.splitType) as "everyone" | "families" | "members";
    const participants = await computeParticipants(
      event.id,
      newAmount,
      newSplitType,
      parsed.data.participantIds ?? undefined,
      parsed.data.houseIds ?? undefined,
    );
    if (participants.length > 0) {
      await db.insert(expenseParticipantsTable).values(
        participants.map((p) => ({ expenseId, memberId: p.memberId, shareAmount: p.shareAmount })),
      );
    }
  }

  const [updaterMember] = await db
    .select()
    .from(membersTable)
    .where(eq(membersTable.id, existing.createdByMemberId));

  await logActivity(
    event.id,
    "expense_edited",
    {
      oldAmount: existing.amount,
      newAmount: parsed.data.amount ?? existing.amount,
      category: existing.category,
    },
    existing.createdByMemberId,
    updaterMember?.name,
  );

  // Auto-upgrade event settlementMode to 'house' when any expense uses families split
  const effectiveSplitType = parsed.data.splitType ?? existing.splitType;
  await maybeUpgradeSettlementMode(event.id, effectiveSplitType);

  const result = await buildExpenseResponse(expenseId, event.id);
  res.json(UpdateExpenseResponse.parse(result));
});

/** DELETE /events/:token/expenses/:expenseId */
router.delete("/events/:token/expenses/:expenseId", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const expenseIdRaw = Array.isArray(req.params.expenseId) ? req.params.expenseId[0] : req.params.expenseId;
  const expenseId = parseInt(expenseIdRaw, 10);

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  if (event.frozen) {
    res.status(403).json({ error: "Event is frozen" });
    return;
  }

  const [expense] = await db
    .select()
    .from(expensesTable)
    .where(and(eq(expensesTable.id, expenseId), eq(expensesTable.eventId, event.id)));

  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }

  await db.delete(expensesTable).where(eq(expensesTable.id, expenseId));

  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, expense.paidByMemberId));
  await logActivity(
    event.id,
    "expense_deleted",
    { category: expense.category, amount: expense.amount },
    expense.paidByMemberId,
    member?.name,
  );

  res.sendStatus(204);
});

export default router;
