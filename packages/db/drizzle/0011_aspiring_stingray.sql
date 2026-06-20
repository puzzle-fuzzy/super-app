CREATE TYPE "public"."credit_transaction_type" AS ENUM('reserve', 'debit', 'refund', 'credit', 'admin_adjust');--> statement-breakpoint
CREATE TABLE "credit_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"available_cents" numeric(20, 4) DEFAULT '0' NOT NULL,
	"frozen_cents" numeric(20, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idx_credit_accounts_owner" UNIQUE("owner_id")
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"type" "credit_transaction_type" NOT NULL,
	"amount_cents" numeric(20, 4) NOT NULL,
	"balance_after_cents" numeric(20, 4) NOT NULL,
	"frozen_after_cents" numeric(20, 4) NOT NULL,
	"generation_record_id" uuid,
	"description" varchar(500),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idx_credit_tx_unique" UNIQUE("generation_record_id","type")
);
--> statement-breakpoint
ALTER TABLE "credit_accounts" ADD CONSTRAINT "credit_accounts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_generation_record_id_generation_records_id_fk" FOREIGN KEY ("generation_record_id") REFERENCES "public"."generation_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_credit_tx_owner_created" ON "credit_transactions" USING btree ("owner_id","created_at");