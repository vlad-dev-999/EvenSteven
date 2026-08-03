import { Router, type IRouter } from "express";
import { eq, and, count } from "drizzle-orm";
import { db } from "@workspace/db";
import { eventsTable, familiesTable, membersTable } from "@workspace/db";
import {
  CreateFamilyBody,
  CreateFamilyResponse,
  ListFamiliesResponse,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activity";

const router: IRouter = Router();

/** GET /events/:token/families */
router.get("/events/:token/families", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const families = await db
    .select({
      id: familiesTable.id,
      eventId: familiesTable.eventId,
      name: familiesTable.name,
      createdAt: familiesTable.createdAt,
    })
    .from(familiesTable)
    .where(eq(familiesTable.eventId, event.id))
    .orderBy(familiesTable.name);

  const memberCounts = await db
    .select({ familyId: membersTable.familyId, count: count() })
    .from(membersTable)
    .where(eq(membersTable.eventId, event.id))
    .groupBy(membersTable.familyId);

  const countMap = new Map(memberCounts.map((r) => [r.familyId, Number(r.count)]));

  res.json(
    ListFamiliesResponse.parse(
      families.map((f) => ({
        id: f.id,
        eventId: f.eventId,
        name: f.name,
        memberCount: countMap.get(f.id) ?? 0,
        createdAt: f.createdAt,
      })),
    ),
  );
});

/** POST /events/:token/families */
router.post("/events/:token/families", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  if (event.frozen) {
    res.status(403).json({ error: "Event is frozen. Family changes are not allowed." });
    return;
  }

  const parsed = CreateFamilyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [family] = await db
    .insert(familiesTable)
    .values({ eventId: event.id, name: parsed.data.name })
    .returning();

  await logActivity(event.id, "family_created", { familyName: family.name });

  res.status(201).json(
    CreateFamilyResponse.parse({
      id: family.id,
      eventId: family.eventId,
      name: family.name,
      memberCount: 0,
      createdAt: family.createdAt,
    }),
  );
});

/** DELETE /events/:token/families/:familyId */
router.delete("/events/:token/families/:familyId", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const familyIdRaw = Array.isArray(req.params.familyId) ? req.params.familyId[0] : req.params.familyId;
  const familyId = parseInt(familyIdRaw, 10);

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  if (event.frozen) {
    res.status(403).json({ error: "Event is frozen. Family changes are not allowed." });
    return;
  }

  const [family] = await db
    .select()
    .from(familiesTable)
    .where(and(eq(familiesTable.id, familyId), eq(familiesTable.eventId, event.id)));

  if (!family) {
    res.status(404).json({ error: "Family not found" });
    return;
  }

  await db.delete(familiesTable).where(eq(familiesTable.id, familyId));
  await logActivity(event.id, "family_deleted", { familyName: family.name });

  res.sendStatus(204);
});

export default router;
