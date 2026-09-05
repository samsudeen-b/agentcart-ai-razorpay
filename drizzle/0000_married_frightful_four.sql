CREATE TYPE "public"."checkout_status" AS ENUM('creating', 'created', 'status_unknown', 'paid', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'authorized', 'captured', 'failed', 'refunded');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_key" text NOT NULL,
	"event_type" text NOT NULL,
	"detail" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkout_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_key" text NOT NULL,
	"proposal_id" text NOT NULL,
	"proposal_version" integer NOT NULL,
	"cart_hash" text NOT NULL,
	"items" jsonb NOT NULL,
	"amount_paise" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"receipt" text NOT NULL,
	"razorpay_order_id" text,
	"status" "checkout_status" DEFAULT 'creating' NOT NULL,
	"approval_confirmed" boolean DEFAULT false NOT NULL,
	"mode" text DEFAULT 'RAZORPAY_TEST' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"checkout_order_id" uuid NOT NULL,
	"razorpay_payment_id" text,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"failure_code" text,
	"failure_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_hash" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"signature_valid" boolean DEFAULT false NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_checkout_order_id_checkout_orders_id_fk" FOREIGN KEY ("checkout_order_id") REFERENCES "public"."checkout_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_proposal_index" ON "audit_events" USING btree ("proposal_key");--> statement-breakpoint
CREATE UNIQUE INDEX "checkout_orders_proposal_key_unique" ON "checkout_orders" USING btree ("proposal_key");--> statement-breakpoint
CREATE UNIQUE INDEX "checkout_orders_receipt_unique" ON "checkout_orders" USING btree ("receipt");--> statement-breakpoint
CREATE UNIQUE INDEX "checkout_orders_razorpay_order_unique" ON "checkout_orders" USING btree ("razorpay_order_id");--> statement-breakpoint
CREATE INDEX "payment_attempts_order_index" ON "payment_attempts" USING btree ("checkout_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_razorpay_payment_unique" ON "payment_attempts" USING btree ("razorpay_payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_hash_unique" ON "webhook_events" USING btree ("event_hash");