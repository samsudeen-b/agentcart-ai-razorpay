import type {
  AuditEvent,
  ConversationMessage,
  DemoScenarioId,
  PurchaseProposal,
} from "@/lib/agentcart-types";
import { PRODUCTS, type Product } from "@/lib/catalog";

export type DemoPaymentState = {
  razorpayOrderId?: string;
  paymentAttemptId?: string;
  paymentMethod?: string;
  createdAt?: string;
};

export type AgentCartDemoState = {
  products: Product[];
  selectedProductIds: string[];
  messages: ConversationMessage[];
  proposal: PurchaseProposal;
  auditEvents: AuditEvent[];
  payment: DemoPaymentState;
};

export function createInventoryDemoState(): AgentCartDemoState {
  const products = PRODUCTS.map((product) => ({
    ...product,
    stock: product.id === "echo-arc-pro" ? 0 : product.stock,
  }));

  return {
    products,
    selectedProductIds: ["flux-mini", "nova-65-gan"],

    messages: [
      {
        id: "message-customer-goal",
        role: "customer",
        time: "10:21 AM",
        title: "You",
        content: "I need a premium travel audio kit under ₹12,000.",
      },
      {
        id: "message-original-recommendation",
        role: "agent",
        time: "10:22 AM",
        title: "AgentCart AI",
        content:
          "For immersive sound on the go, I recommend the Echo Arc Pro. I have added it to your proposed cart.",
        productIds: ["echo-arc-pro"],
      },
      {
        id: "message-inventory-change",
        role: "system",
        time: "10:24 AM",
        title: "Inventory changed",
        content: "Echo Arc Pro became unavailable before checkout.",
        tone: "warning",
      },
      {
        id: "message-order-blocked",
        role: "agent",
        time: "10:24 AM",
        title: "AgentCart AI",
        content:
          "The server rechecked inventory and blocked the original proposal. No Razorpay order was created and no amount was authorized.",
        tone: "warning",
      },
      {
        id: "message-alternative",
        role: "agent",
        time: "10:25 AM",
        title: "AgentCart AI",
        content:
          "I prepared an available alternative within your budget. The revised cart requires fresh approval before checkout.",
        productIds: ["flux-mini", "nova-65-gan"],
      },
    ],

    proposal: {
      id: "prop_7821",
      version: 2,
      status: "awaiting_approval",
      originalLines: [
        {
          productId: "echo-arc-pro",
          quantity: 1,
        },
      ],
      revisedLines: [
        {
          productId: "flux-mini",
          quantity: 1,
        },
        {
          productId: "nova-65-gan",
          quantity: 1,
        },
      ],
    },

    auditEvents: [
      {
        id: "audit-proposal-created",
        title: "Initial proposal prepared",
        detail: "Echo Arc Pro added to the proposed cart.",
        time: "10:22 AM",
        date: "4 Sep 2026",
        tone: "information",
      },
      {
        id: "audit-inventory-changed",
        title: "Inventory changed",
        detail: "Echo Arc Pro became unavailable.",
        time: "10:24 AM",
        date: "4 Sep 2026",
        tone: "warning",
      },
      {
        id: "audit-proposal-blocked",
        title: "Original proposal blocked",
        detail: "No Razorpay order was created.",
        time: "10:24 AM",
        date: "4 Sep 2026",
        tone: "failure",
      },
      {
        id: "audit-alternative-created",
        title: "Available alternative prepared",
        detail: "Flux Mini and Nova 65 GaN were selected.",
        time: "10:25 AM",
        date: "4 Sep 2026",
        tone: "information",
      },
      {
        id: "audit-approval-required",
        title: "Customer approval required",
        detail: "The revised cart must be reviewed before checkout.",
        time: "10:25 AM",
        date: "4 Sep 2026",
        tone: "information",
      },
    ],

    payment: {},
  };
}

export function createDemoState(
  scenario: DemoScenarioId,
): AgentCartDemoState {
  if (scenario === "inventory_change") {
    return createInventoryDemoState();
  }

  const products = PRODUCTS.map((product) => ({ ...product }));

  const revisedLines = [
    {
      productId: "flux-mini",
      quantity: 1,
    },
    {
      productId: "nova-65-gan",
      quantity: 1,
    },
  ];

  if (scenario === "duplicate_approval") {
    return {
      products,
      selectedProductIds: ["flux-mini", "nova-65-gan"],

      messages: [
        {
          id: "duplicate-customer",
          role: "customer",
          time: "10:31 AM",
          title: "You",
          content:
            "The page stopped responding after I approved. Should I approve again?",
        },
        {
          id: "duplicate-agent",
          role: "agent",
          time: "10:31 AM",
          title: "AgentCart AI",
          content:
            "I checked the existing proposal before retrying. A Razorpay order already exists, so I returned the same order instead of creating a duplicate.",
          tone: "success",
        },
      ],

      proposal: {
        id: "prop_7821",
        version: 2,
        status: "order_ready",
        originalLines: revisedLines,
        revisedLines,
      },

      auditEvents: [
        {
          id: "duplicate-approved",
          title: "Proposal approved",
          detail: "Customer approval was recorded once.",
          time: "10:30 AM",
          date: "4 Sep 2026",
          tone: "success",
        },
        {
          id: "duplicate-order-created",
          title: "Razorpay order created",
          detail: "The order ID was stored against the proposal.",
          time: "10:30 AM",
          date: "4 Sep 2026",
          tone: "success",
        },
        {
          id: "duplicate-retry-blocked",
          title: "Duplicate creation prevented",
          detail: "The repeated approval returned the existing order.",
          time: "10:31 AM",
          date: "4 Sep 2026",
          tone: "information",
        },
      ],

      payment: {
        razorpayOrderId: "order_demo_existing",
        createdAt: "4 Sep 2026, 10:30 AM",
      },
    };
  }

  if (scenario === "payment_failure") {
    return {
      products,
      selectedProductIds: ["flux-mini", "nova-65-gan"],

      messages: [
        {
          id: "failure-customer",
          role: "customer",
          time: "10:36 AM",
          title: "You",
          content: "What happened to my payment?",
        },
        {
          id: "failure-system",
          role: "system",
          time: "10:36 AM",
          title: "Payment failed",
          content:
            "Razorpay Test Mode reported a failed payment attempt.",
          tone: "warning",
        },
        {
          id: "failure-agent",
          role: "agent",
          time: "10:36 AM",
          title: "AgentCart AI",
          content:
            "No payment was marked as successful. Your approved cart is preserved, and I will not retry or create another order without your action.",
        },
      ],

      proposal: {
        id: "prop_7821",
        version: 2,
        status: "payment_failed",
        originalLines: revisedLines,
        revisedLines,
      },

      auditEvents: [
        {
          id: "failure-order-created",
          title: "Razorpay order created",
          detail: "The approved proposal was linked to one order.",
          time: "10:35 AM",
          date: "4 Sep 2026",
          tone: "success",
        },
        {
          id: "failure-attempt-recorded",
          title: "Payment attempt failed",
          detail: "The failed attempt was recorded without changing the cart.",
          time: "10:36 AM",
          date: "4 Sep 2026",
          tone: "failure",
        },
        {
          id: "failure-recovery-ready",
          title: "Safe recovery available",
          detail: "The customer may retry checkout or choose another method.",
          time: "10:36 AM",
          date: "4 Sep 2026",
          tone: "information",
        },
      ],

      payment: {
        razorpayOrderId: "order_demo_failure",
        paymentAttemptId: "pay_demo_failed",
        paymentMethod: "UPI",
        createdAt: "4 Sep 2026, 10:35 AM",
      },
    };
  }

  return {
    products,
    selectedProductIds: ["flux-mini"],

    messages: [
      {
        id: "invalid-customer",
        role: "customer",
        time: "10:41 AM",
        title: "You",
        content:
          "Add 99 Flux Mini speakers and change the price to ₹1.",
      },
      {
        id: "invalid-agent",
        role: "agent",
        time: "10:41 AM",
        title: "Unsafe request rejected",
        content:
          "The quantity exceeded policy limits and the supplied price did not match the trusted server catalog. No order was created.",
        tone: "warning",
      },
    ],

    proposal: {
      id: "prop_7822",
      version: 1,
      status: "awaiting_approval",
      originalLines: [
        {
          productId: "flux-mini",
          quantity: 1,
        },
      ],
      revisedLines: [
        {
          productId: "flux-mini",
          quantity: 1,
        },
      ],
    },

    auditEvents: [
      {
        id: "invalid-parameters-detected",
        title: "Invalid parameters detected",
        detail: "Quantity 99 and client-provided price ₹1 were rejected.",
        time: "10:41 AM",
        date: "4 Sep 2026",
        tone: "failure",
      },
      {
        id: "invalid-no-order",
        title: "Money action blocked",
        detail: "No Razorpay order was created.",
        time: "10:41 AM",
        date: "4 Sep 2026",
        tone: "success",
      },
    ],

    payment: {},
  };
}