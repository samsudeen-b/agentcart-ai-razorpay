import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import {
  auditEvents,
  checkoutOrders,
  paymentAttempts,
} from "@/db/schema";
import {
  getRazorpayClient,
  verifyRazorpayPaymentSignature,
} from "@/lib/razorpay";

export const runtime = "nodejs";

const verificationSchema = z.object({
  razorpay_order_id: z.string().trim().min(3).max(100),
  razorpay_payment_id: z.string().trim().min(3).max(100),
  razorpay_signature: z.string().trim().min(32).max(500),
});

export async function POST(request: Request) {
  const parsed = verificationSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payment-verification response." },
      { status: 400 },
    );
  }

  const {
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
  } = parsed.data;

  const db = getDb();

  const [checkoutOrder] = await db
    .select()
    .from(checkoutOrders)
    .where(eq(checkoutOrders.razorpayOrderId, orderId))
    .limit(1);

  if (!checkoutOrder) {
    return NextResponse.json(
      { error: "The Razorpay order is not linked to this application." },
      { status: 404 },
    );
  }

  const signatureValid = verifyRazorpayPaymentSignature({
    orderId,
    paymentId,
    signature,
  });

  if (!signatureValid) {
    await db.insert(auditEvents).values({
      proposalKey: checkoutOrder.proposalKey,
      eventType: "payment_signature_rejected",
      detail: {
        orderId,
        paymentId,
        reason: "HMAC signature mismatch",
      },
    });

    return NextResponse.json(
      { error: "Payment signature verification failed." },
      { status: 400 },
    );
  }

  try {
    const { client } = getRazorpayClient();
    const fetchedPayment = await client.payments.fetch(paymentId);

    const payment = fetchedPayment as unknown as {
      order_id?: string;
      status?: string;
      method?: string;
      error_code?: string;
      error_description?: string;
    };

    if (payment.order_id !== orderId) {
      return NextResponse.json(
        { error: "The payment belongs to a different Razorpay order." },
        { status: 400 },
      );
    }

    const paymentStatus =
      payment.status === "captured"
        ? "captured"
        : payment.status === "authorized"
          ? "authorized"
          : payment.status === "failed"
            ? "failed"
            : payment.status === "refunded"
              ? "refunded"
              : "pending";

    const checkoutStatus =
      paymentStatus === "captured"
        ? "paid"
        : paymentStatus === "failed"
          ? "failed"
          : "created";

    await db
      .insert(paymentAttempts)
      .values({
        checkoutOrderId: checkoutOrder.id,
        razorpayPaymentId: paymentId,
        status: paymentStatus,
        failureCode: payment.error_code,
        failureDescription: payment.error_description,
      })
      .onConflictDoUpdate({
        target: paymentAttempts.razorpayPaymentId,
        set: {
          status: paymentStatus,
          failureCode: payment.error_code,
          failureDescription: payment.error_description,
          updatedAt: new Date(),
        },
      });

    await db
      .update(checkoutOrders)
      .set({
        status: checkoutStatus,
        updatedAt: new Date(),
      })
      .where(eq(checkoutOrders.id, checkoutOrder.id));

    await db.insert(auditEvents).values({
      proposalKey: checkoutOrder.proposalKey,
      eventType: "payment_verified",
      detail: {
        orderId,
        paymentId,
        paymentStatus,
        paymentMethod: payment.method,
      },
    });

    return NextResponse.json({
      verified: true,
      paid: paymentStatus === "captured",
      orderId,
      paymentId,
      paymentStatus,
      paymentMethod: payment.method,
    });
  } catch {
    await db
      .update(checkoutOrders)
      .set({
        status: "status_unknown",
        updatedAt: new Date(),
      })
      .where(eq(checkoutOrders.id, checkoutOrder.id));

    return NextResponse.json(
      {
        error:
          "The payment response was signed correctly, but its current status could not be fetched. No success is being claimed.",
        status: "status_unknown",
      },
      { status: 502 },
    );
  }
}