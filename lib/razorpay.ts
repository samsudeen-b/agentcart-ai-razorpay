import "server-only";

import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import Razorpay from "razorpay";

function getTestCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Razorpay Test Mode credentials are not configured.");
  }

  if (!keyId.startsWith("rzp_test_")) {
    throw new Error("Only Razorpay Test Mode credentials are allowed.");
  }

  return {
    keyId,
    keySecret,
  };
}

export function getRazorpayClient() {
  const { keyId, keySecret } = getTestCredentials();

  return {
    keyId,
    client: new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    }),
  };
}

export function verifyRazorpayPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const { keySecret } = getTestCredentials();

  const expectedSignature = createHmac("sha256", keySecret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const receivedBuffer = Buffer.from(input.signature, "utf8");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}