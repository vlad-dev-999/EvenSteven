import app from "./app";
import { logger } from "./lib/logger";

// ── Startup validation — fail fast if required secrets are missing ────────────
const REQUIRED_ENV = ["PORT", "HOST_PASSWORD", "SESSION_SECRET", "DATABASE_URL"] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    logger.fatal({ key }, `Required environment variable "${key}" is not set. Refusing to start.`);
    process.exit(1);
  }
}

const port = Number(process.env["PORT"]);
if (Number.isNaN(port) || port <= 0) {
  logger.fatal({ port: process.env["PORT"] }, "Invalid PORT value. Refusing to start.");
  process.exit(1);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});
