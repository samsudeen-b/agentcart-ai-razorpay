import type { AgentAnswer, AgentRequest } from "./agent-contract";
import { classifyAgentIntent, requestsAutonomousMoneyAction } from "./agent-policy";
import { PRODUCTS } from "./catalog";

export function extractBudgetInr(query: string): number {
  const normalized = query.replaceAll(",", "");
  const match = normalized.match(/(?:₹|rs\.?|inr)?\s*(\d{3,6})/i);

  return match ? Math.min(Number(match[1]), 20_000) : 20_000;
}

function recommendationFallback(query: string): AgentAnswer {
  const normalized = query.toLowerCase();
  const budgetInr = extractBudgetInr(query);

  let preferredIds: string[];

  if (normalized.includes("gift")) {
    preferredIds = ["flux-mini", "wave-buds", "carry-case"];
  } else if (
    normalized.includes("travel") ||
    normalized.includes("trip")
  ) {
    preferredIds = [
      "echo-arc-pro",
      "nova-65-gan",
      "volt-cable-c",
      "carry-case",
    ];
  } else if (
    normalized.includes("desk") ||
    normalized.includes("workspace")
  ) {
    preferredIds = ["echo-arc-pro", "loom-stand", "nova-65-gan"];
  } else {
    preferredIds = ["echo-arc-pro", "flux-mini", "nova-65-gan"];
  }

  const selected: string[] = [];
  let totalPaise = 0;

  for (const productId of preferredIds) {
    const product = PRODUCTS.find((item) => item.id === productId);

    if (
      product &&
      product.stock > 0 &&
      selected.length < 3 &&
      totalPaise + product.pricePaise <= budgetInr * 100
    ) {
      selected.push(product.id);
      totalPaise += product.pricePaise;
    }
  }

  if (!selected.length) {
    const cheapestProduct = [...PRODUCTS]
      .filter((product) => product.stock > 0)
      .sort((a, b) => a.pricePaise - b.pricePaise)
      .find((product) => product.pricePaise <= budgetInr * 100);

    if (cheapestProduct) {
      selected.push(cheapestProduct.id);
    }
  }

  const names = selected
    .map((id) => PRODUCTS.find((product) => product.id === id)?.name)
    .filter(Boolean)
    .join(", ");

  return {
    intent: "recommend_products",
    product_ids: selected,
    answer: selected.length
      ? `${names} fit the stated goal and remain within the ${budgetInr.toLocaleString("en-IN")} budget. Prices and stock were checked against the trusted server catalog.`
      : `No in-stock product currently fits the ${budgetInr.toLocaleString("en-IN")} budget.`,
    action: selected.length ? "review_proposal" : "none",
  };
}

export function createDeterministicAnswer(
  request: AgentRequest,
): AgentAnswer {
  const intent = classifyAgentIntent(request.query);
  const context = request.context;

  if (requestsAutonomousMoneyAction(request.query)) {
    return {
      intent: "recover_failure",
      product_ids: [],
      answer:
        "I cannot charge you or create a payment autonomously. I can prepare a verified proposal, but you must review and approve it before checkout.",
      action: "review_proposal",
    };
  }

  if (intent === "out_of_scope") {
    return {
      intent,
      product_ids: [],
      answer:
        "I can only help with this catalog, product recommendations, proposals, order status, payment status and safe failure recovery.",
      action: "none",
    };
  }

  if (intent === "check_order_status") {
    return {
      intent,
      product_ids: [],
      answer: context?.razorpayOrderId
        ? `One Razorpay order is linked to this proposal: ${context.razorpayOrderId}. A retry will reuse this order instead of creating a duplicate.`
        : "No Razorpay order has been created for this proposal.",
      action: "none",
    };
  }

  if (intent === "check_payment_status") {
    if (context?.proposalStatus === "paid") {
      return {
        intent,
        product_ids: [],
        answer: "The server has verified that the payment is paid.",
        action: "none",
      };
    }

    if (context?.proposalStatus === "payment_failed") {
      return {
        intent,
        product_ids: [],
        answer:
          "No successful payment is recorded. Your cart remains preserved, and you can safely retry or choose another payment method.",
        action: "retry_payment",
      };
    }

    return {
      intent,
      product_ids: [],
      answer:
        "No successful payment has been verified. I will not claim payment success until the server confirms it.",
      action: "none",
    };
  }

  if (intent === "recover_failure") {
    const auditIds = context?.auditEventIds ?? [];

    if (auditIds.some((id) => id.includes("invalid"))) {
      return {
        intent,
        product_ids: [],
        answer:
          "The unsafe quantity and client-provided price were rejected. I can rebuild the proposal using an allowed quantity and the trusted catalog price, then request fresh approval.",
        action: "review_proposal",
      };
    }

    if (auditIds.some((id) => id.includes("inventory"))) {
      return {
        intent,
        product_ids: [],
        answer:
          "The unavailable item was removed before checkout. I can offer an in-stock alternative, but the revised proposal requires fresh approval.",
        action: "review_proposal",
      };
    }

    return {
      intent,
      product_ids: [],
      answer:
        "Your cart is preserved. I will check the verified order and payment state before suggesting a safe retry.",
      action: "none",
    };
  }

  if (intent === "explain_recommendation") {
    return {
      intent,
      product_ids: context?.selectedProductIds ?? [],
      answer:
        "The recommendation uses your stated goal and budget, then verifies every product against trusted server-side prices and available stock.",
      action: "none",
    };
  }

  return recommendationFallback(request.query);
}