import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { eventsTable, membersTable, familiesTable } from "@workspace/db";
import {
  ListMembersResponse,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activity";

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
      isHost: membersTable.isHost,
      approvedAt: membersTable.approvedAt,
      createdAt: membersTable.createdAt,
    })
    .from(membersTable)
    .leftJoin(familiesTable, eq(membersTable.familyId, familiesTable.id))
    .where(eq(membersTable.eventId, event.id))
    .orderBy(membersTable.createdAt);

  res.json(
    ListMembersResponse.parse(
      members.map((m) => ({
        id: m.id,
        eventId: m.eventId,
        name: m.name,
        familyId: m.familyId ?? null,
        familyName: m.familyName ?? null,
        isHost: m.isHost,
        approved: !!m.approvedAt,
        createdAt: m.createdAt,
      })),
    ),
  );
});

/** DELETE /events/:token/members/:memberId */
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

  await db.delete(membersTable).where(eq(membersTable.id, memberId));
  await logActivity(event.id, "member_removed", { memberName: member.name });

  res.sendStatus(204);
});

export default router;
