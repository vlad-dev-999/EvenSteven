/**
 * Directory routes — global (non-event-scoped) auth and activation.
 *
 * POST /directory/auth            — House → Alias → PIN login
 * POST /directory/activate/request — send email OTP to an unactivated person
 * POST /directory/activate/verify  — verify OTP + set PIN → activated
 * GET  /directory/events           — list active events (for authenticated members)
 */

import { Router, type IRouter } from "express";
import { eq, and, ne } from "drizzle-orm";
import { db } from "@workspace/db";
import { peopleTable, housesTable, eventsTable, membersTable } from "@workspace/db";
import { pinVerifyLimiter } from "../lib/rate-limiters";
import { verifyPin, hashPin } from "../lib/pin-hash";
import { sendActivationOtp } from "../lib/email";
import { randomInt } from "crypto";
import { count, sum, desc } from "drizzle-orm";
import { expensesTable } from "@workspace/db";

const router: IRouter = Router();

// ── Helper ───────────────────────────────────────────────────────────────────

function generateOtp(): string {
  return String(randomInt(100000, 1000000)); // 6-digit
}

// ── POST /directory/auth ─────────────────────────────────────────────────────

/**
 * Global directory authentication: personId + PIN.
 * The UI handles house/alias selection; only personId + PIN are sent here.
 *
 * Returns: { personId, personName, houseId, houseName, houseAccentColor, houseCrest }
 */
router.post("/directory/auth", pinVerifyLimiter, async (req, res): Promise<void> => {
  const { personId, pin } = req.body ?? {};

  if (typeof personId !== "number") {
    res.status(400).json({ error: "personId is required" });
    return;
  }
  if (typeof pin !== "string" || !pin) {
    res.status(400).json({ error: "pin is required" });
    return;
  }

  const [person] = await db
    .select({
      id: peopleTable.id,
      name: peopleTable.name,
      active: peopleTable.active,
      activated: peopleTable.activated,
      personalPinHash: peopleTable.personalPinHash,
      houseId: peopleTable.houseId,
      houseName: housesTable.name,
      houseAccentColor: housesTable.accentColor,
      houseCrest: housesTable.crest,
    })
    .from(peopleTable)
    .leftJoin(housesTable, eq(peopleTable.houseId, housesTable.id))
    .where(eq(peopleTable.id, personId));

  if (!person || !person.active) {
    res.status(404).json({ error: "Person not found in directory" });
    return;
  }

  if (!person.activated || !person.personalPinHash) {
    res.status(403).json({ error: "not_activated", message: "Account not yet activated. Please complete the activation flow." });
    return;
  }

  if (!verifyPin(pin, person.personalPinHash)) {
    res.status(401).json({ error: "Incorrect PIN" });
    return;
  }

  res.json({
    personId: person.id,
    personName: person.name,
    houseId: person.houseId,
    houseName: person.houseName ?? null,
    houseAccentColor: person.houseAccentColor ?? null,
    houseCrest: person.houseCrest ?? null,
  });
});

// ── POST /directory/activate/request ─────────────────────────────────────────

/**
 * Request email OTP for activation. Accepts { personId, email }.
 * Generates a 6-digit OTP, hashes + stores it, then sends it to the email.
 */
router.post("/directory/activate/request", pinVerifyLimiter, async (req, res): Promise<void> => {
  const { personId, email } = req.body ?? {};

  if (typeof personId !== "number") {
    res.status(400).json({ error: "personId is required" });
    return;
  }
  if (typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "A valid email address is required" });
    return;
  }

  const [person] = await db
    .select()
    .from(peopleTable)
    .where(eq(peopleTable.id, personId));

  if (!person || !person.active) {
    res.status(404).json({ error: "Person not found" });
    return;
  }

  // Already activated — they should use the PIN login instead
  if (person.activated) {
    res.status(409).json({ error: "already_activated", message: "Account is already activated. Use PIN to log in." });
    return;
  }

  const otp = generateOtp();
  const otpHash = hashPin(otp);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  // Persist email + hashed OTP
  await db
    .update(peopleTable)
    .set({ email: email.trim().toLowerCase(), emailOtpHash: otpHash, emailOtpExpiresAt: expiresAt })
    .where(eq(peopleTable.id, personId));

  let result: Awaited<ReturnType<typeof sendActivationOtp>>;
  try {
    result = await sendActivationOtp({ to: email.trim(), name: person.name, otp });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Failed to send activation email" });
    return;
  }

  // In dev without SMTP, return the OTP so the flow can be tested
  res.json({
    sent: result.sent,
    ...(result.devOtp !== undefined ? { devOtp: result.devOtp } : {}),
  });
});

// ── POST /directory/activate/verify ──────────────────────────────────────────

/**
 * Verify OTP + choose PIN → marks account as activated.
 * Accepts { personId, otp, pin }
 */
router.post("/directory/activate/verify", pinVerifyLimiter, async (req, res): Promise<void> => {
  const { personId, otp, pin } = req.body ?? {};

  if (typeof personId !== "number") {
    res.status(400).json({ error: "personId is required" });
    return;
  }
  if (typeof otp !== "string" || !otp) {
    res.status(400).json({ error: "otp is required" });
    return;
  }
  if (typeof pin !== "string" || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    res.status(400).json({ error: "pin must be exactly 4 digits" });
    return;
  }

  const [person] = await db
    .select()
    .from(peopleTable)
    .where(eq(peopleTable.id, personId));

  if (!person || !person.active) {
    res.status(404).json({ error: "Person not found" });
    return;
  }

  if (!person.emailOtpHash || !person.emailOtpExpiresAt) {
    res.status(400).json({ error: "No pending activation. Request an OTP first." });
    return;
  }

  if (new Date() > person.emailOtpExpiresAt) {
    res.status(400).json({ error: "OTP has expired. Please request a new one." });
    return;
  }

  if (!verifyPin(otp, person.emailOtpHash)) {
    res.status(401).json({ error: "Incorrect code. Please try again." });
    return;
  }

  const pinHash = hashPin(pin);

  await db
    .update(peopleTable)
    .set({
      activated: true,
      personalPinHash: pinHash,
      emailOtpHash: null,
      emailOtpExpiresAt: null,
    })
    .where(eq(peopleTable.id, personId));

  // Return same shape as /directory/auth so the frontend can store the session
  const [updated] = await db
    .select({
      id: peopleTable.id,
      name: peopleTable.name,
      houseId: peopleTable.houseId,
      houseName: housesTable.name,
      houseAccentColor: housesTable.accentColor,
      houseCrest: housesTable.crest,
    })
    .from(peopleTable)
    .leftJoin(housesTable, eq(peopleTable.houseId, housesTable.id))
    .where(eq(peopleTable.id, personId));

  res.json({
    personId: updated!.id,
    personName: updated!.name,
    houseId: updated!.houseId,
    houseName: updated!.houseName ?? null,
    houseAccentColor: updated!.houseAccentColor ?? null,
    houseCrest: updated!.houseCrest ?? null,
  });
});

// ── GET /directory/events ────────────────────────────────────────────────────

/**
 * List all active (non-archived) events.
 * Public — no auth required; any visitor can see events to decide which to enter.
 */
router.get("/directory/events", async (_req, res): Promise<void> => {
  const events = await db
    .select()
    .from(eventsTable)
    .where(ne(eventsTable.archived, true))
    .orderBy(desc(eventsTable.createdAt));

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

      return {
        id: event.id,
        name: event.name,
        token: event.token,
        frozen: event.frozen,
        archived: event.archived,
        memberCount: Number(memberCountResult?.count ?? 0),
        totalExpenses: Number(expenseSumResult?.total ?? 0),
        venue: event.venue ?? null,
        startDate: event.startDate ?? null,
        endDate: event.endDate ?? null,
        description: event.description ?? null,
        createdAt: event.createdAt,
      };
    }),
  );

  res.json(result);
});

// ── POST /directory/events/:token/join ───────────────────────────────────────

/**
 * Seamless event join for globally-authenticated directory members.
 * Accepts x-person-id header (trusted — same model as x-member-id for expenses).
 * No PIN re-entry required: the global session already proved identity.
 *
 * - Already a member → return existing member record.
 * - Not yet a member → auto-create + return.
 * - Frozen event → 403.
 */
router.post("/directory/events/:token/join", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const personIdHeader = req.headers["x-person-id"];
  const personId = personIdHeader
    ? parseInt(Array.isArray(personIdHeader) ? personIdHeader[0] : personIdHeader, 10)
    : null;

  if (!personId || !Number.isFinite(personId)) {
    res.status(401).json({ error: "x-person-id header required" });
    return;
  }

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.token, token));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  if (event.frozen) {
    res.status(403).json({ error: "Event is closed. New members cannot join." });
    return;
  }

  const [person] = await db
    .select({
      id: peopleTable.id,
      name: peopleTable.name,
      active: peopleTable.active,
      activated: peopleTable.activated,
      houseId: peopleTable.houseId,
    })
    .from(peopleTable)
    .where(eq(peopleTable.id, personId));

  if (!person || !person.active) {
    res.status(404).json({ error: "Person not found in directory" });
    return;
  }

  if (!person.activated) {
    res.status(403).json({ error: "not_activated", message: "Account not yet activated." });
    return;
  }

  // Already a member?
  const [existing] = await db
    .select()
    .from(membersTable)
    .where(and(eq(membersTable.eventId, event.id), eq(membersTable.personId, personId)));

  if (existing) {
    res.json({ memberId: existing.id, memberName: existing.name, isHost: existing.isHost });
    return;
  }

  // Auto-add
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

  const { logActivity } = await import("../lib/activity");
  await logActivity(event.id, "member_joined", { name: person.name });

  res.json({ memberId: newMember.id, memberName: newMember.name, isHost: newMember.isHost });
});

export default router;
