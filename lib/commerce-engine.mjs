export const catalog = [
  { id: "echo-arc", name: "Echo Arc Pro", price: 8999, tags: ["audio", "travel", "desk", "anc", "premium"] },
  { id: "flux-mini", name: "Flux Mini", price: 4999, tags: ["audio", "portable", "gift", "speaker"] },
  { id: "nova-65", name: "Nova 65 GaN", price: 2199, tags: ["travel", "desk", "charger", "laptop"] },
  { id: "loom-stand", name: "Loom Stand", price: 1899, tags: ["desk", "headphones", "stand"] },
];

export function extractBudget(query) {
  const match = query.replaceAll(",", "").match(/(?:₹|rs\.?\s*)?(\d{3,6})/i);
  return match ? Number(match[1]) : 20_000;
}

export function rankCatalog(query) {
  const words = new Set(query.toLowerCase().split(/\W+/).filter(Boolean));
  return catalog.map((product) => ({
    ...product,
    score: product.tags.reduce((score, tag) => score + (words.has(tag) ? 1 : 0), 0),
  })).sort((left, right) => right.score - left.score || left.price - right.price);
}

export function enforceOrderPolicy({ approved, amountRupees, itemCount }) {
  if (!approved) return { allowed: false, reason: "explicit_approval_required" };
  if (itemCount < 1 || itemCount > 6) return { allowed: false, reason: "cart_size_out_of_bounds" };
  if (amountRupees > 20_000) return { allowed: false, reason: "amount_limit_exceeded" };
  return { allowed: true, reason: "policy_passed" };
}
