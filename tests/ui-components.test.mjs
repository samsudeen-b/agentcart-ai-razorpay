import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

async function readSource(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("contains eight trusted catalog products", async () => {
  const catalog = await readSource("lib/catalog.ts");

  const productIds = [
    "echo-arc-pro",
    "flux-mini",
    "nova-65-gan",
    "loom-stand",
    "wave-buds",
    "pulse-watch",
    "volt-cable-c",
    "carry-case",
  ];

  for (const productId of productIds) {
    assert.match(catalog, new RegExp(`id: "${productId}"`));
    assert.match(
      catalog,
      new RegExp(`/products/${productId}\\.png`),
    );
  }

  assert.equal(
    (catalog.match(/\n    id: "/g) ?? []).length,
    8,
  );
});

test("includes responsive checkout and failure interfaces", async () => {
  const css = await readSource("app/agentcart.css");
  const scenarios = await readSource(
    "components/agentcart/demo-scenarios.tsx",
  );

  assert.match(css, /\.ac-approve-payment/);
  assert.match(css, /\.ac-checkout-error/);
  assert.match(css, /@media/);

  assert.match(scenarios, /inventory_change/);
  assert.match(scenarios, /duplicate_approval/);
  assert.match(scenarios, /payment_failure/);
  assert.match(scenarios, /invalid_parameter/);
});

test("keeps payment actions server-controlled and idempotent", async () => {
  const checkout = await readSource(
    "app/api/checkout/route.ts",
  );
  const verification = await readSource(
    "app/api/payments/verify/route.ts",
  );
  const webhook = await readSource(
    "app/api/webhooks/razorpay/route.ts",
  );
  const agent = await readSource(
    "app/api/agent/route.ts",
  );

  assert.match(checkout, /approved: z\.literal\(true\)/);
  assert.match(checkout, /approvalConfirmed: true/);
  assert.match(checkout, /onConflictDoNothing/);
  assert.match(checkout, /IDEMPOTENT_REUSE/);
  assert.match(checkout, /status_unknown/);

  assert.match(
    verification,
    /verifyRazorpayPaymentSignature/,
  );
  assert.match(verification, /client\.payments\.fetch/);

  assert.match(webhook, /timingSafeEqual/);
  assert.match(webhook, /payment\.captured/);
  assert.match(webhook, /payment\.failed/);
  assert.match(webhook, /onConflictDoNothing/);

  assert.match(agent, /\.from\(checkoutOrders\)/);
  assert.match(agent, /VERIFIED_STATE_HANDLER/);
});
