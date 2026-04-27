import { Router } from "express";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { fetchRecentEmails } from "../services/gmail.service.js";
import { analyzeEmails } from "../services/decision.service.js";

export const decisionsRouter = Router();

decisionsRouter.post("/", async (_req, res) => {
  const startedAt = Date.now();

  const emails = await fetchRecentEmails({
    hours: env.EMAIL_FETCH_HOURS,
    max: env.EMAIL_MAX_COUNT,
  });

  if (emails.length === 0) {
    logger.warn({ windowHours: env.EMAIL_FETCH_HOURS }, "no emails in window");
    res.json({
      decisions: [],
      source: { emailCount: 0, windowHours: env.EMAIL_FETCH_HOURS },
      note: "No emails in the requested window. Nothing to analyze.",
    });
    return;
  }

  const decisions = await analyzeEmails(emails);

  console.log("\n===== Decision Intelligence Output =====");
  console.log(JSON.stringify(decisions, null, 2));
  console.log("========================================\n");

  logger.info(
    { emailCount: emails.length, decisionCount: decisions.length, ms: Date.now() - startedAt },
    "decisions generated",
  );

  res.json({
    decisions,
    source: {
      emailCount: emails.length,
      windowHours: env.EMAIL_FETCH_HOURS,
      model: env.CLAUDE_MODEL,
    },
  });
});
