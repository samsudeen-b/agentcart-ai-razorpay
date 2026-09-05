import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import {
  auditEvents,
  checkoutOrders,
  paymentAttempts,
  webhookEvents,
} from "@/db/schema";

export const runtime = "nodejs";

type RazorpayWebhook = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        status?: string;
        method?: string;
        error_code?: string;
        error_description?: string;
      };
    };
    order?: {
      entity?: {
        id?: string;
        status?: string;
      };
    };
  };
};

function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string,
): boolean {
  const expected = createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(signature, "utf8");

  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "Webhook secret is not configured." },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signature =
    request.headers.get("x-razorpay-signature") ?? "";

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json(
      { error: "Invalid webhook signature." },
      { status: 401 },
    );
  }

  let payload: RazorpayWebhook;

  try {
    payload = JSON.parse(rawBody) as RazorpayWebhook;
  } catch {
    return NextResponse.json(
      { error: "Invalid webhook JSON." },
      { status: 400 },
    );
  }

  const eventType = payload.event ?? "unknown";
  const eventHash = createHash("sha256")
    .update(rawBody)
    .digest("hex");

  const db = getDb();

  const [newEvent] = await db
    .insert(webhookEvents)
    .values({
      eventHash,
      eventType,
      payload,
      signatureValid: true,
      processed: false,
    })
    .onConflictDoNothing({
      target: webhookEvents.eventHash,
    })
    .returning();

  if (!newEvent) {
    const [existingEvent] = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.eventHash, eventHash))
      .limit(1);

    if (existingEvent?.processed) {
      return NextResponse.json({
        accepted: true,
        duplicate: true,
        event: eventType,
      });
    }
  }

  const supportedEvents = [
    "payment.captured",
    "payment.failed",
    "order.paid",
  ];

  if (!supportedEvents.includes(eventType)) {
    await db
      .update(webhookEvents)
      .set({ processed: true })
      .where(eq(webhookEvents.eventHash, eventHash));

    return NextResponse.json({
      accepted: false,
      event: eventType,
    });
  }

  const payment = payload.payload?.payment?.entity;
  const orderEntity = payload.payload?.order?.entity;
  const orderId = payment?.order_id ?? orderEntity?.id;

  if (!orderId) {
    await db
      .update(webhookEvents)
      .set({ processed: true })
      .where(eq(webhookEvents.eventHash, eventHash));

    return NextResponse.json({
      accepted: true,
      linked: false,
      event: eventType,
    });
  }

  const [checkoutOrder] = await db
    .select()
    .from(checkoutOrders)
    .where(eq(checkoutOrders.razorpayOrderId, orderId))
    .limit(1);

  if (!checkoutOrder) {
    await db
      .update(webhookEvents)
      .set({ processed: true })
      .where(eq(webhookEvents.eventHash, eventHash));

    return NextResponse.json({
      accepted: true,
      linked: false,
      event: eventType,
    });
  }

  const paymentId = payment?.id;

  if (paymentId) {
    const paymentStatus =
      eventType === "payment.captured"
        ? "captured"
        : eventType === "payment.failed"
          ? "failed"
          : "pending";

    await db
      .insert(paymentAttempts)
      .values({
        checkoutOrderId: checkoutOrder.id,
        razorpayPaymentId: paymentId,
        status: paymentStatus,
        failureCode: payment?.error_code ?? null,
        failureDescription: payment?.error_description ?? null,
      })
      .onConflictDoUpdate({
        target: paymentAttempts.razorpayPaymentId,
        set: {
          status: paymentStatus,
          failureCode: payment?.error_code ?? null,
          failureDescription: payment?.error_description ?? null,
          updatedAt: new Date(),
        },
      });
  }

  const checkoutStatus =
    eventType === "payment.failed"
      ? checkoutOrder.status === "paid"
        ? "paid"
        : "failed"
      : "paid";

  await db
    .update(checkoutOrders)
    .set({
      status: checkoutStatus,
      updatedAt: new Date(),
    })
    .where(eq(checkoutOrders.id, checkoutOrder.id));

  await db.insert(auditEvents).values({
    proposalKey: checkoutOrder.proposalKey,
    eventType: `webhook_${eventType.replace(".", "_")}`,
    detail: {
      orderId,
      paymentId: paymentId ?? null,
      paymentMethod: payment?.method ?? null,
      failureCode: payment?.error_code ?? null,
      failureDescription: payment?.error_description ?? null,
    },
  });

  await db
    .update(webhookEvents)
    .set({ processed: true })
    .where(eq(webhookEvents.eventHash, eventHash));

  return NextResponse.json({
    accepted: true,
    processed: true,
    event: eventType,
    orderId,
  });
}