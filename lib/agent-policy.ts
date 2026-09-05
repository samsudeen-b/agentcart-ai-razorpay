import type { AgentAnswer } from "./agent-contract";

const failureTerms = [
  "failed",
  "failure",
  "blocked",
  "retry",
  "network",
  "duplicate",
  "out of stock",
  "unavailable",
  "same product",
  "recover",
];

const paymentTerms = [
  "payment",
  "paid",
  "captured",
  "charged",
  "transaction",
];

const orderTerms = [
  "order",
  "order id",
  "created",
];

const explanationTerms = [
  "why",
  "explain",
  "reason",
  "recommended",
  "recommendation",
];

const shoppingTerms = [
  "recommend",
  "suggest",
  "buy",
  "need",
  "budget",
  "under",
  "headphone",
  "speaker",
  "charger",
  "cable",
  "watch",
  "earbuds",
  "travel",
  "desk",
  "gift",
];

function containsAny(query: string, terms: readonly string[]): boolean {
  return terms.some((term) => query.includes(term));
}

export function classifyAgentIntent(
  query: string,
): AgentAnswer["intent"] {
  const normalized = query.trim().toLowerCase();

  if (containsAny(normalized, failureTerms)) {
    return "recover_failure";
  }

  if (containsAny(normalized, paymentTerms)) {
    return "check_payment_status";
  }

  if (containsAny(normalized, orderTerms)) {
    return "check_order_status";
  }

  if (containsAny(normalized, explanationTerms)) {
    return "explain_recommendation";
  }

  if (containsAny(normalized, shoppingTerms)) {
    return "recommend_products";
  }

  return "out_of_scope";
}

export function requestsAutonomousMoneyAction(query: string): boolean {
  const normalized = query.trim().toLowerCase();

  const unsafePatterns = [
    /\bpay for me\b/,
    /\bpay automatically\b/,
    /\bcreate (?:a )?(?:razorpay )?payment\b/,
    /\bcapture (?:the )?payment\b/,
    /\bcharge (?:me|the customer)\b/,
    /\bissue (?:a )?refund\b/,
  ];

  return unsafePatterns.some((pattern) => pattern.test(normalized));
}