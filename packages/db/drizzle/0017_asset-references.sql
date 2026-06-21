CREATE TYPE "assets"."asset_ref_owner_type" AS ENUM('canvas', 'pipeline', 'subject', 'style', 'text', 'template');--> statement-breakpoint
CREATE TYPE "assets"."asset_ref_usage_type" AS ENUM('source', 'reference', 'output', 'thumbnail');--> statement-breakpoint
ALTER TYPE "assets"."asset_source" ADD VALUE 'canvas_pipeline' BEFORE 'canvas_export';--> statement-breakpoint
CREATE TABLE "assets"."asset_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"owner_type" "assets"."asset_ref_owner_type" NOT NULL,
	"owner_entity_id" uuid NOT NULL,
	"node_id" text,
	"usage_type" "assets"."asset_ref_usage_type" DEFAULT 'source' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets"."asset_references" ADD CONSTRAINT "asset_references_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "assets"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets"."asset_references" ADD CONSTRAINT "asset_references_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_refs_asset_id_idx" ON "assets"."asset_references" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "asset_refs_owner_entity_idx" ON "assets"."asset_references" USING btree ("owner_type","owner_entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_refs_unique" ON "assets"."asset_references" USING btree ("asset_id","owner_type","owner_entity_id","node_id","usage_type");