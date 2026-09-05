"use client";

import Image from "next/image";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Info,
  ShieldX,
} from "lucide-react";

import type {
  AuditEvent,
  CartLine,
  PurchaseProposal,
  PurchaseStatus,
} from "@/lib/agentcart-types";
import { formatInr, type Product } from "@/lib/catalog";

type PurchasePanelProps = {
  proposal: PurchaseProposal;
  products: readonly Product[];
  auditEvents: readonly AuditEvent[];
  razorpayOrderId?: string;
  paymentAttemptId?: string;
  paymentMethod?: string;
  createdAt?: string;
  onEditCart: () => void;
  onApproveAndPay: () => void;
  checkoutLoading: boolean;
  checkoutError?: string;
};

const STATUS_LABELS: Record<PurchaseStatus, string> = {
  idle: "No proposal",
  awaiting_approval: "Revised proposal — awaiting approval",
  approved: "Customer approved",
  order_creating: "Creating Razorpay order",
  order_ready: "Razorpay order ready",
  payment_pending: "Payment pending",
  paid: "Payment confirmed",
  payment_failed: "Payment failed",
  status_unknown: "Status check required",
};

function totalForLines(
  lines: readonly CartLine[],
  products: readonly Product[],
) {
  return lines.reduce((total, line) => {
    const product = products.find((item) => item.id === line.productId);
    return total + (product?.pricePaise ?? 0) * line.quantity;
  }, 0);
}

function AuditIcon({ tone }: { tone: AuditEvent["tone"] }) {
  if (tone === "failure") {
    return <ShieldX size={16} aria-hidden="true" />;
  }

  if (tone === "warning") {
    return <AlertCircle size={16} aria-hidden="true" />;
  }

  if (tone === "success") {
    return <CheckCircle2 size={16} aria-hidden="true" />;
  }

  return <Info size={16} aria-hidden="true" />;
}

function CartRows({
  lines,
  products,
  showStock,
}: {
  lines: readonly CartLine[];
  products: readonly Product[];
  showStock?: boolean;
}) {
  return (
    <div className="ac-ledger-items">
      {lines.map((line) => {
        const product = products.find(
          (item) => item.id === line.productId,
        );

        if (!product) {
          return null;
        }

        return (
          <div className="ac-ledger-item" key={product.id}>
            <Image
              src={product.image}
              alt=""
              width={48}
              height={48}
            />

            <div>
              <strong>{product.name}</strong>
              <span>{formatInr(product.pricePaise)}</span>

              {showStock && product.stock === 0 && (
                <em>Out of stock</em>
              )}
            </div>

            <span>Qty {line.quantity}</span>

            <strong>
              {formatInr(product.pricePaise * line.quantity)}
            </strong>
          </div>
        );
      })}
    </div>
  );
}

export function PurchasePanel({
  proposal,
  products,
  auditEvents,
  razorpayOrderId,
  paymentAttemptId,
  paymentMethod,
  createdAt,
  onEditCart,
  onApproveAndPay,
  checkoutLoading,
  checkoutError,
}: PurchasePanelProps) {
  const revisedSubtotal = totalForLines(
    proposal.revisedLines,
    products,
  );

  // Prices already include tax. This calculates the tax portion
  // without adding tax to the customer total a second time.
  const includedTax = Math.round((revisedSubtotal * 18) / 118);

  return (
    <aside className="ac-purchase" aria-label="Current purchase">
      <h2>Current purchase</h2>

      <dl className="ac-proposal-summary">
        <div>
          <dt>Proposal ID</dt>
          <dd>
            {proposal.id}
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(proposal.id)}
              aria-label="Copy proposal ID"
            >
              <Copy size={14} aria-hidden="true" />
            </button>
          </dd>
        </div>

        <div>
          <dt>Status</dt>
          <dd>
            <span className={`ac-status is-${proposal.status}`}>
              {STATUS_LABELS[proposal.status]}
            </span>
          </dd>
        </div>

        <div>
          <dt>Approved amount</dt>
          <dd>
            {proposal.status === "idle"
              ? "—"
              : formatInr(revisedSubtotal)}
          </dd>
        </div>
      </dl>

      <section className="ac-ledger-section">
        <h3>Original proposal</h3>
        <CartRows
          lines={proposal.originalLines}
          products={products}
          showStock
        />
      </section>

      <section className="ac-ledger-section">
        <div className="ac-ledger-section-heading">
          <h3>
            Revised cart ({proposal.revisedLines.length}{" "}
            {proposal.revisedLines.length === 1 ? "item" : "items"})
          </h3>

          <button type="button" onClick={onEditCart}>
            Edit
          </button>
        </div>

        <CartRows
          lines={proposal.revisedLines}
          products={products}
        />

        <dl className="ac-totals">
          <div>
            <dt>Merchandise subtotal</dt>
            <dd>{formatInr(revisedSubtotal)}</dd>
          </div>
          <div>
            <dt>Included tax (18%)</dt>
            <dd>{formatInr(includedTax)}</dd>
          </div>
          <div>
            <dt>Shipping</dt>
            <dd>{formatInr(0)}</dd>
          </div>
          <div className="ac-total-row">
            <dt>Revised total</dt>
            <dd>{formatInr(revisedSubtotal)}</dd>
          </div>
        </dl>
        {checkoutError && (
          <p className="ac-checkout-error" role="alert">
            {checkoutError}
          </p>
        )}

        <button
          type="button"
          className="ac-approve-payment"
          onClick={onApproveAndPay}
          disabled={
            checkoutLoading ||
            proposal.revisedLines.length === 0 ||
            proposal.status === "status_unknown"
          }
        >
          {checkoutLoading
            ? "Creating secure order..."
            : razorpayOrderId
              ? "Continue to secure payment"
              : "Approve & Pay securely"}
        </button>

        <p className="ac-approval-note">
          A Razorpay Test Mode order is created only after this explicit
          approval.
        </p>

      </section>

      <section className="ac-ledger-section">
        <h3>Razorpay details</h3>

        <dl className="ac-razorpay-details">
          <div>
            <dt>Razorpay order ID</dt>
            <dd>{razorpayOrderId ?? "Not created"}</dd>
          </div>
          <div>
            <dt>Payment attempt ID</dt>
            <dd>{paymentAttemptId ?? "Not started"}</dd>
          </div>
          <div>
            <dt>Payment method</dt>
            <dd>{paymentMethod ?? "—"}</dd>
          </div>
          <div>
            <dt>Created at</dt>
            <dd>{createdAt ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="ac-ledger-section">
        <h3>Activity history</h3>

        <ol className="ac-audit-list">
          {auditEvents.map((event) => (
            <li className={`is-${event.tone}`} key={event.id}>
              <span className="ac-audit-icon">
                <AuditIcon tone={event.tone} />
              </span>

              <div>
                <strong>{event.title}</strong>
                <p>{event.detail}</p>
              </div>

              <time>
                {event.time}
                <span>{event.date}</span>
              </time>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}