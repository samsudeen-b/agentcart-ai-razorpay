export type CartLine = {
  productId: string;
  quantity: number;
};

export type MessageRole = "customer" | "agent" | "system";

export type MessageTone = "neutral" | "warning" | "success";

export type ConversationMessage = {
  id: string;
  role: MessageRole;
  time: string;
  title?: string;
  content: string;
  tone?: MessageTone;
  productIds?: readonly string[];
};

export type PurchaseStatus =
  | "idle"
  | "awaiting_approval"
  | "approved"
  | "order_creating"
  | "order_ready"
  | "payment_pending"
  | "paid"
  | "payment_failed"
  | "status_unknown";

export type PurchaseProposal = {
  id: string;
  version: number;
  status: PurchaseStatus;
  originalLines: readonly CartLine[];
  revisedLines: readonly CartLine[];
};

export type AuditTone = "information" | "warning" | "success" | "failure";

export type AuditEvent = {
  id: string;
  title: string;
  detail: string;
  time: string;
  date: string;
  tone: AuditTone;
};
export type DemoScenarioId =
  | "inventory_change"
  | "duplicate_approval"
  | "payment_failure"
  | "invalid_parameter";