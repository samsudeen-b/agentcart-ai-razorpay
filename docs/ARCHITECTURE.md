# Architecture and trust boundaries

## Runtime components

| Component | Responsibility | Trust level |
| --- | --- | --- |
| React workspace | Collect intent, show explanation, request approval | Untrusted client |
| Agent API | Convert intent into a catalog-only recommendation | Model output is untrusted |
| Policy validator | Check IDs, budget, item count and action ceiling | Trusted deterministic code |
| Checkout API | Recalculate amount and create order | Trusted server boundary |
| Razorpay test mode | Simulate the payment lifecycle | External payment boundary |
| Webhook endpoint | Verify signatures and accept supported outcomes | Trusted server boundary |
| Audit view | Explain what happened and why | Session-level observability |

## Money-action contract

An order can be created only if all conditions are true:

```text
customer_approved
AND 1 <= item_count <= 6
AND every item_id is allow-listed
AND quantity <= 3
AND recomputed_amount <= INR 20,000
```

Client-submitted prices are ignored. The server always recalculates the amount from its trusted catalog.

## Failure handling

- LLM output invalid: reject it and use the deterministic planner.
- LLM unavailable: continue in deterministic fallback mode.
- Checkout API unavailable: preserve the cart and show a clearly marked demo order.
- Payment authentication failure: stop immediately; never auto-retry.
- Bad webhook signature: return HTTP 401 without parsing the event as trusted.
- Unsupported event: acknowledge it as unhandled without changing state.

## Production extensions

- D1/PostgreSQL persistence for orders, event deduplication and audit records.
- Queue-backed webhook processing with exponential backoff.
- Merchant authentication, role-based policy configuration and rate limits.
- Consent and quiet-hour controls for recovery communication.
- Offline evaluation set for recommendation relevance and bundle acceptance.

