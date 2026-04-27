import { describe, expect, it, vi, beforeEach } from "vitest";

const messagesCreate = vi.fn();
vi.mock("../src/lib/anthropic.js", () => ({
  anthropic: {
    messages: { create: messagesCreate },
  },
}));

const { analyzeEmails } = await import("../src/services/decision.service.js");
const { ClaudeFormatError } = await import("../src/lib/errors.js");

const validDecision = {
  decision_title: "Sign or walk on the Acme renewal",
  decision_frame: "Acme is asking for a 20% discount; do we hold price or concede?",
  options: [
    {
      option: "Hold list price and offer service credits",
      pros: "Preserves ARR; sets precedent for other renewals",
      cons: "Acme threatened to evaluate competitors; could lose deal",
    },
    {
      option: "Concede 15% discount with a 24-month lock-in",
      pros: "Locks in revenue; removes churn risk",
      cons: "Erodes margin; signals weakness to other accounts",
    },
  ],
  timeline: "By Friday before the Acme exec call",
  risk_if_delayed: "Acme escalates to their CFO and walks",
  recommended_next_step: "30-min call with VP Sales today to align on floor price",
  hidden_risk: "The CSM is already informally floating discount terms in Slack",
  what_youre_not_seeing: "Acme's RFP language suggests they have already chosen us — leverage is ours",
};

const sampleEmails = [
  {
    id: "1",
    threadId: "1",
    from: "Acme <buyer@acme.com>",
    subject: "Renewal terms",
    date: new Date().toISOString(),
    snippet: "...",
    body: "We need a 20% discount to sign.",
  },
];

beforeEach(() => {
  messagesCreate.mockReset();
});

describe("analyzeEmails", () => {
  it("returns 3 decisions when the model emits a valid tool_use block", async () => {
    messagesCreate.mockResolvedValueOnce({
      stop_reason: "tool_use",
      model: "claude-opus-4-7",
      usage: { input_tokens: 100, output_tokens: 200 },
      content: [
        {
          type: "tool_use",
          id: "toolu_1",
          name: "submit_decisions",
          input: { decisions: [validDecision, validDecision, validDecision] },
        },
      ],
    });

    const decisions = await analyzeEmails(sampleEmails);
    expect(decisions).toHaveLength(3);
    expect(decisions[0]?.decision_title).toBe(validDecision.decision_title);
  });

  it("throws ClaudeFormatError when the model does not call the tool", async () => {
    messagesCreate.mockResolvedValueOnce({
      stop_reason: "end_turn",
      model: "claude-opus-4-7",
      usage: {},
      content: [{ type: "text", text: "Sorry, I can't do that." }],
    });

    await expect(analyzeEmails(sampleEmails)).rejects.toBeInstanceOf(ClaudeFormatError);
  });

  it("throws ClaudeFormatError when the tool input fails the zod schema", async () => {
    messagesCreate.mockResolvedValueOnce({
      stop_reason: "tool_use",
      model: "claude-opus-4-7",
      usage: {},
      content: [
        {
          type: "tool_use",
          id: "toolu_2",
          name: "submit_decisions",
          input: { decisions: [validDecision] }, 
        },
      ],
    });

    await expect(analyzeEmails(sampleEmails)).rejects.toBeInstanceOf(ClaudeFormatError);
  });

  it("calls Anthropic with forced tool_choice for submit_decisions", async () => {
    messagesCreate.mockResolvedValueOnce({
      stop_reason: "tool_use",
      model: "claude-opus-4-7",
      usage: {},
      content: [
        {
          type: "tool_use",
          id: "toolu_3",
          name: "submit_decisions",
          input: { decisions: [validDecision, validDecision, validDecision] },
        },
      ],
    });

    await analyzeEmails(sampleEmails);
    const arg = messagesCreate.mock.calls[0]?.[0];
    expect(arg.tool_choice).toEqual({ type: "tool", name: "submit_decisions" });
    expect(arg.tools[0].name).toBe("submit_decisions");
    expect(arg.system[0].cache_control).toEqual({ type: "ephemeral" });
  });
});
