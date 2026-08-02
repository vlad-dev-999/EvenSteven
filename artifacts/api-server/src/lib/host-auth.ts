import { createHmac, timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";

/**
 * Derive a stable host token from HOST_PASSWORD and SESSION_SECRET via HMAC-SHA256.
 * The token is deterministically re-derived on each check — no state needed.
 * Both secrets MUST be present; startup validation enforces this.
 */
function deriveHostToken(): string {
  const password = process.env.HOST_PASSWORD;
  const secret = process.env.SESSION_SECRET;

  if (!password) throw new Error("HOST_PASSWORD is not configured");
  if (!secret) throw new Error("SESSION_SECRET is not configured");

  return createHmac("sha256", secret).update(password).digest("hex");
}

/** Constant-time password comparison */
export function validateHostPassword(password: string): boolean {
  const expected = process.env.HOST_PASSWORD;
  if (!expected) return false;
  try {
    const a = Buffer.from(password);
    const b = Buffer.from(expected);
    if (a.length !== b.length) {
      // Perform a dummy comparison to prevent timing leak on length
      timingSafeEqual(b, b);
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function getHostToken(): string {
  return deriveHostToken();
}

/** Constant-time token comparison */
export function validateHostToken(token: string): boolean {
  try {
    const expected = deriveHostToken();
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length) {
      timingSafeEqual(b, b);
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Express middleware — rejects non-host requests with 401 */
export function requireHost(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers["x-host-token"];
  if (typeof token !== "string" || !validateHostToken(token)) {
    res.status(401).json({ error: "Host authentication required" });
    return;
  }
  next();
}

/** Resolve member identity from x-member-id header (does NOT validate against DB) */
export function getMemberIdFromHeader(req: Request): number | null {
  const raw = req.headers["x-member-id"];
  if (!raw) return null;
  const id = parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}
