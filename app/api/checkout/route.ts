import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import { auditEvents, checkoutOrders } from "@/db/schema";
import { PRODUCTS } from "@/lib/catalog";
import { getRazorpayClient } from "@/lib/razorpay";

export const runtime = "nodejs";

const checkoutSchema = z.object({
  approved: z.literal(true),
  proposalId: z.string().trim().min(3).max(100),
  proposalVersion: z.number().int().positive(),
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1),
        quantity: z.number().int().min(1).max(3),
      }),
    )
    .min(1)
    .max(8),
});

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function POST(request: Request) {
  const parsed = checkoutSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "A valid proposal and explicit customer approval are required.",
      },
      { status: 400 },
    );
  }

  const normalizedItems = [];

  for (const line of parsed.data.items) {
    const product = PRODUCTS.find(
      (catalogProduct) => catalogProduct.id === line.productId,
    );

    if (!product) {
      return NextResponse.json(
        { error: `Unknown product: ${line.productId}` },
        { status: 400 },
      );
    }

    if (line.quantity > product.stock) {
      return NextResponse.json(
        {
          error: `${product.name} no longer has enough stock. Review the cart again.`,
        },
        { status: 409 },
      );
    }

    normalizedItems.push({
      productId: product.id,
      name: product.name,
      quantity: line.quantity,
      unitPricePaise: product.pricePaise,
      lineTotalPaise: product.pricePaise * line.quantity,
    });
  }

  normalizedItems.sort((a, b) =>
    a.productId.localeCompare(b.productId),
  );

  const amountPaise = normalizedItems.reduce(
    (total, item) => total + item.lineTotalPaise,
    0,
  );

  if (amountPaise > 2_000_000) {
    return NextResponse.json(
      { error: "The proposal exceeds the INR 20,000 action limit." },
      { status: 403 },
    );
  }

  const proposalKey =
    `${parsed.data.proposalId}:v${parsed.data.proposalVersion}`;

  const cartHash = sha256(JSON.stringify(normalizedItems));
  const receipt = `ac_${sha256(proposalKey).slice(0, 24)}`;

  let razorpay;

  try {
    razorpay = getRazorpayClient();
  } catch {
    return NextResponse.json(
      { error: "Razorpay Test Mode is not configured correctly." },
      { status: 503 },
    );
  }

  const db = getDb();

  const [claimedOrder] = await db
    .insert(checkoutOrders)
    .values({
      proposalKey,
      proposalId: parsed.data.proposalId,
      proposalVersion: parsed.data.proposalVersion,
      cartHash,
      items: normalizedItems,
      amountPaise,
      currency: "INR",
      receipt,
      status: "creating",
      approvalConfirmed: true,
      mode: "RAZORPAY_TEST",
    })
    .onConflictDoNothing({
      target: checkoutOrders.proposalKey,
    })
    .returning();

  if (!claimedOrder) {
    const [existingOrder] = await db
      .select()
      .from(checkoutOrders)
      .where(eq(checkoutOrders.proposalKey, proposalKey))
      .limit(1);

    if (!existingOrder) {
      return NextResponse.json(
        { error: "The existing checkout could not be verified." },
        { status: 409 },
      );
    }

    if (existingOrder.cartHash !== cartHash) {
      return NextResponse.json(
        {
          error:
            "The cart changed without a new proposal version. Review it again before approving.",
        },
        { status: 409 },
      );
    }

    if (existingOrder.razorpayOrderId) {
      return NextResponse.json({
        mode: "IDEMPOTENT_REUSE",
        keyId: razorpay.keyId,
        duplicatePrevented: true,
        order: {
          id: existingOrder.razorpayOrderId,
          amount: existingOrder.amountPaise,
          currency: existingOrder.currency,
          receipt: existingOrder.receipt,
          status: existingOrder.status,
        },
      });
    }

    return NextResponse.json(
      {
        mode: "ORDER_STATUS_UNKNOWN",
        duplicatePrevented: true,
        proposalKey,
        message:
          "An order request already exists. Its status must be verified before another attempt.",
      },
      { status: 202 },
    );
  }

  await db.insert(auditEvents).values({
    proposalKey,
    eventType: "checkout_claimed",
    detail: {
      amountPaise,
      receipt,
      approvalConfirmed: true,
    },
  });

  try {
    const order = await razorpay.client.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes: {
        source: "agentcart-ai",
        proposal_key: proposalKey,
        approval: "explicit",
      },
    });

    await db
      .update(checkoutOrders)
      .set({
        razorpayOrderId: order.id,
        status: "created",
        updatedAt: new Date(),
      })
      .where(eq(checkoutOrders.id, claimedOrder.id));

    await db.insert(auditEvents).values({
      proposalKey,
      eventType: "razorpay_order_created",
      detail: {
        razorpayOrderId: order.id,
        amountPaise,
        receipt,
      },
    });

    return NextResponse.json(
      {
        mode: "RAZORPAY_TEST",
        keyId: razorpay.keyId,
        duplicatePrevented: false,
        order,
      },
      { status: 201 },
    );
  } catch {
    await db
      .update(checkoutOrders)
      .set({
        status: "status_unknown",
        updatedAt: new Date(),
      })
      .where(eq(checkoutOrders.id, claimedOrder.id));

    await db.insert(auditEvents).values({
      proposalKey,
      eventType: "razorpay_order_status_unknown",
      detail: {
        receipt,
        recovery:
          "Blocked automatic retry until the existing request is reconciled.",
      },
    });

    return NextResponse.json(
      {
        error:
          "The Razorpay response was not confirmed. Automatic retry was blocked to prevent a duplicate order.",
        status: "status_unknown",
        proposalKey,
      },
      { status: 502 },
    );
  }
}