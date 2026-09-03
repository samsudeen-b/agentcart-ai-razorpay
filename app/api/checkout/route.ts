import { NextResponse } from "next/server";
import { z } from "zod";

const trustedCatalog: Record<string, number> = {
  "echo-arc": 8999,
  "flux-mini": 4999,
  "nova-65": 2199,
  "loom-stand": 1899,
};

const checkoutSchema = z.object({
  approved: z.literal(true),
  items: z.array(z.object({
    id: z.string().refine((id) => id in trustedCatalog, "Unknown catalog item"),
    quantity: z.number().int().min(1).max(3),
  })).min(1).max(6),
});

function demoOrder(amount: number, receipt: string) {
  return {
    id: `order_demo_${crypto.randomUUID().replaceAll("-", "").slice(0, 14)}`,
    entity: "order",
    amount,
    amount_paid: 0,
    amount_due: amount,
    currency: "INR",
    receipt,
    status: "created",
  };
}

export async function POST(request: Request) {
  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid cart and explicit customer approval are required." }, { status: 400 });
  }

  const totalRupees = parsed.data.items.reduce(
    (sum, item) => sum + trustedCatalog[item.id] * item.quantity,
    0,
  );
  if (totalRupees > 20_000) {
    return NextResponse.json({ error: "The order exceeds the agent's ₹20,000 action limit." }, { status: 403 });
  }

  const amount = totalRupees * 100;
  const receipt = `agentcart_${crypto.randomUUID().slice(0, 12)}`;
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return NextResponse.json({ mode: "DEMO", order: demoOrder(amount, receipt) });
  }

  const authorization = btoa(`${keyId}:${keySecret}`);
  const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount, currency: "INR", receipt, notes: { source: "agentcart-ai", approval: "explicit" } }),
  });

  if (!razorpayResponse.ok) {
    return NextResponse.json({ error: "Razorpay test order creation failed." }, { status: 502 });
  }
  const order = await razorpayResponse.json();
  return NextResponse.json({ mode: "RAZORPAY_TEST", keyId, order });
}
