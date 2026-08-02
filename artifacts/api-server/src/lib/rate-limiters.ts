import { createRateLimiter } from "./rate-limit";

/**
 * Tight limit on host auth endpoints — 10 attempts per 15 minutes.
 * Imported by app.ts (attached per-route) and routes/host.ts.
 */
export const hostAuthLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts. Please wait 15 minutes before trying again.",
});

/**
 * PIN verification limit — 20 attempts per 10 minutes.
 * Imported by routes/events.ts.
 */
export const pinVerifyLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: "Too many PIN attempts. Please wait 10 minutes before trying again.",
});
