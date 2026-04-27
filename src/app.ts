import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import { pinoHttp } from "pino-http";
import rateLimit from "express-rate-limit";
import { logger } from "./lib/logger.js";
import { authRouter } from "./routes/auth.routes.js";
import { decisionsRouter } from "./routes/decisions.routes.js";
import { errorHandler } from "./middleware/error.js";
import { notFoundHandler } from "./middleware/not-found.js";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(pinoHttp({ logger }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/auth", authRouter);
  app.use(
    "/decisions",
    rateLimit({
      windowMs: 60_000,
      max: 10,
      standardHeaders: "draft-7",
      legacyHeaders: false,
    }),
    decisionsRouter,
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
