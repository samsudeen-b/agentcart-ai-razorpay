import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

async function readSource(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("presents the AgentCart approval-first experience", async () => {
  const source = (
    await Promise.all([
      readSource("app/layout.tsx"),
      readSource("app/page.tsx"),
      readSource("components/agentcart/agentcart-header.tsx"),
      readSource("components/agentcart/conversation-panel.tsx"),
      readSource("components/agentcart/purchase-panel.tsx"),
    ])
  ).join("\n");

  assert.match(
    source,
    /AgentCart AI \| Bounded Commerce Agent/,
  );
  assert.match(
    source,
    /Commerce that asks before it acts\./,
  );
  assert.match(source, /Approve & Pay securely/);
  assert.match(source, /Razorpay Test Mode/);
  assert.match(source, /Explicit customer approval/);

  assert.doesNotMatch(
    source,
    /codex-preview|signin-with-chatgpt|oai-authenticated/i,
  );
});