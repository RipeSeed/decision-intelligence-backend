import { anthropic } from "../lib/anthropic.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { ClaudeFormatError } from "../lib/errors.js";
import {
  SUBMIT_DECISIONS_TOOL,
  SYSTEM_PROMPT,
  renderEmails,
} from "../prompts/decision-analysis.js";
import { DecisionsPayloadSchema, type Decision } from "../types/decision.js";
import type { Email } from "../types/email.js";

export async function analyzeEmails(emails: Email[]): Promise<Decision[]> {
  const userMessage = renderEmails(emails);

  const response = await anthropic.messages.create({
    model: env.CLAUDE_MODEL,
    max_tokens: env.CLAUDE_MAX_TOKENS,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [SUBMIT_DECISIONS_TOOL],
    tool_choice: { type: "tool", name: SUBMIT_DECISIONS_TOOL.name },
    messages: [{ role: "user", content: userMessage }],
  });

  logger.info(
    {
      stop_reason: response.stop_reason,
      usage: response.usage,
      model: response.model,
    },
    "claude response",
  );

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new ClaudeFormatError(
      `Model did not call submit_decisions. stop_reason=${response.stop_reason ?? "unknown"}`,
    );
  }

  const parsed = DecisionsPayloadSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new ClaudeFormatError(
      `Model tool input failed schema validation: ${parsed.error.message}`,
    );
  }

  return parsed.data.decisions;
}
