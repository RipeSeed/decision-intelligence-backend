import type Anthropic from "@anthropic-ai/sdk";
import type { Email } from "../types/email.js";

export const SYSTEM_PROMPT = `You are a senior decision intelligence analyst advising a busy executive.

You will receive a batch of recent emails from the executive's inbox. Your job is to surface the THREE most consequential business decisions that need to be made this week — not summaries, not status updates, not generic to-dos.

Hard rules for every decision you submit:

1. A "decision" is a concrete choice between identifiable options where delay or wrong choice has real business consequence (revenue, headcount, customer relationship, strategic positioning, legal/compliance exposure, runway). Avoid administrative tasks and routine follow-ups.

2. "options" must be at least two genuinely different paths the executive could take, each with crisp pros and cons grounded in the email evidence. "Do nothing" is acceptable only when it is a real strategic choice with stakes.

3. "timeline" must be specific (a date or relative window like "by end of week", "before Q2 kickoff"). Infer it from the emails — meeting dates, deadlines, deal cycles, contract terms.

4. "risk_if_delayed" must describe the concrete consequence of inaction, not a generic worry.

5. "recommended_next_step" must name a specific person, channel, or artifact (e.g., "30-min call with VP Eng before Thursday standup", "respond to Acme's redlines with revised pricing"), not platitudes.

6. "hidden_risk" must be something a careful reader would NOT spot in a single pass — a second-order effect, a cross-thread dependency, a stakeholder dynamic, an obligation buried in a long thread, an unstated assumption that could break. If a risk is explicitly stated in the emails, it does not belong here.

7. "what_youre_not_seeing" must challenge the natural reading. Reframe the situation: a counter-narrative, an alternative interpretation of someone's behavior, an opportunity disguised as a problem, or a problem disguised as an opportunity. It must be specific to these emails, not a generic platitude about leadership.

Prioritize substance over polish. If only two true decisions are present, still return three by including the next most important judgment call — but rank by stakes, not by recency.

Submit your final output by calling the submit_decisions tool. Do not output any prose.`;

export const SUBMIT_DECISIONS_TOOL: Anthropic.Tool = {
  name: "submit_decisions",
  description:
    "Submit exactly three executive decisions identified from the email batch. Each decision must follow the schema strictly.",
  input_schema: {
    type: "object",
    properties: {
      decisions: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        description: "The three most consequential business decisions, ranked by stakes.",
        items: {
          type: "object",
          properties: {
            decision_title: {
              type: "string",
              description: "Short, specific title naming the decision (max ~12 words).",
            },
            decision_frame: {
              type: "string",
              description: "One or two sentences stating exactly what needs to be decided.",
            },
            options: {
              type: "array",
              minItems: 2,
              description: "At least two distinct, actionable options with pros and cons.",
              items: {
                type: "object",
                properties: {
                  option: { type: "string", description: "The option as a concrete action." },
                  pros: { type: "string", description: "Concrete upside, grounded in the emails." },
                  cons: { type: "string", description: "Concrete downside or cost." },
                },
                required: ["option", "pros", "cons"],
                additionalProperties: false,
              },
            },
            timeline: {
              type: "string",
              description:
                "Specific deadline or window for the decision, inferred from the emails.",
            },
            risk_if_delayed: {
              type: "string",
              description: "Concrete consequence of inaction.",
            },
            recommended_next_step: {
              type: "string",
              description: "Specific action: who to talk to, what to send, what meeting to book.",
            },
            hidden_risk: {
              type: "string",
              description:
                "A real risk NOT explicitly stated in the emails — a second-order effect, dependency, or stakeholder dynamic.",
            },
            what_youre_not_seeing: {
              type: "string",
              description:
                "An insight that challenges the natural reading: counter-narrative, reframe, or hidden opportunity.",
            },
          },
          required: [
            "decision_title",
            "decision_frame",
            "options",
            "timeline",
            "risk_if_delayed",
            "recommended_next_step",
            "hidden_risk",
            "what_youre_not_seeing",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["decisions"],
    additionalProperties: false,
  },
};

export function renderEmails(emails: Email[]): string {
  if (emails.length === 0) return "No emails were found in the requested window.";

  const sections = emails.map((email, idx) => {
    const header = `[Email ${idx + 1} of ${emails.length}]`;
    return [
      header,
      `From: ${email.from}`,
      `Subject: ${email.subject}`,
      `Date: ${email.date}`,
      "",
      email.body.trim() || "(empty body)",
    ].join("\n");
  });

  return [
    `Here are ${emails.length} recent emails from the executive's inbox.`,
    "Identify the three most consequential business decisions and call submit_decisions.",
    "",
    sections.join("\n\n---\n\n"),
  ].join("\n");
}
