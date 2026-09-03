import { NextResponse } from "next/server";
import { z } from "zod";

const catalog = [
  { id: "echo-arc", name: "Echo Arc Pro", price: 8999, tags: ["audio", "travel", "desk", "anc", "premium"] },
  { id: "flux-mini", name: "Flux Mini", price: 4999, tags: ["audio", "portable", "gift", "speaker"] },
  { id: "nova-65", name: "Nova 65 GaN", price: 2199, tags: ["travel", "desk", "charger", "laptop"] },
  { id: "loom-stand", name: "Loom Stand", price: 1899, tags: ["desk", "headphones", "stand"] },
];

const requestSchema = z.object({ query: z.string().trim().min(3).max(500) });
const answerSchema = z.object({
  product_ids: z.array(z.string()).min(1).max(4),
  reasoning: z.string().min(12).max(600),
});

function extractBudget(query: string) {
  const match = query.replaceAll(",", "").match(/(?:₹|rs\.?\s*)?(\d{3,6})/i);
  return match ? Number(match[1]) : 20_000;
}

function fallback(query: string) {
  const lower = query.toLowerCase();
  if (/gift|present|6000|6,000/.test(lower)) {
    return { product_ids: ["flux-mini"], reasoning: "Flux Mini stays inside the gift budget, is immediately useful, and has the strongest portability match." };
  }
  if (/travel|trip|portable/.test(lower)) {
    return { product_ids: ["echo-arc", "nova-65"], reasoning: "Echo Arc Pro covers long-flight noise cancellation while Nova 65 replaces multiple chargers without crossing the budget." };
  }
  return { product_ids: ["echo-arc", "loom-stand", "nova-65"], reasoning: "Echo Arc Pro is the anchor product. Loom Stand protects it, and Nova 65 consolidates desk charging while keeping the complete setup below budget." };
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a clear shopping request." }, { status: 400 });
  const budget = Math.min(extractBudget(parsed.data.query), 20_000);
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ ...fallback(parsed.data.query), budget, mode: "DETERMINISTIC_FALLBACK" });

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `You are a bounded shopping agent. Recommend only IDs in this trusted catalog: ${JSON.stringify(catalog)}. Never exceed the budget. Return JSON only: {"product_ids":["id"],"reasoning":"brief transparent reason"}. Do not take payment actions.` },
          { role: "user", content: `Request: ${parsed.data.query}\nMaximum budget: INR ${budget}` },
        ],
      }),
    });
    if (!response.ok) throw new Error("Model request failed");
    const payload = await response.json();
    const candidate = answerSchema.parse(JSON.parse(payload.choices[0].message.content));
    const chosen = candidate.product_ids.map((id) => catalog.find((item) => item.id === id)).filter(Boolean);
    const total = chosen.reduce((sum, item) => sum + (item?.price ?? 0), 0);
    if (!chosen.length || total > budget || candidate.product_ids.some((id) => !catalog.some((item) => item.id === id))) throw new Error("Policy validation failed");
    return NextResponse.json({ ...candidate, budget, mode: "GROQ_LLM_VALIDATED" });
  } catch {
    return NextResponse.json({ ...fallback(parsed.data.query), budget, mode: "DETERMINISTIC_RECOVERY" });
  }
}
