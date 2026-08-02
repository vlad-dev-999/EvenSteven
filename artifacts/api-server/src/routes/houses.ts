import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { housesTable } from "@workspace/db";
import { requireHost } from "../lib/host-auth";

const router: IRouter = Router();

/** GET /houses — list all houses */
router.get("/houses", async (req, res): Promise<void> => {
  const houses = await db.select().from(housesTable).orderBy(housesTable.name);
  res.json(houses);
});

/** POST /houses — create a house (host only) */
router.post("/houses", requireHost, async (req, res): Promise<void> => {
  const { name, crest, accentColor } = req.body ?? {};

  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const [house] = await db
    .insert(housesTable)
    .values({ name: name.trim(), crest: crest ?? "home", accentColor: accentColor ?? null })
    .returning();

  res.status(201).json(house);
});

/** PATCH /houses/:id — update a house (host only) */
router.patch("/houses/:id", requireHost, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  const { name, crest, accentColor } = req.body ?? {};

  const updates: Partial<{ name: string; crest: string; accentColor: string | null }> = {};
  if (name !== undefined) updates.name = String(name).trim();
  if (crest !== undefined) updates.crest = String(crest);
  if (accentColor !== undefined) updates.accentColor = accentColor;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db
    .update(housesTable)
    .set(updates)
    .where(eq(housesTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "House not found" });
    return;
  }

  res.json(updated);
});

/** DELETE /houses/:id — delete a house (host only) */
router.delete("/houses/:id", requireHost, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [deleted] = await db
    .delete(housesTable)
    .where(eq(housesTable.id, id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "House not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
