import { Router, type IRouter } from "express";
import { eq, count, sum, desc, inArray } from "drizzle-orm";
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
import { hashPin, verifyPin } from "../lib/pin-hash";
import { logActivity } from "../lib/activity";
import { requireHost } from "../lib/host-auth";
import { pinVerifyLimiter } from "../app";

const router: IRouter = Router();

// ── Helper: shape a full event response ──────────────────────────────────────

function formatEvent(event: typeof eventsTable.$inferSelect, memberCount: number, totalExpenses: number) {
  return {
    id: event.id,
    name: event.name,
    token: event.token,
    frozen: event.frozen,
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
  };
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

/** POST /events — create a new event (host only) */
router.post("/events", requireHost, async (req, res): Promise<void> => {
  const {
    name, hostPersonId, attendeePersonIds,
    coverImage, description, venue, address, mapsLink,
    startDate, endDate, itinerary, settlementMode,
  } = req.body ?? {};

  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name is required" });
    return;
  }
  if (typeof hostPersonId !== "number") {
    res.status(400).json({ error: "hostPersonId is required" });
    return;
  }
  if (!Array.isArray(attendeePersonIds) || attendeePersonIds.length === 0) {
    res.status(400).json({ error: "attendeePersonIds must be a non-empty array" });
    return;
  }

  const allPersonIds: number[] = Array.from(new Set([hostPersonId, ...attendeePersonIds]));

  const people = await db
    .select({
      id: peopleTable.id,
      name: peopleTable.name,
      houseId: peopleTable.houseId,
      houseName: housesTable.name,
    })
    .from(peopleTable)
    .leftJoin(housesTable, eq(peopleTable.houseId, housesTable.id))
    .where(
      allPersonIds.length === 1
        ? eq(peopleTable.id, allPersonIds[0])
        : inArray(peopleTable.id, allPersonIds),
    );

  if (people.length === 0) {
    res.status(400).json({ error: "No valid people found for the provided IDs" });
    return;
  }

  const token = generateToken();
  const pin = generatePin();

  const [event] = await db
    .insert(eventsTable)
    .values({
      name: name.trim(),
      token,
      pin,
      coverImage: coverImage ?? null,
      description: description ?? null,
      venue: venue ?? null,
      address: address ?? null,
      mapsLink: mapsLink ?? null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      itinerary: itinerary ?? null,
      settlementMode: settlementMode === "house" ? "house" : "individual",
    })
    .returning();

  // Auto-create event-level families from unique houses
  const uniqueHouseIds = [...new Set(people.map((p) => p.houseId).filter(Boolean))] as number[];
  const houseToFamilyId = new Map<number, number>();

  for (const houseId of uniqueHouseIds) {
    const person = people.find((p) => p.houseId === houseId);
    const [family] = await db
      .insert(familiesTable)
      .values({ eventId: event.id, name: person?.houseName ?? `House ${houseId}` })
      .returning();
    houseToFamilyId.set(houseId, family.id);
  }

  const memberInserts = people.map((person) => ({
    eventId: event.id,
    name: person.name,
    personId: person.id,
    houseId: person.houseId ?? undefined,
    familyId: person.houseId ? houseToFamilyId.get(person.houseId) ?? null : null,
    isHost: person.id === hostPersonId,
    approvedAt: new Date(),
  }));

  const members = await db.insert(membersTable).values(memberInserts).returning();
  const hostMember = members.find((m) => m.isHost) ?? members[0];

  await logActivity(event.id, "event_created", { eventName: name }, hostMember.id, hostMember.name);

  res.status(201).json({
    event: formatEvent(event, members.length, 0),
    pin: event.pin,
    hostMember: {
      id: hostMember.id,
      eventId: hostMember.eventId,
      name: hostMember.name,
      familyId: hostMember.familyId ?? null,
      familyName: null,
      isHost: true,
      approved: true,
      createdAt: hostMember.createdAt,
    },
  });
});

/** GET /events/:token — get event details */
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

  res.json(formatEvent(
    event,
    Number(memberCountResult?.count ?? 0),
    Number(expenseSumResult?.total ?? 0),
  ));
});

/**
 * PATCH /events/:token — update event details (host only)
 * Accepts: coverImage, description, venue, address, mapsLink,
 *          startDate, endDate, itinerary, settlementMode, name
 */
router.patch("/events/:token", requireHost, async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const {
    name, coverImage, description, venue, address, mapsLink,
    startDate, endDate, itinerary, settlementMode,
  } = req.body ?? {};

  const updates: Partial<typeof eventsTable.$inferInsert> = {};
  if (name !== undefined) updates.name = String(name).trim();
  if (coverImage !== undefined) updates.coverImage = coverImage ?? null;
  if (description !== undefined) updates.description = description ?? null;
  if (venue !== undefined) updates.venue = venue ?? null;
  if (address !== undefined) updates.address = address ?? null;
  if (mapsLink !== undefined) updates.mapsLink = mapsLink ?? null;
  if (startDate !== undefined) updates.startDate = startDate ? new Date(startDate) : null;
  if (endDate !== undefined) updates.endDate = endDate ? new Date(endDate) : null;
  if (itinerary !== undefined) updates.itinerary = itinerary ?? null;
  if (settlementMode === "house" || settlementMode === "individual") {
    updates.settlementMode = settlementMode;
  }

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

/** GET /events/:token/identity-options */
router.get("/events/:token/identity-options", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const members = await db
    .select({
      id: membersTable.id,
      name: membersTable.name,
      houseId: membersTable.houseId,
      isHost: membersTable.isHost,
      claimed: membersTable.claimedAt,
      avatar: peopleTable.avatar,
      houseName: housesTable.name,
      houseCrest: housesTable.crest,
      houseAccentColor: housesTable.accentColor,
    })
    .from(membersTable)
    .leftJoin(peopleTable, eq(membersTable.personId, peopleTable.id))
    .leftJoin(housesTable, eq(membersTable.houseId, housesTable.id))
    .where(eq(membersTable.eventId, event.id));

  const houseMap = new Map<
    number,
    {
      id: number;
      name: string;
      crest: string;
      accentColor: string | null;
      members: Array<{ id: number; name: string; claimed: boolean; avatar: string | null; isHost: boolean }>;
    }
  >();

  const noHouseMembers: Array<{ id: number; name: string; claimed: boolean; avatar: string | null; isHost: boolean }> = [];

  for (const member of members) {
    const entry = { id: member.id, name: member.name, claimed: !!member.claimed, avatar: member.avatar ?? null, isHost: member.isHost };
    if (!member.houseId) {
      noHouseMembers.push(entry);
      continue;
    }
    if (!houseMap.has(member.houseId)) {
      houseMap.set(member.houseId, {
        id: member.houseId,
        name: member.houseName ?? `House ${member.houseId}`,
        crest: member.houseCrest ?? "home",
        accentColor: member.houseAccentColor ?? null,
        members: [],
      });
    }
    houseMap.get(member.houseId)!.members.push(entry);
  }

  res.json({
    eventName: event.name,
    // eventPin intentionally omitted — never sent to clients
    houses: Array.from(houseMap.values()),
    noHouseMembers,
  });
});

/**
 * POST /events/:token/identify — claim identity or verify personal PIN
 *
 * First claim:   no PIN stored → generate crypto PIN, hash it, return plaintext once
 * Return visit:  PIN stored → verify provided PIN against hash (constant-time)
 * Migration:     falls back to plaintext comparison for existing unhashed PINs,
 *                then upgrades the stored value to a hash on success
 */
router.post("/events/:token/identify", pinVerifyLimiter, async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const { memberId, personalPin } = req.body ?? {};

  if (typeof memberId !== "number") {
    res.status(400).json({ error: "memberId is required" });
    return;
  }

  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, memberId));
  if (!member || member.eventId !== event.id) {
    res.status(404).json({ error: "Member not found in this event" });
    return;
  }

  if (!member.approvedAt) {
    res.status(403).json({ error: "Member is not approved" });
    return;
  }

  const storedHash = member.personalPinHash;
  const legacyPin = member.personalPin;
  const hasClaim = storedHash || legacyPin;

  // ── First-time claim ──────────────────────────────────────────────────────
  if (!hasClaim) {
    const newPin = generatePin();
    const newHash = hashPin(newPin);

    const [updated] = await db
      .update(membersTable)
      .set({ personalPinHash: newHash, personalPin: null, claimedAt: new Date() })
      .where(eq(membersTable.id, member.id))
      .returning();

    res.json({
      memberId: updated.id,
      memberName: updated.name,
      isHost: updated.isHost,
      personalPin: newPin, // returned ONCE so client can store it
    });
    return;
  }

  // ── Already claimed — PIN required ────────────────────────────────────────
  if (personalPin === undefined || personalPin === null) {
    res.status(409).json({
      error: "Identity already claimed",
      requiresPin: true,
      memberId: member.id,
      memberName: member.name,
    });
    return;
  }

  const pinStr = String(personalPin);

  // Verify: prefer hash, fall back to legacy plaintext (and upgrade on match)
  let verified = false;
  if (storedHash) {
    verified = verifyPin(pinStr, storedHash);
  } else if (legacyPin) {
    verified = verifyPin(pinStr, legacyPin);
    if (verified) {
      // Upgrade to hash
      await db
        .update(membersTable)
        .set({ personalPinHash: hashPin(pinStr), personalPin: null })
        .where(eq(membersTable.id, member.id));
    }
  }

  if (!verified) {
    res.status(401).json({ error: "Incorrect personal PIN" });
    return;
  }

  res.json({
    memberId: member.id,
    memberName: member.name,
    isHost: member.isHost,
    // personalPin NOT returned on verification — client already has it
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
    familyId: member.familyId ?? null,
    familyName: null,
    isHost: member.isHost,
    approved: !!member.approvedAt,
    createdAt: member.createdAt,
  });
});

/** GET /events/:token/session */
router.get("/events/:token/session", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const memberIdHeader = req.headers["x-member-id"];
  const memberId = memberIdHeader ? parseInt(String(memberIdHeader), 10) : null;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  if (!memberId) {
    res.json({ authenticated: false });
    return;
  }

  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, memberId));
  if (!member || member.eventId !== event.id) {
    res.json({ authenticated: false });
    return;
  }

  res.json({
    authenticated: true,
    memberId: member.id,
    memberName: member.name,
    isHost: member.isHost,
  });
});

/** POST /events/:token/freeze (host only) */
router.post("/events/:token/freeze", requireHost, async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db.update(eventsTable).set({ frozen: true }).where(eq(eventsTable.token, token)).returning();
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const [memberCountResult] = await db.select({ count: count() }).from(membersTable).where(eq(membersTable.eventId, event.id));
  const [expenseSumResult] = await db.select({ total: sum(expensesTable.amount) }).from(expensesTable).where(eq(expensesTable.eventId, event.id));
  res.json(formatEvent(event, Number(memberCountResult?.count ?? 0), Number(expenseSumResult?.total ?? 0)));
});

/** POST /events/:token/unfreeze (host only) */
router.post("/events/:token/unfreeze", requireHost, async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db.update(eventsTable).set({ frozen: false }).where(eq(eventsTable.token, token)).returning();
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const [memberCountResult] = await db.select({ count: count() }).from(membersTable).where(eq(membersTable.eventId, event.id));
  const [expenseSumResult] = await db.select({ total: sum(expensesTable.amount) }).from(expensesTable).where(eq(expensesTable.eventId, event.id));
  res.json(formatEvent(event, Number(memberCountResult?.count ?? 0), Number(expenseSumResult?.total ?? 0)));
});

/** GET /events/:token/summary */
router.get("/events/:token/summary", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const members = await db.select().from(membersTable).where(eq(membersTable.eventId, event.id));
  const expenses = await db.select().from(expensesTable).where(eq(expensesTable.eventId, event.id));

  const categoryMap = new Map<string, { total: number; count: number }>();
  for (const expense of expenses) {
    const existing = categoryMap.get(expense.category) ?? { total: 0, count: 0 };
    categoryMap.set(expense.category, { total: existing.total + expense.amount, count: existing.count + 1 });
  }

  const payerMap = new Map<number, { memberId: number; memberName: string; totalPaid: number }>();
  for (const expense of expenses) {
    const member = members.find((m) => m.id === expense.paidByMemberId);
    if (!member) continue;
    const existing = payerMap.get(expense.paidByMemberId) ?? { memberId: expense.paidByMemberId, memberName: member.name, totalPaid: 0 };
    payerMap.set(expense.paidByMemberId, { ...existing, totalPaid: existing.totalPaid + expense.amount });
  }

  const [familyCountResult] = await db.select({ count: count() }).from(familiesTable).where(eq(familiesTable.eventId, event.id));

  res.json({
    totalExpenses: expenses.reduce((s, e) => s + e.amount, 0),
    expenseCount: expenses.length,
    memberCount: members.filter((m) => !!m.approvedAt).length,
    familyCount: Number(familyCountResult?.count ?? 0),
    categoryBreakdown: Array.from(categoryMap.entries()).map(([category, data]) => ({ category, ...data })),
    topPayers: Array.from(payerMap.values()).sort((a, b) => b.totalPaid - a.totalPaid).slice(0, 5),
    settlementMode: event.settlementMode,
  });
});

export default router;
