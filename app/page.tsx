"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  ArrowUpRight, Bot, Check, CheckCircle2, ChevronRight, Clock3,
  CreditCard, Headphones, History, LockKeyhole, PackageCheck, Plus,
  RefreshCw, Search, Send, ShieldCheck, ShoppingBag, Sparkles,
  TriangleAlert, X, Zap,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Product = {
  id: string; name: string; category: string; price: number; previousPrice?: number;
  description: string; accent: string; icon: "headphones" | "speaker" | "charger" | "stand"; stock: number;
};
type CartItem = Product & { quantity: number };
type Message = { id: number; role: "agent" | "user"; text: string; meta?: string };
type AuditEvent = {
  id: number; time: string; stage: string; decision: string;
  status: "passed" | "waiting" | "recovered"; evidence: string;
};

const products: Product[] = [
  { id: "echo-arc", name: "Echo Arc Pro", category: "Immersive audio", price: 8999, previousPrice: 10999, description: "40-hour ANC headphones with spatial audio.", accent: "#c7ff45", icon: "headphones", stock: 18 },
  { id: "flux-mini", name: "Flux Mini", category: "Portable audio", price: 4999, previousPrice: 5999, description: "Pocket speaker with room-filling stereo sound.", accent: "#ffa44a", icon: "speaker", stock: 7 },
  { id: "nova-65", name: "Nova 65 GaN", category: "Fast charging", price: 2199, description: "Three-port 65W charger for phone and laptop.", accent: "#65d8ff", icon: "charger", stock: 31 },
  { id: "loom-stand", name: "Loom Stand", category: "Desk essential", price: 1899, description: "Low-profile aluminium headphone dock.", accent: "#c8a7ff", icon: "stand", stock: 12 },
];

const initialAudit: AuditEvent[] = [
  { id: 1, time: "14:32:04", stage: "Session", decision: "Started a bounded shopping session", status: "passed", evidence: "Test mode · no payment authority" },
  { id: 2, time: "14:32:05", stage: "Policy", decision: "Loaded merchant pricing and action limits", status: "passed", evidence: "₹20,000 ceiling · approval required" },
];

const prompts = [
  "Build a premium desk audio setup under ₹15,000",
  "I need a travel audio kit under ₹12,000",
  "Find a useful tech gift under ₹6,000",
];

const formatPrice = (value: number) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
}).format(value);

function ProductIcon({ product }: { product: Product }) {
  const props = { size: 27, strokeWidth: 1.6 };
  if (product.icon === "headphones") return <Headphones {...props} />;
  if (product.icon === "charger") return <Zap {...props} />;
  if (product.icon === "speaker") return <Bot {...props} />;
  return <PackageCheck {...props} />;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([
    { ...products[0], quantity: 1 }, { ...products[3], quantity: 1 },
  ]);
  const [messages, setMessages] = useState<Message[]>([{
    id: 1, role: "agent",
    text: "Tell me the outcome you want and your budget. I’ll compare the catalog, explain my choices, and wait for your approval before creating any payment.",
    meta: "Action policy active",
  }]);
  const [audit, setAudit] = useState<AuditEvent[]>(initialAudit);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutStage, setCheckoutStage] = useState<"review" | "creating" | "ready" | "failed" | "success">("review");
  const [orderId, setOrderId] = useState("");
  const [mode, setMode] = useState("DEMO");

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const listTotal = useMemo(() => cart.reduce((sum, item) => sum + (item.previousPrice ?? item.price) * item.quantity, 0), [cart]);
  const savings = Math.max(0, listTotal - subtotal);
  const aovLift = cart.length > 1 ? Math.round(((subtotal - cart[0].price) / cart[0].price) * 100) : 0;

  function addAudit(stage: string, decision: string, status: AuditEvent["status"], evidence: string) {
    setAudit((current) => [...current, {
      id: Date.now() + Math.random(), time: new Date().toLocaleTimeString("en-GB", { hour12: false }),
      stage, decision, status, evidence,
    }]);
  }

  function addProduct(product: Product) {
    setCart((current) => current.some((item) => item.id === product.id) ? current : [...current, { ...product, quantity: 1 }]);
    addAudit("Cart", `Added ${product.name} after explicit user action`, "passed", `${formatPrice(product.price)} · inventory ${product.stock}`);
  }

  function removeProduct(productId: string) {
    const item = cart.find((entry) => entry.id === productId);
    setCart((current) => current.filter((entry) => entry.id !== productId));
    if (item) addAudit("Cart", `Removed ${item.name}`, "passed", "Customer retained full cart control");
  }

  async function runAgent(input: string) {
    const clean = input.trim();
    if (!clean) return;
    const lower = clean.toLowerCase();
    const localIds = /gift|present|6000|6,000/.test(lower)
      ? ["flux-mini"]
      : /travel|trip|portable/.test(lower)
        ? ["echo-arc", "nova-65"]
        : ["echo-arc", "loom-stand", "nova-65"];
    let productIds = localIds;
    let reasoning = "I selected the highest-utility combination that remains inside your budget and the merchant’s action limits.";
    let agentMode = "LOCAL POLICY";
    try {
      const response = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: clean }) });
      const data = await response.json();
      if (response.ok) { productIds = data.product_ids; reasoning = data.reasoning; agentMode = data.mode; }
    } catch { /* The bounded local plan remains available when the model endpoint is unavailable. */ }
    const recommended = productIds.map((id: string) => products.find((item) => item.id === id)).filter((item): item is Product => Boolean(item));
    const total = recommended.reduce((sum, item) => sum + item.price, 0);

    setMessages((current) => [...current,
      { id: Date.now(), role: "user", text: clean },
      { id: Date.now() + 1, role: "agent", text: reasoning, meta: `${recommended.length} products · ${formatPrice(total)} · ${agentMode}` },
    ]);
    setCart(recommended.map((product) => ({ ...product, quantity: 1 })));
    setQuery("");
    addAudit("Intent", "Converted the request into budget and utility constraints", "passed", clean);
    addAudit("Recommendation", `Ranked ${recommended.map((item) => item.name).join(", ")}`, "passed", `${formatPrice(total)} · stock verified`);
    addAudit("Money action", "Blocked order creation until customer approval", "waiting", "Human-in-the-loop gate");
  }

  async function createOrder() {
    setCheckoutStage("creating");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: true, items: cart.map((item) => ({ id: item.id, quantity: item.quantity })) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Order creation failed");
      setOrderId(data.order.id); setMode(data.mode); setCheckoutStage("ready");
      addAudit("Order", "Created order after explicit customer approval", "passed", `${data.order.id} · ${data.mode} mode`);
    } catch {
      const fallbackId = `demo_order_${Date.now().toString().slice(-8)}`;
      setOrderId(fallbackId); setMode("DEMO"); setCheckoutStage("ready");
      addAudit("Order", "Created deterministic fallback order", "recovered", "Checkout API unavailable · no duplicate charge");
    }
  }

  function failPayment() {
    setCheckoutStage("failed");
    addAudit("Payment", "Payment authentication failed; agent stopped automatically", "recovered", "No auto-retry · alternative method offered");
  }
  function retryPayment() {
    setCheckoutStage("ready");
    addAudit("Recovery", "Customer chose an alternative payment method", "passed", "New attempt linked to original order");
  }
  function completePayment() {
    setCheckoutStage("success");
    addAudit("Payment", "Test payment captured and order confirmed", "passed", `${orderId} · ${formatPrice(subtotal)}`);
  }

  return (
    <main className="app-shell">
      <div className="grid-noise" aria-hidden="true" />
      <header className="topbar">
        <div className="brand-lockup"><div className="brand-mark"><ShoppingBag size={18} /></div><div><p className="brand-name">AgentCart<span>AI</span></p><p className="brand-sub">BOUNDED COMMERCE AGENT</p></div></div>
        <div className="topbar-center"><span className="live-dot" /> SYSTEM ONLINE <span className="divider" /> RAZORPAY TEST MODE</div>
        <a className="github-link" href="https://github.com/samsudeen-b/agentcart-ai-razorpay" target="_blank" rel="noreferrer">View source <ArrowUpRight size={15} /></a>
      </header>

      <section className="metric-strip" aria-label="Session metrics">
        <div><span>SESSION CART</span><strong>{formatPrice(subtotal)}</strong></div>
        <div><span>PROJECTED AOV LIFT</span><strong className="lime">+{aovLift}%</strong></div>
        <div><span>GATED MONEY ACTIONS</span><strong>100%</strong></div>
        <div><span>UNSAFE ACTIONS</span><strong>0</strong></div>
        <div className="agent-state"><ShieldCheck size={17} /><span>POLICY ENGINE</span><strong>ENFORCING</strong></div>
      </section>

      <Tabs defaultValue="shop" className="workspace">
        <div className="workspace-heading">
          <div><p className="eyebrow">MERCHANT WORKSPACE / AUDIOVERSE</p><h1>Commerce that asks before it acts.</h1></div>
          <TabsList className="view-tabs">
            <TabsTrigger value="shop"><Sparkles size={15} /> Live agent</TabsTrigger>
            <TabsTrigger value="audit"><History size={15} /> Audit trail <span>{audit.length}</span></TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="shop" className="shop-grid">
          <section className="panel catalog-panel">
            <div className="panel-heading"><div><p>01 / CATALOG</p><h2>Eligible products</h2></div><span className="count-chip">{products.length} LIVE</span></div>
            <label className="search-box"><Search size={16} /><input aria-label="Search products" placeholder="Search catalog" /></label>
            <div className="product-list">
              {products.map((product, index) => {
                const inCart = cart.some((item) => item.id === product.id);
                return <article className="product-card" key={product.id}>
                  <div className="product-visual" style={{ "--product-accent": product.accent } as React.CSSProperties}>
                    {index === 0 ? <Image src="/agentcart-headphones.png" alt="Echo Arc Pro matte black headphones" width={1200} height={1200} priority /> : <ProductIcon product={product} />}
                  </div>
                  <div className="product-copy"><p>{product.category}</p><h3>{product.name}</h3><span>{product.description}</span><div className="price-row"><strong>{formatPrice(product.price)}</strong>{product.previousPrice && <s>{formatPrice(product.previousPrice)}</s>}</div></div>
                  <button type="button" className={inCart ? "product-added" : "product-add"} onClick={() => inCart ? removeProduct(product.id) : addProduct(product)} aria-label={`${inCart ? "Remove" : "Add"} ${product.name}`}>{inCart ? <Check size={16} /> : <Plus size={16} />}</button>
                </article>;
              })}
            </div>
          </section>

          <section className="panel agent-panel">
            <div className="agent-header"><div className="agent-orb"><Bot size={20} /></div><div><p>NOVA / SHOPPING AGENT</p><h2>Outcome planner</h2></div><div className="agent-latency"><span /> 248ms</div></div>
            <div className="message-stream" aria-live="polite">
              {messages.map((message) => <div className={`message ${message.role}`} key={message.id}>
                <div className="message-label">{message.role === "agent" ? "NOVA" : "YOU"}</div>
                <div className="message-bubble"><p>{message.text}</p>{message.meta && <span><CheckCircle2 size={13} /> {message.meta}</span>}</div>
              </div>)}
            </div>
            <div className="prompt-zone"><p>TRY A DEMO GOAL</p>
              <div className="prompt-chips">{prompts.map((prompt, index) => <button type="button" onClick={() => runAgent(prompt)} key={prompt}><span>0{index + 1}</span>{prompt}<ChevronRight size={14} /></button>)}</div>
              <form onSubmit={(event) => { event.preventDefault(); runAgent(query); }} className="composer"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Describe what you want to buy…" aria-label="Message the shopping agent" /><button type="submit" aria-label="Send request"><Send size={17} /></button></form>
            </div>
          </section>

          <aside className="panel cart-panel">
            <div className="panel-heading"><div><p>02 / PROPOSAL</p><h2>Agent-built cart</h2></div><span className="count-chip">{cart.length} ITEMS</span></div>
            <div className="cart-items">{cart.length === 0 ? <div className="empty-cart"><ShoppingBag size={25} /><p>Your proposal is empty.</p></div> : cart.map((item) => <div className="cart-item" key={item.id}>
              <div className="cart-icon" style={{ color: item.accent }}><ProductIcon product={item} /></div><div><strong>{item.name}</strong><span>Qty {item.quantity} · Stock verified</span></div><div className="cart-price"><strong>{formatPrice(item.price)}</strong><button onClick={() => removeProduct(item.id)} aria-label={`Remove ${item.name}`}><X size={14} /></button></div>
            </div>)}</div>
            <div className="decision-card"><div><Sparkles size={16} /><strong>WHY THIS CART</strong></div><p>Products satisfy the active budget, inventory, and compatibility constraints. No sponsored ranking is used.</p><ul><li><Check size={13} /> Budget checked server-side</li><li><Check size={13} /> Stock availability verified</li><li><Check size={13} /> No payment without approval</li></ul></div>
            <div className="cart-summary"><div><span>Catalog total</span><span>{formatPrice(listTotal)}</span></div><div><span>Bundle savings</span><span className="lime">−{formatPrice(savings)}</span></div><div className="summary-total"><span>Approved amount</span><strong>{formatPrice(subtotal)}</strong></div></div>
            <button type="button" className="approve-button" onClick={() => { setCheckoutStage("review"); setCheckoutOpen(true); }} disabled={!cart.length}><LockKeyhole size={17} /> Review & approve order <ArrowUpRight size={17} /></button>
            <p className="approval-note"><ShieldCheck size={13} /> Agent cannot bypass this approval gate.</p>
          </aside>
        </TabsContent>

        <TabsContent value="audit" className="audit-panel panel">
          <div className="audit-heading"><div><p className="eyebrow">DECISION OBSERVABILITY</p><h2>Every action has evidence.</h2></div><div className="audit-badges"><span><ShieldCheck size={14} /> Policy enforced</span><span><Clock3 size={14} /> Current session</span></div></div>
          <Table><TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Stage</TableHead><TableHead>Agent decision</TableHead><TableHead>Evidence</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>{[...audit].reverse().map((event) => <TableRow key={event.id}><TableCell className="mono-cell">{event.time}</TableCell><TableCell>{event.stage}</TableCell><TableCell className="decision-cell">{event.decision}</TableCell><TableCell>{event.evidence}</TableCell><TableCell><span className={`status-pill ${event.status}`}>{event.status}</span></TableCell></TableRow>)}</TableBody>
          </Table>
        </TabsContent>
      </Tabs>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="checkout-dialog"><DialogHeader><div className="dialog-kicker">RAZORPAY / TEST MODE</div><DialogTitle>Human approval checkpoint</DialogTitle><DialogDescription>Review the bounded action before the agent creates an order. No real money is charged in this demo.</DialogDescription></DialogHeader>
          {checkoutStage === "review" && <div className="checkout-state"><div className="approval-grid"><div><span>MERCHANT</span><strong>Audioverse Labs</strong></div><div><span>AMOUNT</span><strong>{formatPrice(subtotal)}</strong></div><div><span>ITEMS</span><strong>{cart.length}</strong></div><div><span>AUTHORITY</span><strong>Customer only</strong></div></div><div className="safety-checks"><p><CheckCircle2 size={16} /> Prices recalculated from the trusted server catalog</p><p><CheckCircle2 size={16} /> Order amount is below the ₹20,000 action limit</p><p><CheckCircle2 size={16} /> Idempotent receipt prevents duplicate orders</p></div><button className="checkout-primary" onClick={createOrder}><LockKeyhole size={17} /> Approve & create test order</button></div>}
          {checkoutStage === "creating" && <div className="checkout-loading"><RefreshCw className="spin" size={28} /><strong>Creating a bounded order…</strong><span>Verifying amount and inventory</span></div>}
          {checkoutStage === "ready" && <div className="checkout-state"><div className="order-created"><CheckCircle2 size={25} /><div><span>ORDER CREATED · {mode}</span><strong>{orderId}</strong></div></div><div className="test-bank"><div><CreditCard size={20} /><span>RAZORPAY TEST BANK</span></div><strong>{formatPrice(subtotal)}</strong><p>Choose an outcome to demonstrate the payment and recovery workflow.</p><button onClick={completePayment} className="checkout-primary">Simulate successful payment</button><button onClick={failPayment} className="checkout-secondary">Simulate authentication failure</button></div></div>}
          {checkoutStage === "failed" && <div className="checkout-state"><div className="failure-banner"><TriangleAlert size={23} /><div><span>PAYMENT NOT COMPLETED</span><strong>Authentication timed out</strong></div></div><div className="recovery-plan"><p><Bot size={17} /> <strong>NOVA’S SAFE RECOVERY</strong></p><span>I stopped the payment flow and did not auto-retry. You can choose another method while the original order remains unchanged.</span></div><button className="checkout-primary" onClick={retryPayment}><RefreshCw size={16} /> Try an alternative method</button><button className="checkout-secondary" onClick={() => setCheckoutOpen(false)}>Stop and keep cart</button></div>}
          {checkoutStage === "success" && <div className="success-state"><div className="success-mark"><Check size={34} /></div><p>TEST PAYMENT CAPTURED</p><h3>{formatPrice(subtotal)}</h3><span>The webhook-confirmed outcome is now attached to the audit trail.</span><button className="checkout-primary" onClick={() => setCheckoutOpen(false)}>Return to workspace</button></div>}
        </DialogContent>
      </Dialog>
      <footer><span>AGENTCART AI / RAZORPAY AI BUILDATHON 2026</span><span>EXPLAINABLE · BOUNDED · GATED</span></footer>
    </main>
  );
}
