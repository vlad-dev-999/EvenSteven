import { Router, type IRouter } from "express";
import { eq, count, sum, desc, inArray, and } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  eventsTable,
  membersTable,
  expensesTable,
  familiesTable,
  peopleTable,
  housesTable,
} from "@workspace/db";
import { generateToken, generatePin } from "../lib/token";
import { logActivity } from "../lib/activity";
import { requireHost } from "../lib/host-auth";

import { pinVerifyLimiter } from "../lib/rate-limiters";
import { verifyPin } from "../lib/pin-hash";

const router: IRouter = Router();

// ── Helper: shape a full event response ──────────────────────────────────────

function formatEvent(
  event: typeof eventsTable.$inferSelect,
  memberCount: number,
  totalExpenses: number,
  hostMemberName: string | null = null,
) {
  return {
    id: event.id,
    name: event.name,
    token: event.token,
    frozen: event.frozen,
    archived: event.archived,
    memberCount,
    totalExpenses,
    createdAt: event.createdAt,
    // Event details
    coverImage: event.coverImage ?? null,
    description: event.description ?? null,
    venue: event.venue ?? null,
    address: event.address ?? null,
    mapsLink: event.mapsLink ?? null,
    startDate: event.startDate ?? null,
    endDate: event.endDate ?? null,
    itinerary: event.itinerary ?? null,
    settlementMode: event.settlementMode,
    // Banner and tonight's note
    bannerImage: event.bannerImage ?? null,
    tonightNoteTitle: event.tonightNoteTitle ?? null,
    tonightNoteBody: event.tonightNoteBody ?? null,
    hostMemberName,
  };
}

/** Query the host member name for an event. */
async function getHostMemberName(eventId: number): Promise<string | null> {
  const [hostMember] = await db
    .select({ name: membersTable.name })
    .from(membersTable)
    .where(and(eq(membersTable.eventId, eventId), eq(membersTable.isHost, true)));
  return hostMember?.name ?? null;
}

// ── Routes ───────────────────────────────────────────────────────────────────

/** GET /events — list all events (host only) */
router.get("/events", requireHost, async (req, res): Promise<void> => {
  const events = await db.select().from(eventsTable).orderBy(desc(eventsTable.createdAt));

  const result = await Promise.all(
    events.map(async (event) => {
      const [memberCountResult] = await db
        .select({ count: count() })
        .from(membersTable)
        .where(eq(membersTable.eventId, event.id));

      const [expenseSumResult] = await db
        .select({ total: sum(expensesTable.amount) })
        .from(expensesTable)
        .where(eq(expensesTable.eventId, event.id));

      return formatEvent(
        event,
        Number(memberCountResult?.count ?? 0),
        Number(expenseSumResult?.total ?? 0),
      );
    }),
  );

  res.json(result);
});

/** POST /events — create a new event (host OR authenticated directory member) */
router.post("/events", async (req, res): Promise<void> => {
  // Accept either host token or a valid person id (directory member)
  const hostTokenHeader = req.headers["x-host-token"];
  const { validateHostToken } = await import("../lib/host-auth");
  const callerIsHost =
    typeof hostTokenHeader === "string" && validateHostToken(hostTokenHeader);

  // Member-auth: x-person-id header
  const personIdHeader = req.headers["x-person-id"];
  const callerPersonId = personIdHeader
    ? parseInt(Array.isArray(personIdHeader) ? personIdHeader[0] : personIdHeader, 10)
    : null;

  if (!callerIsHost && (!callerPersonId || !Number.isFinite(callerPersonId))) {
    res.status(401).json({ error: "Authentication required. Provide x-host-token or x-person-id." });
    return;
  }

  const { name, hostPersonId: bodyHostPersonId, attendeePersonIds } = req.body ?? {};

  // When a member creates an event, they become the host
  const hostPersonId: number = callerIsHost
    ? bodyHostPersonId
    : (callerPersonId as number);

  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name is required" });
    return;
  }

  if (typeof hostPersonId !== "number") {
    res.status(400).json({ error: "hostPersonId is required" });
    return;
  }


  // Validate host person exists and is active
  const [hostPerson] = await db
    .select()
    .from(peopleTable)
    .where(eq(peopleTable.id, hostPersonId));

  if (!hostPerson || !hostPerson.active) {
    res.status(400).json({ error: "Host person not found or inactive" });
    return;
  }

  const token = generateToken();
  const pin = generatePin();

  const [event] = await db
    .insert(eventsTable)
    .values({ name: name.trim(), token, pin })
    .returning();

  // Create host member — approved and claimed so they appear as Joined immediately
  await db.insert(membersTable).values({
    eventId: event.id,
    name: hostPerson.name,
    personId: hostPerson.id,
    houseId: hostPerson.houseId,
    isHost: true,
    approvedAt: new Date(),
    claimedAt: new Date(),
  });

  // Seed additional attendees from directory (excluding host who's already added)
  const additionalIds: number[] = Array.isArray(attendeePersonIds)
    ? attendeePersonIds.filter((id: unknown) => typeof id === "number" && id !== hostPersonId)
    : [];

  if (additionalIds.length > 0) {
    const persons = await db
      .select()
      .from(peopleTable)
      .where(inArray(peopleTable.id, additionalIds));

    if (persons.length > 0) {
      await db.insert(membersTable).values(
        persons
          .filter((p) => p.active)
          .map((p) => ({
            eventId: event.id,
            name: p.name,
            personId: p.id,
            houseId: p.houseId,
            isHost: false,
            approvedAt: new Date(),
          })),
      );
    }
  }

  await logActivity(event.id, "event_created", { eventName: event.name });

  res.status(201).json({
    event: formatEvent(event, 1 + additionalIds.length, 0),
    pin,
  });
});

/** DELETE /events/:token — archive or hard-delete (host only) */
router.delete("/events/:token", requireHost, async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const mode = req.query.mode; // ?mode=hard for permanent delete
  if (mode === "hard") {
    await db.delete(eventsTable).where(eq(eventsTable.token, token));
    res.sendStatus(204);
  } else {
    // Default: soft archive
    const [updated] = await db
      .update(eventsTable)
      .set({ archived: true, frozen: true })
      .where(eq(eventsTable.token, token))
      .returning();

    const [memberCountResult] = await db
      .select({ count: count() })
      .from(membersTable)
      .where(eq(membersTable.eventId, updated.id));

    const [expenseSumResult] = await db
      .select({ total: sum(expensesTable.amount) })
      .from(expensesTable)
      .where(eq(expensesTable.eventId, updated.id));

    res.json(formatEvent(
      updated,
      Number(memberCountResult?.count ?? 0),
      Number(expenseSumResult?.total ?? 0),
    ));
  }
});

/** GET /events/:token — get a single event */
router.get("/events/:token", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
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

  const hostName = await getHostMemberName(event.id);

  res.json(
    formatEvent(
      event,
      Number(memberCountResult?.count ?? 0),
      Number(expenseSumResult?.total ?? 0),
      hostName,
    ),
  );
});

/** PATCH /events/:token — update event details (host only) */
router.patch("/events/:token", requireHost, async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const {
    description,
    venue,
    address,
    mapsLink,
    startDate,
    endDate,
    itinerary,
    settlementMode,
    coverImage,
    bannerImage,
    frozen,
  } = req.body ?? {};

  const updates: Partial<typeof eventsTable.$inferInsert> = {};
  if (description !== undefined) updates.description = description;
  if (venue !== undefined) updates.venue = venue;
  if (address !== undefined) updates.address = address;
  if (mapsLink !== undefined) updates.mapsLink = mapsLink;
  if (startDate !== undefined) updates.startDate = startDate ? new Date(startDate) : null;
  if (endDate !== undefined) updates.endDate = endDate ? new Date(endDate) : null;
  if (itinerary !== undefined) updates.itinerary = itinerary;
  if (settlementMode !== undefined && ["individual", "house"].includes(settlementMode)) {
    updates.settlementMode = settlementMode;
  }
  if (coverImage !== undefined) updates.coverImage = coverImage;
  if (bannerImage !== undefined) updates.bannerImage = bannerImage;
  if (typeof frozen === "boolean") updates.frozen = frozen;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  const [updated] = await db
    .update(eventsTable)
    .set(updates)
    .where(eq(eventsTable.token, token))
    .returning();

  const [memberCountResult] = await db
    .select({ count: count() })
    .from(membersTable)
    .where(eq(membersTable.eventId, updated.id));

  const [expenseSumResult] = await db
    .select({ total: sum(expensesTable.amount) })
    .from(expensesTable)
    .where(eq(expensesTable.eventId, updated.id));

  res.json(formatEvent(
    updated,
    Number(memberCountResult?.count ?? 0),
    Number(expenseSumResult?.total ?? 0),
  ));
});

/** POST /events/:token/freeze — freeze an event (host only) */
router.post("/events/:token/freeze", requireHost, async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const [updated] = await db
    .update(eventsTable)
    .set({ frozen: true })
    .where(eq(eventsTable.token, token))
    .returning();

  const [memberCountResult] = await db
    .select({ count: count() })
    .from(membersTable)
    .where(eq(membersTable.eventId, updated.id));

  const [expenseSumResult] = await db
    .select({ total: sum(expensesTable.amount) })
    .from(expensesTable)
    .where(eq(expensesTable.eventId, updated.id));

  await logActivity(updated.id, "event_frozen", {});
  const hostName = await getHostMemberName(updated.id);
  res.json(formatEvent(updated, Number(memberCountResult?.count ?? 0), Number(expenseSumResult?.total ?? 0), hostName));
});

/** POST /events/:token/unfreeze — unfreeze an event (host only) */
router.post("/events/:token/unfreeze", requireHost, async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const [updated] = await db
    .update(eventsTable)
    .set({ frozen: false })
    .where(eq(eventsTable.token, token))
    .returning();

  const [memberCountResult] = await db
    .select({ count: count() })
    .from(membersTable)
    .where(eq(membersTable.eventId, updated.id));

  const [expenseSumResult] = await db
    .select({ total: sum(expensesTable.amount) })
    .from(expensesTable)
    .where(eq(expensesTable.eventId, updated.id));

  await logActivity(updated.id, "event_unfrozen", {});
  const hostName = await getHostMemberName(updated.id);
  res.json(formatEvent(updated, Number(memberCountResult?.count ?? 0), Number(expenseSumResult?.total ?? 0), hostName));
});

/**
 * GET /events/:token/identity-options
 *
 * Returns ALL active people from the permanent directory, grouped by house.
 * Each person carries `hasPin` (directory PIN is set) and `inEvent` (already a
 * participant of this event). The participant opens this page, selects their
 * house, selects themselves, and enters their personal PIN.
 */
router.get("/events/:token/identity-options", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  // All active people with house info
  const people = await db
    .select({
      personId: peopleTable.id,
      name: peopleTable.name,
      avatar: peopleTable.avatar,
      personalPinHash: peopleTable.personalPinHash,
      houseId: peopleTable.houseId,
      houseName: housesTable.name,
      houseCrest: housesTable.crest,
      houseAccentColor: housesTable.accentColor,
    })
    .from(peopleTable)
    .leftJoin(housesTable, eq(peopleTable.houseId, housesTable.id))
    .where(eq(peopleTable.active, true))
    .orderBy(housesTable.name, peopleTable.name);

  // Which people are already members of this event, and who is the host
  const eventMembers = await db
    .select({
      personId: membersTable.personId,
      memberId: membersTable.id,
      isHost: membersTable.isHost,
    })
    .from(membersTable)
    .where(eq(membersTable.eventId, event.id));

  const memberByPersonId = new Map(
    eventMembers
      .filter((m) => m.personId !== null)
      .map((m) => [m.personId!, m]),
  );

  // Build house groups
  const houseMap = new Map<
    number,
    {
      id: number;
      name: string;
      crest: string;
      accentColor: string | null;
      members: Array<{
        id: number;
        name: string;
        hasPin: boolean;
        inEvent: boolean;
        isHost: boolean;
        avatar: string | null;
      }>;
    }
  >();

  for (const person of people) {
    const existing = memberByPersonId.get(person.personId);
    const entry = {
      id: person.personId,
      name: person.name,
      hasPin: !!person.personalPinHash,
      inEvent: !!existing,
      isHost: existing?.isHost ?? false,
      avatar: person.avatar ?? null,
    };

    if (!person.houseId) continue; // skip people with no house (shouldn't happen — schema enforces houseId)

    if (!houseMap.has(person.houseId)) {
      houseMap.set(person.houseId, {
        id: person.houseId,
        name: person.houseName ?? `House ${person.houseId}`,
        crest: person.houseCrest ?? "home",
        accentColor: person.houseAccentColor ?? null,
        members: [],
      });
    }
    houseMap.get(person.houseId)!.members.push(entry);
  }

  res.json({
    eventName: event.name,
    houses: Array.from(houseMap.values()),
  });
});

/**
 * POST /events/:token/identify — Directory-based identity verification
 *
 * Accepts { personId, pin }. Verifies the PIN against the person's entry in the
 * permanent directory. If correct:
 *   - Already a member → return their existing member record.
 *   - Not yet a member → auto-create an approved member and return it.
 *
 * No "first-time claim" flow — PINs are pre-assigned by the host.
 */
router.post("/events/:token/identify", pinVerifyLimiter, async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  if (event.frozen) {
    res.status(403).json({ error: "Event is frozen. No new members can join." });
    return;
  }

  const { personId, pin } = req.body ?? {};

  if (typeof personId !== "number") {
    res.status(400).json({ error: "personId is required" });
    return;
  }
  if (typeof pin !== "string" || !pin) {
    res.status(400).json({ error: "pin is required" });
    return;
  }

  // Look up the person in the directory
  const [person] = await db
    .select()
    .from(peopleTable)
    .where(eq(peopleTable.id, personId));

  if (!person || !person.active) {
    res.status(404).json({ error: "Person not found in directory" });
    return;
  }

  if (!person.personalPinHash) {
    res.status(403).json({ error: "No PIN set for this person. Ask the host to set one." });
    return;
  }

  // Constant-time PIN verification
  if (!verifyPin(pin, person.personalPinHash)) {
    res.status(401).json({ error: "Incorrect PIN" });
    return;
  }

  // Check if already a member of this event
  const [existingMember] = await db
    .select()
    .from(membersTable)
    .where(and(eq(membersTable.eventId, event.id), eq(membersTable.personId, personId)));

  if (existingMember) {
    res.json({
      memberId: existingMember.id,
      memberName: existingMember.name,
      isHost: existingMember.isHost,
    });
    return;
  }

  // Not yet in this event — create an auto-approved member from directory data
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

  await logActivity(event.id, "member_joined", { name: person.name });

  res.json({
    memberId: newMember.id,
    memberName: newMember.name,
    isHost: newMember.isHost,
  });
});

/** POST /events/:token/session — legacy event-PIN auth (kept for backward compat) */
router.post("/events/:token/session", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const { memberId, pin } = req.body ?? {};

  if (pin !== event.pin) {
    res.status(400).json({ error: "Invalid PIN" });
    return;
  }

  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, memberId));
  if (!member || member.eventId !== event.id || !member.approvedAt) {
    res.status(400).json({ error: "Member not found or not approved" });
    return;
  }

  res.json({
    id: member.id,
    eventId: member.eventId,
    name: member.name,
    isHost: member.isHost,
  });
});

/** GET /events/:token/summary — event expense summary */
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

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Category breakdown
  const categoryMap = new Map<string, { count: number; total: number }>();
  for (const e of expenses) {
    const existing = categoryMap.get(e.category) ?? { count: 0, total: 0 };
    categoryMap.set(e.category, { count: existing.count + 1, total: existing.total + e.amount });
  }

  // Top payers
  const memberIds = [...new Set(expenses.map((e) => e.paidByMemberId))];
  const payerMap = new Map<number, number>();
  for (const e of expenses) {
    payerMap.set(e.paidByMemberId, (payerMap.get(e.paidByMemberId) ?? 0) + e.amount);
  }

  let topPayers: Array<{ memberId: number; memberName: string; amount: number }> = [];
  if (memberIds.length > 0) {
    const memberRows = await db
      .select({ id: membersTable.id, name: membersTable.name })
      .from(membersTable)
      .where(inArray(membersTable.id, memberIds));

    topPayers = memberRows
      .map((m) => ({ memberId: m.id, memberName: m.name, amount: payerMap.get(m.id) ?? 0 }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }

  res.json({
    totalExpenses,
    expenseCount: expenses.length,
    categoryBreakdown: Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      ...data,
    })),
    topPayers,
  });
});

export default router;
