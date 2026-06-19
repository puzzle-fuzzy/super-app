CREATE TYPE "assets"."consistency_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "assets"."subject_type" AS ENUM('person', 'character', 'product', 'pet', 'object', 'scene', 'other');--> statement-breakpoint
CREATE TABLE "assets"."subject_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"subject_type" "assets"."subject_type" NOT NULL,
	"display_name" varchar(240),
	"identity_prompt" text,
	"appearance_prompt" text,
	"negative_prompt" text,
	"consistency_level" "assets"."consistency_level" DEFAULT 'medium' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets"."subject_assets" ADD CONSTRAINT "subject_assets_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "assets"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subject_assets_asset_id_unique" ON "assets"."subject_assets" USING btree ("asset_id");