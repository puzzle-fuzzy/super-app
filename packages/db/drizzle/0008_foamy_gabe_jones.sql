CREATE TYPE "assets"."template_type" AS ENUM('canvas', 'generation', 'video_storyboard', 'prompt', 'page', 'poster', 'workflow');--> statement-breakpoint
CREATE TABLE "assets"."template_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"template_type" "assets"."template_type" NOT NULL,
	"template_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets"."template_assets" ADD CONSTRAINT "template_assets_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "assets"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "template_assets_asset_id_unique" ON "assets"."template_assets" USING btree ("asset_id");
