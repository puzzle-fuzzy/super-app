CREATE TABLE "usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generation_record_id" uuid NOT NULL,
	"reserve_tx_id" uuid NOT NULL,
	"debit_tx_id" uuid,
	"refund_tx_id" uuid,
	"reserved_cents" numeric(20, 4) NOT NULL,
	"debited_cents" numeric(20, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_events_generation_record_id_unique" UNIQUE("generation_record_id"),
	CONSTRAINT "idx_usage_events_unique_record" UNIQUE("generation_record_id")
);
--> statement-breakpoint
ALTER TABLE "credit_accounts" ALTER COLUMN "available_cents" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "credit_accounts" ALTER COLUMN "frozen_cents" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_generation_record_id_generation_records_id_fk" FOREIGN KEY ("generation_record_id") REFERENCES "public"."generation_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_reserve_tx_id_credit_transactions_id_fk" FOREIGN KEY ("reserve_tx_id") REFERENCES "public"."credit_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_debit_tx_id_credit_transactions_id_fk" FOREIGN KEY ("debit_tx_id") REFERENCES "public"."credit_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_refund_tx_id_credit_transactions_id_fk" FOREIGN KEY ("refund_tx_id") REFERENCES "public"."credit_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_usage_events_owner_created" ON "usage_events" USING btree ("created_at");