CREATE TYPE "public"."generation_category" AS ENUM('text', 'image', 'video', 'subtitle');--> statement-breakpoint
CREATE TYPE "public"."generation_status" AS ENUM('pending', 'submitting', 'processing', 'saving_output', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "generation_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"task_id" varchar(255),
	"model" varchar(100) NOT NULL,
	"category" "generation_category" NOT NULL,
	"status" "generation_status" DEFAULT 'pending' NOT NULL,
	"input_params" jsonb NOT NULL,
	"output_result" jsonb,
	"cost" jsonb,
	"total_price_cents" numeric(20, 4),
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"trace_id" varchar(36),
	"dedupe_key" text,
	"hidden_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"cancel_requested_at" timestamp with time zone,
	"provider_cancel_status" varchar(50) DEFAULT 'not_requested' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "generation_records_task_id_unique" UNIQUE("task_id"),
	CONSTRAINT "generation_records_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"scope" varchar(80) NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"generation_record_id" uuid,
	"resource_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "idx_idempotency_keys_unique" UNIQUE("owner_id","scope","key_hash")
);
--> statement-breakpoint
ALTER TABLE "generation_records" ADD CONSTRAINT "generation_records_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_generation_record_id_generation_records_id_fk" FOREIGN KEY ("generation_record_id") REFERENCES "public"."generation_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_gen_records_owner_created" ON "generation_records" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_gen_records_status_category" ON "generation_records" USING btree ("status","category");--> statement-breakpoint
CREATE INDEX "idx_gen_records_trace_id" ON "generation_records" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX "idx_gen_records_deleted_at" ON "generation_records" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_idempotency_keys_expires_at" ON "idempotency_keys" USING btree ("expires_at");