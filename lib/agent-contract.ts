import { z } from "zod";

export const agentIntentSchema = z.enum([
  "recommend_products",
  "explain_recommendation",
  "check_order_status",
  "check_payment_status",
  "recover_failure",
  "out_of_scope",
]);

export const agentActionSchema = z.enum([
  "none",
  "review_proposal",
  "retry_payment",
  "choose_payment_method",
]);

export const agentContextSchema = z.object({
  proposalId: z.string().trim().min(1).max(100).nullable().optional(),

  proposalStatus: z
    .enum([
      "idle",
      "awaiting_approval",
      "approved",
      "order_creating",
      "order_ready",
      "payment_pending",
      "paid",
      "payment_failed",
      "status_unknown",
    ])
    .optional(),

  razorpayOrderId: z.string().trim().min(1).max(100).nullable().optional(),
  paymentAttemptId: z.string().trim().min(1).max(100).nullable().optional(),

  selectedProductIds: z.array(z.string()).max(8).optional(),
  auditEventIds: z.array(z.string()).max(30).optional(),
});

export const agentRequestSchema = z.object({
  query: z.string().trim().min(3).max(500),
  context: agentContextSchema.optional(),
});

export const agentAnswerSchema = z.object({
  intent: agentIntentSchema,
  answer: z.string().trim().min(12).max(900),
  product_ids: z.array(z.string()).max(4).default([]),
  action: agentActionSchema.default("none"),
});

export const agentModeSchema = z.enum([
  "REQUEST_REJECTED",
  "POLICY_GATE",
  "VERIFIED_STATE_HANDLER",
  "DETERMINISTIC_FALLBACK",
  "GROQ_LLM_VALIDATED",
  "DETERMINISTIC_RECOVERY",
]);

export const agentResponseSchema = agentAnswerSchema.extend({
  budget: z.number().int().min(0).max(20_000),
  mode: agentModeSchema,
});

export type AgentRequest = z.infer<typeof agentRequestSchema>;
export type AgentAnswer = z.infer<typeof agentAnswerSchema>;
export type AgentResponse = z.infer<typeof agentResponseSchema>;