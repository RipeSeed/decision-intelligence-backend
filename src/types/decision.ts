import { z } from "zod";

const DecisionOption = z.object({
  option: z.string().min(1),
  pros: z.string().min(1),
  cons: z.string().min(1),
});

export const DecisionSchema = z.object({
  decision_title: z.string().min(1),
  decision_frame: z.string().min(1),
  options: z.array(DecisionOption).min(2),
  timeline: z.string().min(1),
  risk_if_delayed: z.string().min(1),
  recommended_next_step: z.string().min(1),
  hidden_risk: z.string().min(1),
  what_youre_not_seeing: z.string().min(1),
});

export const DecisionsPayloadSchema = z.object({
  decisions: z.array(DecisionSchema).length(3),
});

export type DecisionOption = z.infer<typeof DecisionOption>;
export type Decision = z.infer<typeof DecisionSchema>;
export type DecisionsPayload = z.infer<typeof DecisionsPayloadSchema>;
