import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  eventsTable,
  membersTable,
  familiesTable,
  housesTable,
  expensesTable,
  expenseParticipantsTable,
  peopleTable,
} from "@workspace/db";
import { logActivity } from "../lib/activity";
import { requireHost, getMemberIdFromHeader } from "../lib/host-auth";

const router: IRouter = Router();

/** GET /events/:token/members */
router.get("/events/:token/members", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const members = await db
    .select({
      id: membersTable.id,
      eventId: membersTable.eventId,
      name: membersTable.name,
      familyId: membersTable.familyId,
      familyName: familiesTable.name,
      houseId: membersTable.houseId,
      houseName: housesTable.name,
      houseCrest: housesTable.crest,
      houseAccentColor: housesTable.accentColor,
      isHost: membersTable.isHost,
      approvedAt: membersTable.approvedAt,
      claimed: membersTable.claimedAt,
      createdAt: membersTable.createdAt,
    })
    .from(membersTable)
    .leftJoin(familiesTable, eq(membersTable.familyId, familiesTable.id))
    .leftJoin(housesTable, eq(membersTable.houseId, housesTable.id))
    .where(eq(membersTable.eventId, event.id))
    .orderBy(membersTable.createdAt);

  res.json(
    members.map((m) => ({
      id: m.id,
      eventId: m.eventId,
      name: m.name,
      familyId: m.familyId ?? null,
      familyName: m.familyName ?? null,
      houseId: m.houseId ?? null,
      houseName: m.houseName ?? null,
      houseCrest: m.houseCrest ?? null,
      houseAccentColor: m.houseAccentColor ?? null,
      isHost: m.isHost,
      approved: !!m.approvedAt,
      claimed: !!m.claimed,
      createdAt: m.createdAt,
    })),
  );
});

/**
 * POST /events/:token/members — add a directory person as an attendee (host only)
 */
router.post("/events/:token/members", requireHost, async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const { personId } = req.body ?? {};

  if (typeof personId !== "number") {
    res.status(400).json({ error: "personId is required" });
    return;
  }

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const [person] = await db.select().from(peopleTable).where(eq(peopleTable.id, personId));
  if (!person || !person.active) {
    res.status(404).json({ error: "Person not found or inactive" });
    return;
  }

  // Prevent duplicates — check if this person is already a member of this event
  const [existing] = await db
    .select()
    .from(membersTable)
    .where(and(eq(membersTable.eventId, event.id), eq(membersTable.personId, personId)));

  if (existing) {
    res.status(400).json({ error: "Person is already an attendee of this event" });
    return;
  }

  const [newMember] = await db
    .insert(membersTable)
    .values({
      eventId: event.id,
      name: person.name,
      personId: person.id,
      houseId: person.houseId,
      isHost: false,
      approvedAt: new Date(),
    })
    .returning();

  await logActivity(event.id, "attendee_added", { memberName: person.name });

  // Return the shaped member (with house info via join)
  const [shaped] = await db
    .select({
      id: membersTable.id,
      eventId: membersTable.eventId,
      name: membersTable.name,
      familyId: membersTable.familyId,
      familyName: familiesTable.name,
      houseId: membersTable.houseId,
      houseName: housesTable.name,
      houseCrest: housesTable.crest,
      houseAccentColor: housesTable.accentColor,
      isHost: membersTable.isHost,
      approvedAt: membersTable.approvedAt,
      claimed: membersTable.claimedAt,
      createdAt: membersTable.createdAt,
    })
    .from(membersTable)
    .leftJoin(familiesTable, eq(membersTable.familyId, familiesTable.id))
    .leftJoin(housesTable, eq(membersTable.houseId, housesTable.id))
    .where(eq(membersTable.id, newMember.id));

  res.status(201).json({
    id: shaped.id,
    eventId: shaped.eventId,
    name: shaped.name,
    familyId: shaped.familyId ?? null,
    familyName: shaped.familyName ?? null,
    houseId: shaped.houseId ?? null,
    houseName: shaped.houseName ?? null,
    houseCrest: shaped.houseCrest ?? null,
    houseAccentColor: shaped.houseAccentColor ?? null,
    isHost: shaped.isHost,
    approved: !!shaped.approvedAt,
    claimed: !!shaped.claimed,
    createdAt: shaped.createdAt,
  });
});

/**
 * DELETE /events/:token/members/:memberId
 *
 * Two authorised callers:
 *   1. Host (x-host-token) — can remove any non-host member.
 *   2. Member themselves (x-member-id == memberId) — can leave only if net
 *      balance is zero (no outstanding settlement).
 */
router.delete("/events/:token/members/:memberId", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const memberIdRaw = Array.isArray(req.params.memberId) ? req.params.memberId[0] : req.params.memberId;
  const memberId = parseInt(memberIdRaw, 10);

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const [member] = await db
    .select()
    .from(membersTable)
    .where(and(eq(membersTable.id, memberId), eq(membersTable.eventId, event.id)));

  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  if (member.isHost) {
    res.status(400).json({ error: "Cannot remove the host" });
    return;
  }

  const hostTokenHeader = req.headers["x-host-token"];
  const { validateHostToken } = await import("../lib/host-auth");
  const callerIsHost = typeof hostTokenHeader === "string" && validateHostToken(hostTokenHeader);

  const callerMemberId = getMemberIdFromHeader(req);
  const callerIsSelf = callerMemberId !== null && callerMemberId === memberId;

  if (!callerIsHost && !callerIsSelf) {
    res.status(401).json({
      error: "Not authorised. Provide x-host-token (host removal) or x-member-id matching this member (self-leave).",
    });
    return;
  }

  // Self-leave: check for outstanding settlement balance
  if (callerIsSelf && !callerIsHost) {
    const netBalance = await computeMemberNetBalance(event.id, memberId);
    if (Math.abs(netBalance) > 1) {
      // > 1 paise to handle float rounding
      res.status(400).json({
        error: "You have an outstanding balance and cannot leave until it is settled.",
        netBalance,
      });
      return;
    }
  }

  await db.delete(membersTable).where(eq(membersTable.id, memberId));
  await logActivity(event.id, "member_removed", { memberName: member.name });

  res.sendStatus(204);
});

/** Compute a member's net balance (positive = owed money, negative = owes money) */
async function computeMemberNetBalance(eventId: number, memberId: number): Promise<number> {
  const expenses = await db
    .select()
    .from(expensesTable)
    .where(eq(expensesTable.eventId, eventId));

  const expenseIds = expenses.map((e) => e.id);

  let participants: Array<{ expenseId: number; memberId: number; shareAmount: number }> = [];
  if (expenseIds.length > 0) {
    participants = await db
      .select()
      .from(expenseParticipantsTable)
      .where(inArray(expenseParticipantsTable.expenseId, expenseIds));
  }

  let totalPaid = 0;
  let totalOwed = 0;

  for (const expense of expenses) {
    if (expense.paidByMemberId === memberId) totalPaid += expense.amount;
  }
  for (const p of participants) {
    if (p.memberId === memberId) totalOwed += p.shareAmount;
  }

  return totalPaid - totalOwed;
}

export default router;
