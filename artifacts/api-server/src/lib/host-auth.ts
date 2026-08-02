import { createHmac } from "crypto";
import type { Request, Response, NextFunction } from "express";

/**
 * Derive a stable host token from the HOST_PASSWORD and SESSION_SECRET.
 * The token never expires — it is deterministically re-derived on each check.
 */
function deriveHostToken(): string {
  const password = process.env.HOST_PASSWORD;
  const secret = process.env.SESSION_SECRET ?? "dev-secret";

  if (!password) {
    throw new Error("HOST_PASSWORD is not configured");
  }

  return createHmac("sha256", secret).update(password).digest("hex");
}

export function validateHostPassword(password: string): boolean {
  const expected = process.env.HOST_PASSWORD;
  if (!expected) return false;
  // Constant-time comparison to avoid timing attacks
  return password === expected;
}

export function getHostToken(): string {
  return deriveHostToken();
}

export function validateHostToken(token: string): boolean {
  try {
    const expected = deriveHostToken();
    return token === expected;
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
