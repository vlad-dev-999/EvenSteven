import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { createRateLimiter } from "./lib/rate-limit";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Global rate limits ────────────────────────────────────────────────────────
// Tight limit on auth endpoints — applied per-route in the host router.
// Exported so individual routers can attach them selectively.
export const hostAuthLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: "Too many login attempts. Please wait 15 minutes before trying again.",
});

export const pinVerifyLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20,
  message: "Too many PIN attempts. Please wait 10 minutes before trying again.",
});

// Broad API rate limit — protects all endpoints
app.use(
  "/api",
  createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 300,
    message: "Too many requests. Please slow down.",
  }),
);

app.use("/api", router);

export default app;
