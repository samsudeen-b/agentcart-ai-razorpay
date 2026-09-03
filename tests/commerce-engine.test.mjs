import assert from "node:assert/strict";
import test from "node:test";
import { enforceOrderPolicy, extractBudget, rankCatalog } from "../lib/commerce-engine.mjs";

test("extracts an Indian Rupee budget", () => {
  assert.equal(extractBudget("Build a setup under ₹15,000"), 15000);
});

test("ranks matching catalog items deterministically", () => {
  assert.equal(rankCatalog("portable audio gift")[0].id, "flux-mini");
});

test("blocks every unapproved money action", () => {
  assert.deepEqual(enforceOrderPolicy({ approved: false, amountRupees: 8999, itemCount: 1 }), {
    allowed: false, reason: "explicit_approval_required",
  });
});

test("blocks orders above the bounded amount", () => {
  assert.equal(enforceOrderPolicy({ approved: true, amountRupees: 25000, itemCount: 2 }).allowed, false);
});

test("allows an approved order within all limits", () => {
  assert.equal(enforceOrderPolicy({ approved: true, amountRupees: 13097, itemCount: 3 }).allowed, true);
});
