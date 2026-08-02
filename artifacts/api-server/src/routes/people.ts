import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { peopleTable, housesTable } from "@workspace/db";
import { requireHost } from "../lib/host-auth";
import { generatePin } from "../lib/token";
import { hashPin } from "../lib/pin-hash";

const router: IRouter = Router();

/** GET /people — list all people with house info */
router.get("/people", async (req, res): Promise<void> => {
  const people = await db
    .select({
      id: peopleTable.id,
      name: peopleTable.name,
      houseId: peopleTable.houseId,
      houseName: housesTable.name,
      houseCrest: housesTable.crest,
      houseAccentColor: housesTable.accentColor,
      avatar: peopleTable.avatar,
      active: peopleTable.active,
      hasPin: peopleTable.personalPinHash,
      createdAt: peopleTable.createdAt,
    })
    .from(peopleTable)
    .leftJoin(housesTable, eq(peopleTable.houseId, housesTable.id))
    .orderBy(housesTable.name, peopleTable.name);

  res.json(people.map(p => ({
    ...p,
    hasPin: !!p.hasPin, // expose boolean, never expose hash
  })));
});

/** POST /people — create a person (host only) */
router.post("/people", requireHost, async (req, res): Promise<void> => {
  const { name, houseId, avatar, active } = req.body ?? {};

  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name is required" });
    return;
  }
  if (!houseId || typeof houseId !== "number") {
    res.status(400).json({ error: "houseId is required" });
    return;
  }

  const [person] = await db
    .insert(peopleTable)
    .values({
      name: name.trim(),
      houseId,
      avatar: avatar ?? null,
      active: active !== false,
    })
    .returning();

  const [house] = await db.select().from(housesTable).where(eq(housesTable.id, person.houseId));

  res.status(201).json({
    id: person.id,
    name: person.name,
    houseId: person.houseId,
    houseName: house?.name ?? null,
    houseCrest: house?.crest ?? null,
    houseAccentColor: house?.accentColor ?? null,
    avatar: person.avatar,
    active: person.active,
    hasPin: false,
    createdAt: person.createdAt,
  });
});

/** PATCH /people/:id — update a person (host only) */
router.patch("/people/:id", requireHost, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  const { name, houseId, avatar, active } = req.body ?? {};

  const updates: Partial<{ name: string; houseId: number; avatar: string | null; active: boolean }> = {};
  if (name !== undefined) updates.name = String(name).trim();
  if (houseId !== undefined) updates.houseId = Number(houseId);
  if (avatar !== undefined) updates.avatar = avatar;
  if (active !== undefined) updates.active = Boolean(active);

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db
    .update(peopleTable)
    .set(updates)
    .where(eq(peopleTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Person not found" });
    return;
  }

  const [house] = await db.select().from(housesTable).where(eq(housesTable.id, updated.houseId));

  res.json({
    id: updated.id,
    name: updated.name,
    houseId: updated.houseId,
    houseName: house?.name ?? null,
    houseCrest: house?.crest ?? null,
    houseAccentColor: house?.accentColor ?? null,
    avatar: updated.avatar,
    active: updated.active,
    hasPin: !!updated.personalPinHash,
    createdAt: updated.createdAt,
  });
});

/**
 * POST /people/:id/pin — generate (or reset) a person's personal PIN (host only).
 *
 * Generates a new cryptographically secure 4-digit PIN, hashes it with scrypt,
 * and stores the hash on the person record. Returns the plaintext PIN **once** —
 * it is never stored or returned again.
 */
router.post("/people/:id/pin", requireHost, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [person] = await db.select().from(peopleTable).where(eq(peopleTable.id, id));
  if (!person) {
    res.status(404).json({ error: "Person not found" });
    return;
  }

  const pin = generatePin();
  const pinHash = hashPin(pin);

  await db
    .update(peopleTable)
    .set({ personalPinHash: pinHash })
    .where(eq(peopleTable.id, id));

  // Return plaintext once — host must share it with the person
  res.json({ pin });
});

/** DELETE /people/:id — delete a person (host only) */
router.delete("/people/:id", requireHost, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [deleted] = await db
    .delete(peopleTable)
    .where(eq(peopleTable.id, id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Person not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
