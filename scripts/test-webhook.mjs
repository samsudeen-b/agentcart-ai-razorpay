import { createHmac } from "node:crypto";
import { config } from "dotenv";

config({ path: ".env.local" });

async function testWebhook() {
  const body = JSON.stringify({
    event: "agentcart.test",
    payload: {},
  });

  const signature = createHmac(
    "sha256",
    process.env.RAZORPAY_WEBHOOK_SECRET,
  )
    .update(body)
    .digest("hex");

  const response = await fetch(
    "http://localhost:3000/api/webhooks/razorpay",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": signature,
      },
      body,
    },
  );

  console.log({
    status: response.status,
    result: await response.json(),
  });
}

testWebhook().catch(console.error);