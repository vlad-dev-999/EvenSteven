import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { createRateLimiter } from "./lib/rate-limit";
import { hostAuthLimiter, pinVerifyLimiter } from "./lib/rate-limiters";

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

export default app;
