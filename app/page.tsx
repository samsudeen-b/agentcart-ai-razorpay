"use client";

import { useState } from "react";
import { agentResponseSchema } from "@/lib/agent-contract";
import { AgentCartHeader } from "@/components/agentcart/agentcart-header";
import { CatalogPanel } from "@/components/agentcart/catalog-panel";
import { ConversationPanel } from "@/components/agentcart/conversation-panel";
import {
  DemoScenarios,
} from "@/components/agentcart/demo-scenarios";
import { PurchasePanel } from "@/components/agentcart/purchase-panel";
import type {
  ConversationMessage,
  DemoScenarioId,
} from "@/lib/agentcart-types";
import { formatInr } from "@/lib/catalog";
import {
  createDemoState,
  createInventoryDemoState,
  type AgentCartDemoState,
} from "@/lib/demo-state";

function currentTime(): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

function createStatusResponse(
  state: AgentCartDemoState,
  question: string,
): ConversationMessage {
  const normalizedQuestion = question.toLowerCase();
  const orderId = state.payment.razorpayOrderId;

  let content =
    "I can explain the current proposal, product availability, order state or payment state.";
  let tone: ConversationMessage["tone"] = "neutral";

  if (
    normalizedQuestion.includes("order") ||
    normalizedQuestion.includes("created")
  ) {
    const invalidParametersDetected = state.auditEvents.some(
      (event) => event.id === "invalid-parameters-detected",
    );

    if (invalidParametersDetected) {
      content =
        "I blocked the order because the request contained quantity 99 and a client-provided price of ₹1. Prices must come from the trusted server catalog, and the quantity exceeded the allowed limit. No Razorpay order was created.";
      tone = "warning";
    } else {
      content = orderId
        ? `One order is recorded for this proposal: ${orderId}.`
        : "No Razorpay order has been created for this proposal.";
    }
  }

  if (
    normalizedQuestion.includes("payment") ||
    normalizedQuestion.includes("paid")
  ) {
    if (state.proposal.status === "paid") {
      content = "The verified payment state is paid.";
      tone = "success";
    } else if (state.proposal.status === "payment_failed") {
      content = "Your payment didn’t go through, but no money was captured. Your cart is safe, and no duplicate order was created. You can retry using the same order or choose another payment method.";
      tone = "warning";
    } else if (state.proposal.status === "payment_pending") {
      content =
        "The payment is still pending. I will not claim success until it is verified.";
    } else {
      content = "No successful payment has been verified.";
    }
  }

  if (
    normalizedQuestion.includes("twice") ||
    normalizedQuestion.includes("duplicate")
  ) {
    content = orderId
      ? `No duplicate order was created. The existing order ${orderId} is still linked to the proposal.`
      : "There is no existing order, so no duplicate order was created.";
    tone = "success";
  }

  if (
    normalizedQuestion.includes("stock") ||
    normalizedQuestion.includes("available")
  ) {
    const unavailableProducts = state.products
      .filter((product) => product.stock === 0)
      .map((product) => product.name);

    content =
      unavailableProducts.length > 0
        ? `${unavailableProducts.join(", ")} is currently unavailable.`
        : "Every product in the current catalog is available.";
  }

  return {
    id: `agent-response-${state.messages.length + 1}`,
    role: "agent",
    time: currentTime(),
    title: "AgentCart AI",
    content,
    tone,
  };
}

export default function Home() {
  const [demoState, setDemoState] = useState<AgentCartDemoState>(
    createInventoryDemoState,
  );
  const [scenariosOpen, setScenariosOpen] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string>();

  function handleToggleProduct(productId: string) {
    const eventTime = currentTime();

    setDemoState((current) => {
      const product = current.products.find(
        (item) => item.id === productId,
      );

      if (!product || product.stock === 0) {
        return current;
      }

      const alreadySelected =
        current.selectedProductIds.includes(productId);

      const selectedProductIds = alreadySelected
        ? current.selectedProductIds.filter((id) => id !== productId)
        : [...current.selectedProductIds, productId];

      return {
        ...current,
        selectedProductIds,
        proposal: {
          ...current.proposal,
          version: current.proposal.version + 1,
          status: "awaiting_approval",
          revisedLines: selectedProductIds.map((id) => ({
            productId: id,
            quantity: 1,
          })),
        },
        payment: {},
        auditEvents: [
          ...current.auditEvents,
          {
            id: `cart-change-${current.proposal.version + 1}-${productId}`,
            title: "Cart proposal changed",
            detail: alreadySelected
              ? `${product.name} was removed. Fresh approval is required.`
              : `${product.name} was added. Fresh approval is required.`,
            time: eventTime,
            date: "4 Sep 2026",
            tone: "information",
          },
        ],
      };
    });
  }

  async function handleSendMessage(message: string) {
    if (isThinking) return;

    const stateSnapshot = demoState;
    const eventTime = currentTime();

    setDemoState((current) => ({
      ...current,
      messages: [
        ...current.messages,
        {
          id: `customer-message-${current.messages.length + 1}`,
          role: "customer",
          time: eventTime,
          title: "You",
          content: message,
        },
      ],
    }));

    setIsThinking(true);

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: message,
          context: {
            proposalId: stateSnapshot.proposal.id,
            proposalStatus: stateSnapshot.proposal.status,
            razorpayOrderId:
              stateSnapshot.payment.razorpayOrderId ?? null,
            paymentAttemptId:
              stateSnapshot.payment.paymentAttemptId ?? null,
            selectedProductIds:
              stateSnapshot.proposal.revisedLines.map(
                (line) => line.productId,
              ),
            auditEventIds: stateSnapshot.auditEvents.map(
              (event) => event.id,
            ),
          },
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error("Agent request failed");
      }

      const parsedResponse = agentResponseSchema.safeParse(payload);

      if (!parsedResponse.success) {
        throw new Error("Agent response was invalid");
      }

      const answer = parsedResponse.data;

      setDemoState((current) => {
        const recommendedLines = answer.product_ids.map(
          (productId) => ({
            productId,
            quantity: 1,
          }),
        );

      const shouldUpdateProposal =
        answer.intent === "recommend_products" &&
        recommendedLines.length > 0;

      const tone: ConversationMessage["tone"] =
        answer.action === "retry_payment"
          ? "warning"
          : answer.intent === "recommend_products"
            ? "success"
            : "neutral";

      const auditTitle =
        answer.mode === "GROQ_LLM_VALIDATED"
          ? "LLM response validated"
          : answer.mode === "POLICY_GATE"
            ? "Policy gate handled request"
            : answer.mode === "VERIFIED_STATE_HANDLER"
              ? "Verified state answered"
              : "Deterministic recovery used";

      const auditDetail =
        answer.mode === "GROQ_LLM_VALIDATED"
          ? "Groq generated the response. Product IDs, stock and budget passed server validation."
          : answer.mode === "POLICY_GATE"
            ? "The request was answered without calling the LLM because a policy boundary applied."
            : answer.mode === "VERIFIED_STATE_HANDLER"
              ? "The answer came from verified order or payment state instead of probabilistic model output."
              : "The safe TypeScript fallback answered because the model was unavailable or rejected.";

      const auditTone =
        answer.mode === "GROQ_LLM_VALIDATED"
          ? ("success" as const)
          : answer.mode === "DETERMINISTIC_RECOVERY"
            ? ("warning" as const)
            : ("information" as const);

      return {
        ...current,
        messages: [
          ...current.messages,
          {
            id: `agent-api-${current.messages.length + 1}`,
            role: "agent",
            time: currentTime(),
            title: "AgentCart AI",
            content: answer.answer,
            tone,
            productIds: answer.product_ids,
          },
        ],

        auditEvents: [
          ...current.auditEvents,
          {
            id: `agent-mode-${Date.now()}`,
            title: auditTitle,
            detail: auditDetail,
            time: currentTime(),
            date: new Intl.DateTimeFormat("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            }).format(new Date()),
            tone: auditTone,
          },
        ],

        proposal: shouldUpdateProposal
          ? {
              ...current.proposal,
              version: current.proposal.version + 1,
              status: "awaiting_approval" as const,
              originalLines: recommendedLines,
              revisedLines: recommendedLines,
            }
          : current.proposal,
      };
    });
  } catch {
    setDemoState((current) => ({
      ...current,
      messages: [
        ...current.messages,
        createStatusResponse(current, message),
      ],
    }));
  } finally {
    setIsThinking(false);
  }
}

  function handleReviewCart() {
    setDemoState((current) => {
      const total = current.proposal.revisedLines.reduce(
        (sum, line) => {
          const product = current.products.find(
            (item) => item.id === line.productId,
          );

          return sum + (product?.pricePaise ?? 0) * line.quantity;
        },
        0,
      );

      return {
        ...current,
        messages: [
          ...current.messages,
          {
            id: `review-message-${current.messages.length + 1}`,
            role: "agent",
            time: currentTime(),
            title: "Approval checkpoint",
            content: `The revised total is ${formatInr(
              total,
            )}. Reviewing the cart does not create a Razorpay order. Explicit customer approval is still required.`,
          },
        ],
      };
    });
  }

  async function handlePaymentVerification(
    checkoutResponse: RazorpaySuccessResponse,
  ) {
    setCheckoutError(undefined);

    setDemoState((current) => ({
      ...current,
      proposal: {
        ...current.proposal,
        status: "payment_pending",
      },
      payment: {
        ...current.payment,
        razorpayOrderId: checkoutResponse.razorpay_order_id,
        paymentAttemptId: checkoutResponse.razorpay_payment_id,
      },
    }));

    try {
      const response = await fetch("/api/payments/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(checkoutResponse),
      });

      const result = (await response.json()) as {
        verified?: boolean;
        paid?: boolean;
        paymentStatus?: string;
        paymentMethod?: string;
        error?: string;
      };

      if (!response.ok || !result.verified) {
        throw new Error(
          result.error ?? "The payment could not be verified.",
        );
      }

      const paymentConfirmed = result.paid === true;

      setDemoState((current) => ({
        ...current,
        proposal: {
          ...current.proposal,
          status: paymentConfirmed ? "paid" : "payment_pending",
        },
        payment: {
          ...current.payment,
          razorpayOrderId: checkoutResponse.razorpay_order_id,
          paymentAttemptId: checkoutResponse.razorpay_payment_id,
          paymentMethod: result.paymentMethod,
          createdAt: current.payment.createdAt ?? currentTime(),
        },
        messages: [
          ...current.messages,
          {
            id: `payment-verified-${checkoutResponse.razorpay_payment_id}`,
            role: "agent",
            time: currentTime(),
            title: paymentConfirmed
              ? "Payment confirmed"
              : "Payment verification pending",
            content: paymentConfirmed
              ? "Your payment was securely verified and captured. The purchase is complete."
              : "Your payment response was valid, but capture is not confirmed yet. I will not claim payment success.",
            tone: paymentConfirmed ? "success" : "warning",
          },
        ],
        auditEvents: [
          ...current.auditEvents,
          {
            id: `verified-${checkoutResponse.razorpay_payment_id}`,
            title: paymentConfirmed
              ? "Payment signature and status verified"
              : "Payment signature verified",
            detail: paymentConfirmed
              ? "The backend verified the Razorpay signature and confirmed captured status."
              : `Razorpay reported ${result.paymentStatus ?? "pending"}. Success remains unconfirmed.`,
            time: currentTime(),
            date: new Intl.DateTimeFormat("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            }).format(new Date()),
            tone: paymentConfirmed ? "success" : "warning",
          },
        ],
      }));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Payment verification could not be completed.";

      setCheckoutError(message);

      setDemoState((current) => ({
        ...current,
        proposal: {
          ...current.proposal,
          status: "status_unknown",
        },
        messages: [
          ...current.messages,
          {
            id: `verification-unknown-${current.messages.length + 1}`,
            role: "agent",
            time: currentTime(),
            title: "Payment status needs verification",
            content:
              "The checkout returned, but I could not verify the final payment status. I will not retry or claim success until it is reconciled.",
            tone: "warning",
          },
        ],
      }));
    }
  }


  async function handleApproveAndPay() {
    if (demoState.proposal.revisedLines.length === 0) {
      setCheckoutError("Add at least one available product first.");
      return;
    }

    setCheckoutLoading(true);
    setCheckoutError(undefined);

    setDemoState((current) => ({
      ...current,
      proposal: {
        ...current.proposal,
        status: "order_creating",
      },
    }));

    let statusUnknown = false;
    let orderCreated = false;

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          approved: true,
          proposalId: demoState.proposal.id,
          proposalVersion: demoState.proposal.version,
          items: demoState.proposal.revisedLines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
          })),
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        mode?: string;
        status?: string;
        keyId?: string;
        order?: {
          id?: string;
          amount?: number;
          currency?: string;
        };
      };

      statusUnknown =
        payload.status === "status_unknown" ||
        payload.mode === "ORDER_STATUS_UNKNOWN";

      if (
        !response.ok ||
        !payload.keyId ||
        !payload.order?.id ||
        typeof payload.order.amount !== "number"
      ) {
        throw new Error(
          payload.error ??
            payload.message ??
            "The Razorpay order could not be confirmed.",
        );
      }

      orderCreated = true;

      const orderId = payload.order.id;
      const orderAmount = payload.order.amount;
      const currency = payload.order.currency ?? "INR";
      const reused = payload.mode === "IDEMPOTENT_REUSE";

      setDemoState((current) => ({
        ...current,
        proposal: {
          ...current.proposal,
          status: "order_ready",
        },
        payment: {
          ...current.payment,
          razorpayOrderId: orderId,
          createdAt: current.payment.createdAt ?? currentTime(),
        },
        messages: [
          ...current.messages,
          {
            id: `order-ready-${current.messages.length + 1}`,
            role: "agent",
            time: currentTime(),
            title: reused
              ? "Existing order safely reused"
              : "Secure order ready",
            content: reused
              ? "Your existing Razorpay order was safely reused. No duplicate order was created."
              : "Your approved Razorpay Test Mode order is ready. Complete the payment in the secure Razorpay window.",
            tone: "success",
          },
        ],
        auditEvents: [
          ...current.auditEvents,
          {
            id: `checkout-${orderId}-${current.auditEvents.length + 1}`,
            title: reused
              ? "Duplicate order prevented"
              : "Razorpay order created",
            detail: reused
              ? `Existing order ${orderId} was safely reused.`
              : `Test order ${orderId} was created after explicit approval.`,
            time: currentTime(),
            date: new Intl.DateTimeFormat("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            }).format(new Date()),
            tone: "success",
          },
        ],
      }));

      if (typeof window === "undefined" || !window.Razorpay) {
        throw new Error(
          "Razorpay Checkout is still loading. Wait a moment and try again.",
        );
      }

      const checkout = new window.Razorpay({
        key: payload.keyId,
        amount: orderAmount,
        currency,
        name: "AgentCart AI",
        description: `Approved proposal ${demoState.proposal.id}`,
        order_id: orderId,

        handler: (checkoutResponse) => {
          void handlePaymentVerification(checkoutResponse);
        },

        modal: {
          ondismiss: () => {
            setDemoState((current) => {
              if (
                current.proposal.status === "payment_failed" ||
                current.proposal.status === "payment_pending" ||
                current.proposal.status === "paid" ||
                current.proposal.status === "status_unknown"
              ) {
                return current;
              }

              return {
                ...current,
                proposal: {
                  ...current.proposal,
                  status: "order_ready",
                },
                messages: [
                  ...current.messages,
                  {
                    id: `checkout-dismissed-${current.messages.length + 1}`,
                    role: "agent",
                    time: currentTime(),
                    title: "Payment window closed",
                    content:
                      "No payment success was recorded. Your approved order remains available if you want to continue later.",
                    tone: "neutral",
                  },
                ],
              };
            });
          },
        },

        theme: {
          color: "#1f5eff",
        },
      });

      checkout.on("payment.failed", (failure) => {
        const paymentId = failure.error.metadata?.payment_id;

        setCheckoutError(
          "Your payment did not complete. You can retry safely using the existing order.",
        );

        setDemoState((current) => ({
          ...current,
          proposal: {
            ...current.proposal,
            status: "payment_failed",
          },
          payment: {
            ...current.payment,
            razorpayOrderId: orderId,
            paymentAttemptId:
              paymentId ?? current.payment.paymentAttemptId,
          },
          messages: [
            ...current.messages,
            {
              id: `payment-failed-${current.messages.length + 1}`,
              role: "agent",
              time: currentTime(),
              title: "Payment was not completed",
              content:
                "Your cart and existing order remain safe. You can retry without creating a duplicate Razorpay order.",
              tone: "warning",
            },
          ],
          auditEvents: [
            ...current.auditEvents,
            {
              id: `payment-failed-${current.auditEvents.length + 1}`,
              title: "Payment attempt failed",
              detail: `${failure.error.code}: ${failure.error.description}`,
              time: currentTime(),
              date: new Intl.DateTimeFormat("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              }).format(new Date()),
              tone: "failure",
            },
          ],
        }));
      });

      checkout.open();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Checkout could not be completed.";

      setCheckoutError(message);

      setDemoState((current) => ({
        ...current,
        proposal: {
          ...current.proposal,
          status: statusUnknown
            ? "status_unknown"
            : orderCreated
              ? "order_ready"
              : "awaiting_approval",
        },
      }));
    } finally {
      setCheckoutLoading(false);
    }
  }

  function handleKeepBrowsing() {
    document
      .querySelector(".ac-catalog")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleRunScenario(scenario: DemoScenarioId) {
    setDemoState(createDemoState(scenario));
    setIsThinking(false);
  }

  return (
    <main className="ac-app">
      <AgentCartHeader
        onOpenScenarios={() => setScenariosOpen(true)}
      />

      <div className="ac-workspace">
        <CatalogPanel
          products={demoState.products}
          selectedProductIds={demoState.selectedProductIds}
          onToggleProduct={handleToggleProduct}
        />

        <ConversationPanel
          messages={demoState.messages}
          products={demoState.products}
          isThinking={isThinking}
          showReviewActions={
            demoState.proposal.status === "awaiting_approval"
          }
          onSendMessage={handleSendMessage}
          onReviewCart={handleReviewCart}
          onKeepBrowsing={handleKeepBrowsing}
        />

        <PurchasePanel
          proposal={demoState.proposal}
          products={demoState.products}
          auditEvents={demoState.auditEvents}
          razorpayOrderId={demoState.payment.razorpayOrderId}
          paymentAttemptId={demoState.payment.paymentAttemptId}
          paymentMethod={demoState.payment.paymentMethod}
          createdAt={demoState.payment.createdAt}
          onEditCart={handleKeepBrowsing}
          onApproveAndPay={handleApproveAndPay}
          checkoutLoading={checkoutLoading}
          checkoutError={checkoutError}
        />
      </div>

      <DemoScenarios
        open={scenariosOpen}
        onOpenChange={setScenariosOpen}
        onRunScenario={handleRunScenario}
      />
    </main>
  );
}