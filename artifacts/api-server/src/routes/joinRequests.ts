import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { eventsTable, joinRequestsTable, membersTable } from "@workspace/db";
import { logActivity } from "../lib/activity";
import { requireHost } from "../lib/host-auth";

const router: IRouter = Router();

/**
 * GET /events/:token/join-requests (host only)
 * Kept for backward compatibility — join requests are no longer created via the
 * participant flow (replaced by directory-based PIN identification).
 */
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
 * PATCH /events/:token/join-requests/:requestId (host only)
 * Kept for backward compat — approve or reject a historical request.
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
