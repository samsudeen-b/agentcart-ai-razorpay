import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export type CheckoutItem = {
  productId: string;
  quantity: number;
  unitPricePaise: number;
};

export const checkoutStatusEnum = pgEnum("checkout_status", [
  "creating",
  "created",
  "status_unknown",
  "paid",
  "failed",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "authorized",
  "captured",
  "failed",
  "refunded",
]);

export const checkoutOrders = pgTable(
  "checkout_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    proposalKey: text("proposal_key").notNull(),
    proposalId: text("proposal_id").notNull(),
    proposalVersion: integer("proposal_version").notNull(),

    cartHash: text("cart_hash").notNull(),
    items: jsonb("items").$type<CheckoutItem[]>().notNull(),

    amountPaise: integer("amount_paise").notNull(),
    currency: text("currency").notNull().default("INR"),
    receipt: text("receipt").notNull(),

    razorpayOrderId: text("razorpay_order_id"),
    status: checkoutStatusEnum("status")
      .notNull()
      .default("creating"),

    approvalConfirmed: boolean("approval_confirmed")
      .notNull()
      .default(false),

    mode: text("mode").notNull().default("RAZORPAY_TEST"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("checkout_orders_proposal_key_unique").on(
      table.proposalKey,
    ),
    uniqueIndex("checkout_orders_receipt_unique").on(
      table.receipt,
    ),
    uniqueIndex("checkout_orders_razorpay_order_unique").on(
      table.razorpayOrderId,
    ),
  ],
);

export const paymentAttempts = pgTable(
  "payment_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    checkoutOrderId: uuid("checkout_order_id")
      .notNull()
      .references(() => checkoutOrders.id, {
        onDelete: "cascade",
      }),

    razorpayPaymentId: text("razorpay_payment_id"),
    status: paymentStatusEnum("status")
      .notNull()
      .default("pending"),

    failureCode: text("failure_code"),
    failureDescription: text("failure_description"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("payment_attempts_order_index").on(
      table.checkoutOrderId,
    ),
    uniqueIndex("payment_attempts_razorpay_payment_unique").on(
      table.razorpayPaymentId,
    ),
  ],
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    eventHash: text("event_hash").notNull(),
    eventType: text("event_type").notNull(),

    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull(),

    signatureValid: boolean("signature_valid")
      .notNull()
      .default(false),

    processed: boolean("processed")
      .notNull()
      .default(false),

    receivedAt: timestamp("received_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("webhook_events_hash_unique").on(
      table.eventHash,
    ),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    proposalKey: text("proposal_key").notNull(),
    eventType: text("event_type").notNull(),

    detail: jsonb("detail")
      .$type<Record<string, unknown>>()
      .notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_events_proposal_index").on(
      table.proposalKey,
    ),
  ],
);