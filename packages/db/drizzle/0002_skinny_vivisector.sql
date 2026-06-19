CREATE TYPE "assets"."text_type" AS ENUM('prompt', 'novel', 'script', 'subtitle', 'note', 'dialogue', 'setting', 'other');--> statement-breakpoint
CREATE TABLE "assets"."text_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"text_type" "assets"."text_type" NOT NULL,
	"content" text NOT NULL,
	"language" varchar(16),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets"."text_assets" ADD CONSTRAINT "text_assets_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "assets"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "text_assets_asset_id_unique" ON "assets"."text_assets" USING btree ("asset_id");