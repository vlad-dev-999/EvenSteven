import type { Request, Response, NextFunction } from "express";

interface Entry {
  count: number;
  windowStart: number;
}

/**
 * Simple in-memory sliding-window rate limiter.
 * One store per limiter instance — each call to createRateLimiter() is isolated.
 */
export function createRateLimiter(opts: {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}) {
  const store = new Map<string, Entry>();
  const { windowMs, max, message = "Too many requests. Please try again later.", keyGenerator } = opts;

  // Prune stale entries every window cycle
  const pruneInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now - entry.windowStart > windowMs) store.delete(key);
    }
  }, windowMs).unref(); // .unref() prevents this from keeping the process alive

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const key = keyGenerator ? keyGenerator(req) : String(req.ip ?? "unknown");
    const now = Date.now();
    const existing = store.get(key);

    if (!existing || now - existing.windowStart > windowMs) {
      store.set(key, { count: 1, windowStart: now });
      next();
      return;
    }

    if (existing.count >= max) {
      res.setHeader("Retry-After", String(Math.ceil((windowMs - (now - existing.windowStart)) / 1000)));
      res.status(429).json({ error: message });
      return;
    }

    existing.count++;
    next();
  };
}
