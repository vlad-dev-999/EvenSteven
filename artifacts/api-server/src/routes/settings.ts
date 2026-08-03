import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { appSettingsTable } from "@workspace/db";
import { requireHost } from "../lib/host-auth";

const router: IRouter = Router();

const ALLOWED_KEYS = new Set(["skipper_note"]);

/** GET /settings/:key — read a global setting (public) */
router.get("/settings/:key", async (req, res): Promise<void> => {
  const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
  if (!ALLOWED_KEYS.has(key)) {
    res.status(404).json({ error: "Unknown setting" });
    return;
  }

  const [row] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, key));

  res.json({ key, value: row?.value ?? null });
});

/** PATCH /settings/:key — update a global setting (host only) */
router.patch("/settings/:key", requireHost, async (req, res): Promise<void> => {
  const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
  if (!ALLOWED_KEYS.has(key)) {
    res.status(404).json({ error: "Unknown setting" });
    return;
  }

  const { value } = req.body ?? {};
  const newValue: string | null =
    typeof value === "string" ? value.trim() || null : null;

  await db
    .insert(appSettingsTable)
    .values({ key, value: newValue, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettingsTable.key,
      set: { value: newValue, updatedAt: new Date() },
    });

  res.json({ key, value: newValue });
});

export default router;
