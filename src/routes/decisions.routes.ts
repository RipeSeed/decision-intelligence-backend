import { Router } from "express";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { fetchRecentEmails } from "../services/gmail.service.js";
import { analyzeEmails } from "../services/decision.service.js";

export const decisionsRouter = Router();

decisionsRouter.post("/", async (_req, res) => {
  const startedAt = Date.now();

  res.status(200);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const write = (line: string): void => {
    res.write(`${line}\n`);
  };

  try {
    write(`📥 Fetching emails from the last ${env.EMAIL_FETCH_HOURS}h …`);
    const fetchStart = Date.now();
    const emails = await fetchRecentEmails({
      hours: env.EMAIL_FETCH_HOURS,
      max: env.EMAIL_MAX_COUNT,
    });
    write(`✅ Fetched ${emails.length} email(s) in ${Date.now() - fetchStart}ms`);

    if (emails.length === 0) {
      logger.warn({ windowHours: env.EMAIL_FETCH_HOURS }, "no emails in window");
      write("");
      write(
        JSON.stringify(
          {
            decisions: [],
            source: { emailCount: 0, windowHours: env.EMAIL_FETCH_HOURS },
            note: "No emails in the requested window. Nothing to analyze.",
          },
          null,
          2,
        ),
      );
      res.end();
      return;
    }

    write(`🧠 Asking ${env.CLAUDE_MODEL} for the 3 most important decisions … (10–30s)`);
    const analysisStart = Date.now();
    const decisions = await analyzeEmails(emails);
    write(`✅ Generated ${decisions.length} decision(s) in ${Date.now() - analysisStart}ms`);

    console.log("\n===== Decision Intelligence Output =====");
    console.log(JSON.stringify(decisions, null, 2));
    console.log("========================================\n");

    logger.info(
      { emailCount: emails.length, decisionCount: decisions.length, ms: Date.now() - startedAt },
      "decisions generated",
    );

    write("");
    write(
      JSON.stringify(
        {
          decisions,
          source: {
            emailCount: emails.length,
            windowHours: env.EMAIL_FETCH_HOURS,
            model: env.CLAUDE_MODEL,
          },
        },
        null,
        2,
      ),
    );
    res.end();
  } catch (err) {
    logger.error({ err }, "decisions error");
    write("");
    write(`❌ Error: ${err instanceof Error ? err.message : "Unexpected error"}`);
    res.end();
  }
});
