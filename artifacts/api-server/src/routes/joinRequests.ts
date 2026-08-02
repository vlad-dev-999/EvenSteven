import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { eventsTable, joinRequestsTable, membersTable } from "@workspace/db";
import { logActivity } from "../lib/activity";
import { requireHost } from "../lib/host-auth";

const router: IRouter = Router();

/** GET /events/:token/join-requests (host only) */
router.get("/events/:token/join-requests", requireHost, async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const requests = await db
    .select()
    .from(joinRequestsTable)
    .where(eq(joinRequestsTable.eventId, event.id))
    .orderBy(joinRequestsTable.createdAt);

  res.json(
    requests.map((r) => ({
      id: r.id,
      eventId: r.eventId,
      name: r.name,
      status: r.status,
      createdAt: r.createdAt,
    })),
  );
});

/**
 * POST /events/:token/join-requests
 *
 * Members can now join without host approval.
 * - If a member with the same name already exists → return them for identification.
 * - Otherwise → immediately create an approved member and return them.
 *   No pending join request is created; the flow goes straight to identity claim.
 */
router.post("/events/:token/join-requests", async (req, res): Promise<void> => {
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

  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name || name.length < 1 || name.length > 100) {
    res.status(400).json({ error: "name must be between 1 and 100 characters" });
    return;
  }

  // Check if an approved member with this name already exists
  const existing = await db
    .select()
    .from(membersTable)
    .where(and(eq(membersTable.eventId, event.id), eq(membersTable.name, name)));

  if (existing.length > 0 && existing[0].approvedAt) {
    const m = existing[0];
    res.status(200).json({
      type: "existing_member",
      member: {
        id: m.id,
        eventId: m.eventId,
        name: m.name,
        familyId: m.familyId ?? null,
        familyName: null,
        houseId: m.houseId ?? null,
        houseName: null,
        houseCrest: null,
        houseAccentColor: null,
        isHost: m.isHost,
        approved: true,
        claimed: !!m.claimedAt,
        createdAt: m.createdAt,
      },
      joinRequest: null,
    });
    return;
  }

  // Auto-approve: create member immediately
  const [newMember] = await db
    .insert(membersTable)
    .values({
      eventId: event.id,
      name,
      isHost: false,
      approvedAt: new Date(),
    })
    .returning();

  await logActivity(event.id, "member_joined", { name });

  res.status(201).json({
    type: "member_joined",
    member: {
      id: newMember.id,
      eventId: newMember.eventId,
      name: newMember.name,
      familyId: null,
      familyName: null,
      houseId: null,
      houseName: null,
      houseCrest: null,
      houseAccentColor: null,
      isHost: false,
      approved: true,
      claimed: false,
      createdAt: newMember.createdAt,
    },
    joinRequest: null,
  });
});

/**
 * PATCH /events/:token/join-requests/:requestId (host only)
 * Kept for backward compat / manual override — approve or reject a historical request.
 */
router.patch("/events/:token/join-requests/:requestId", requireHost, async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const requestIdRaw = Array.isArray(req.params.requestId) ? req.params.requestId[0] : req.params.requestId;
  const requestId = parseInt(requestIdRaw, 10);

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const status = req.body?.status;
  if (status !== "approved" && status !== "rejected") {
    res.status(400).json({ error: "status must be 'approved' or 'rejected'" });
    return;
  }

  const [joinRequest] = await db
    .select()
    .from(joinRequestsTable)
    .where(and(eq(joinRequestsTable.id, requestId), eq(joinRequestsTable.eventId, event.id)));

  if (!joinRequest) {
    res.status(404).json({ error: "Join request not found" });
    return;
  }

  const [updated] = await db
    .update(joinRequestsTable)
    .set({ status })
    .where(eq(joinRequestsTable.id, requestId))
    .returning();

  if (status === "approved") {
    await db.insert(membersTable).values({
      eventId: event.id,
      name: joinRequest.name,
      familyId: null,
      isHost: false,
      approvedAt: new Date(),
    });
    await logActivity(event.id, "member_approved", { name: joinRequest.name });
  } else {
    await logActivity(event.id, "join_rejected", { name: joinRequest.name });
  }

  res.json({
    id: updated.id,
    eventId: updated.eventId,
    name: updated.name,
    status: updated.status,
    createdAt: updated.createdAt,
  });
});

export default router;
