import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { eventsTable, joinRequestsTable, membersTable } from "@workspace/db";
import {
  CreateJoinRequestBody,
  CreateJoinRequestResponse,
  ListJoinRequestsResponse,
  UpdateJoinRequestBody,
  UpdateJoinRequestResponse,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activity";

const router: IRouter = Router();

/** GET /events/:token/join-requests */
router.get("/events/:token/join-requests", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const requests = await db
    .select()
    .from(joinRequestsTable)
    .where(and(eq(joinRequestsTable.eventId, event.id), eq(joinRequestsTable.status, "pending")))
    .orderBy(joinRequestsTable.createdAt);

  res.json(
    ListJoinRequestsResponse.parse(
      requests.map((r) => ({
        id: r.id,
        eventId: r.eventId,
        name: r.name,
        status: r.status,
        createdAt: r.createdAt,
      })),
    ),
  );
});

/** POST /events/:token/join-requests */
router.post("/events/:token/join-requests", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const parsed = CreateJoinRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name } = parsed.data;

  // Check if an approved member with this name already exists
  const existingMember = await db
    .select()
    .from(membersTable)
    .where(and(eq(membersTable.eventId, event.id), eq(membersTable.name, name)));

  if (existingMember.length > 0 && existingMember[0].approvedAt) {
    // Return the existing member so the client can authenticate
    res.status(201).json(
      CreateJoinRequestResponse.parse({
        type: "existing_member",
        member: {
          id: existingMember[0].id,
          name: existingMember[0].name,
          isHost: existingMember[0].isHost,
        },
        joinRequest: null,
      }),
    );
    return;
  }

  const [joinRequest] = await db
    .insert(joinRequestsTable)
    .values({ eventId: event.id, name, status: "pending" })
    .returning();

  await logActivity(event.id, "join_requested", { name });

  res.status(201).json(
    CreateJoinRequestResponse.parse({
      type: "join_request_created",
      member: null,
      joinRequest: {
        id: joinRequest.id,
        name: joinRequest.name,
        status: joinRequest.status,
      },
    }),
  );
});

/** PATCH /events/:token/join-requests/:requestId */
router.patch("/events/:token/join-requests/:requestId", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const requestIdRaw = Array.isArray(req.params.requestId) ? req.params.requestId[0] : req.params.requestId;
  const requestId = parseInt(requestIdRaw, 10);

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const parsed = UpdateJoinRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
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
    .set({ status: parsed.data.status })
    .where(eq(joinRequestsTable.id, requestId))
    .returning();

  if (parsed.data.status === "approved") {
    // Create a new member
    await db.insert(membersTable).values({
      eventId: event.id,
      name: joinRequest.name,
      familyId: parsed.data.familyId ?? null,
      isHost: false,
      approvedAt: new Date(),
    });

    await logActivity(event.id, "member_approved", { name: joinRequest.name });
  } else {
    await logActivity(event.id, "join_rejected", { name: joinRequest.name });
  }

  res.json(
    UpdateJoinRequestResponse.parse({
      id: updated.id,
      eventId: updated.eventId,
      name: updated.name,
      status: updated.status,
      createdAt: updated.createdAt,
    }),
  );
});

export default router;
