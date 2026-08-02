import path from "path";
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

// ── Production static file serving ─────────────────────────────────────────
// In production the API server also serves the compiled Ledger frontend.
// The path is resolved relative to the bundled entry point (__dirname is set
// by the esbuild banner in build.mjs).  Override with STATIC_DIR env var if
// your layout differs.
if (process.env.NODE_ENV === "production") {
  const staticDir =
    process.env.STATIC_DIR ??
    path.resolve(__dirname, "..", "..", "ledger", "dist", "public");

  app.use(express.static(staticDir));

  // SPA fallback — all non-API routes return index.html
  // Express 5 requires a named wildcard parameter (not bare "*")
  app.get("/{*path}", (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

export default app;
